/*
 * Smart Home — Firmware ESP32-CAM AI-Thinker (Nodul cameră, Hol)
 * ──────────────────────────────────────────────────────────────
 * Servește:
 *   GET /capture  — snapshot JPEG (folosit de aplicație la 5s)
 *   GET /stream   — stream MJPEG live (modalul „Vezi live")
 *
 * Plus: status MQTT online/offline (LWT) ca nodul să apară în app,
 * și wifi_update prin MQTT pentru provisioning, ca celelalte noduri.
 *
 * Placa în Arduino IDE: "AI Thinker ESP32-CAM"
 * (Tools → Board → esp32 → AI Thinker ESP32-CAM, PSRAM: Enabled)
 *
 * Librării: PubSubClient, ArduinoJson (esp_camera și esp_http_server
 * vin cu core-ul ESP32, nu se instalează separat).
 *
 * Flash: GPIO0 la GND în timpul upload-ului, apoi deconectează + reset.
 */

#include <WiFi.h>
#include <ESPmDNS.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include "esp_camera.h"
#include "esp_http_server.h"

#define NODE_ID   "esp32_cam_node"
#define LOCATION  "hol"

// ── WiFi provisioning (identic cu nodurile senzori) ───────
#define DEFAULT_WIFI_SSID  "SmartHome-Setup"
#define DEFAULT_WIFI_PASS  "smarthome2026"
#define DEFAULT_MQTT_HOST  "192.168.4.1"

#define MQTT_PORT  1883
#define MQTT_USER  "smarthome"
#define MQTT_PASS  "smarthome_mqtt_2026"

// ── Pini cameră — AI-Thinker ESP32-CAM ────────────────────
#define PWDN_GPIO   32
#define RESET_GPIO  -1
#define XCLK_GPIO    0
#define SIOD_GPIO   26
#define SIOC_GPIO   27
#define Y9_GPIO     35
#define Y8_GPIO     34
#define Y7_GPIO     39
#define Y6_GPIO     36
#define Y5_GPIO     21
#define Y4_GPIO     19
#define Y3_GPIO     18
#define Y2_GPIO      5
#define VSYNC_GPIO  25
#define HREF_GPIO   23
#define PCLK_GPIO   22

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
Preferences prefs;
httpd_handle_t httpServer = NULL;

String wifiSsid, wifiPass, mqttHost;
unsigned long lastStatus = 0;

/* ─── NVS (același namespace ca nodurile senzori) ─────────── */
void loadCredentials() {
  prefs.begin("smarthome", false);
  wifiSsid = prefs.getString("wifi_ssid", DEFAULT_WIFI_SSID);
  wifiPass = prefs.getString("wifi_pass", DEFAULT_WIFI_PASS);
  mqttHost = prefs.getString("mqtt_host", DEFAULT_MQTT_HOST);
  prefs.end();
}

void saveCredentials(const String& ssid, const String& pass, const String& host) {
  prefs.begin("smarthome", false);
  prefs.putString("wifi_ssid", ssid);
  prefs.putString("wifi_pass", pass);
  prefs.putString("mqtt_host", host);
  prefs.end();
}

/* ─── Cameră ──────────────────────────────────────────────── */
bool initCamera() {
  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO;  config.pin_d1 = Y3_GPIO;
  config.pin_d2 = Y4_GPIO;  config.pin_d3 = Y5_GPIO;
  config.pin_d4 = Y6_GPIO;  config.pin_d5 = Y7_GPIO;
  config.pin_d6 = Y8_GPIO;  config.pin_d7 = Y9_GPIO;
  config.pin_xclk     = XCLK_GPIO;
  config.pin_pclk     = PCLK_GPIO;
  config.pin_vsync    = VSYNC_GPIO;
  config.pin_href     = HREF_GPIO;
  config.pin_sccb_sda = SIOD_GPIO;
  config.pin_sccb_scl = SIOC_GPIO;
  config.pin_pwdn     = PWDN_GPIO;
  config.pin_reset    = RESET_GPIO;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  if (psramFound()) {
    config.frame_size   = FRAMESIZE_SVGA;   // 800x600 — fluent pe WiFi
    config.jpeg_quality = 12;
    config.fb_count     = 2;
  } else {
    config.frame_size   = FRAMESIZE_VGA;
    config.jpeg_quality = 15;
    config.fb_count     = 1;
  }

  return esp_camera_init(&config) == ESP_OK;
}

/* ─── HTTP: /capture (snapshot) ───────────────────────────── */
static esp_err_t captureHandler(httpd_req_t* req) {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }
  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  esp_err_t res = httpd_resp_send(req, (const char*)fb->buf, fb->len);
  esp_camera_fb_return(fb);
  return res;
}

/* ─── HTTP: /stream (MJPEG) ───────────────────────────────── */
#define BOUNDARY "smarthomeframe"
static esp_err_t streamHandler(httpd_req_t* req) {
  httpd_resp_set_type(req, "multipart/x-mixed-replace;boundary=" BOUNDARY);
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");

  char part[96];
  while (true) {
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) return ESP_FAIL;

    int len = snprintf(part, sizeof(part),
      "\r\n--" BOUNDARY "\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n",
      fb->len);

    if (httpd_resp_send_chunk(req, part, len) != ESP_OK ||
        httpd_resp_send_chunk(req, (const char*)fb->buf, fb->len) != ESP_OK) {
      esp_camera_fb_return(fb);
      break;                                  // clientul a închis stream-ul
    }
    esp_camera_fb_return(fb);
    delay(50);                                // ~15-20 fps, lasă loc și MQTT-ului
  }
  return ESP_OK;
}

void startHttpServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;

  if (httpd_start(&httpServer, &config) == ESP_OK) {
    httpd_uri_t capture = { .uri = "/capture", .method = HTTP_GET,
                            .handler = captureHandler, .user_ctx = NULL };
    httpd_uri_t stream  = { .uri = "/stream",  .method = HTTP_GET,
                            .handler = streamHandler,  .user_ctx = NULL };
    httpd_register_uri_handler(httpServer, &capture);
    httpd_register_uri_handler(httpServer, &stream);
    Serial.println("[HTTP] Server pornit: /capture, /stream");
  }
}

/* ─── WiFi + mDNS (identic cu nodurile senzori) ───────────── */
void connectWifi() {
  Serial.printf("[WiFi] Conectare la %s...\n", wifiSsid.c_str());
  WiFi.begin(wifiSsid.c_str(), wifiPass.c_str());

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500); Serial.print("."); attempts++;
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\n[WiFi] Eșec — revin la hotspotul de setup");
    wifiSsid = DEFAULT_WIFI_SSID; wifiPass = DEFAULT_WIFI_PASS;
    mqttHost = DEFAULT_MQTT_HOST;
    WiFi.begin(DEFAULT_WIFI_SSID, DEFAULT_WIFI_PASS);
    attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 60) {
      delay(500); Serial.print("."); attempts++;
    }
    if (WiFi.status() != WL_CONNECTED) { delay(5000); ESP.restart(); }
  }
  Serial.printf("\n[WiFi] Conectat! IP: %s\n", WiFi.localIP().toString().c_str());
}

String resolveMqttHost() {
  if (!mqttHost.endsWith(".local")) return mqttHost;
  String name = mqttHost.substring(0, mqttHost.length() - 6);
  static bool mdnsStarted = false;
  if (!mdnsStarted) {
    // și camera devine accesibilă ca smarthome-cam.local
    if (!MDNS.begin("smarthome-cam")) return DEFAULT_MQTT_HOST;
    mdnsStarted = true;
  }
  for (int i = 0; i < 5; i++) {
    IPAddress ip = MDNS.queryHost(name.c_str(), 3000);
    if (ip != IPAddress(0, 0, 0, 0)) return ip.toString();
    delay(2000);
  }
  return DEFAULT_MQTT_HOST;
}

/* ─── MQTT: status + wifi_update ──────────────────────────── */
void onMessage(char* topic, byte* payload, unsigned int length) {
  String msg;
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];

  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, msg)) return;

  if ((doc["action"] | String("")) == "wifi_update") {
    String newSsid = doc["ssid"] | "";
    String newPass = doc["password"] | "";
    String newHost = doc["mqtt_host"] | "";
    if (newSsid.isEmpty()) return;
    if (newHost.isEmpty()) newHost = "smarthome.local";
    saveCredentials(newSsid, newPass, newHost);
    delay(3000);
    ESP.restart();
  }
}

void connectMqtt() {
  String host = resolveMqttHost();
  mqtt.setServer(host.c_str(), MQTT_PORT);
  mqtt.setCallback(onMessage);

  StaticJsonDocument<96> will;
  will["node_id"] = NODE_ID;
  will["status"]  = "offline";
  char willMsg[96];
  serializeJson(will, willMsg);

  int attempts = 0;
  while (!mqtt.connected()) {
    if (mqtt.connect("esp32-" NODE_ID, MQTT_USER, MQTT_PASS,
                     "smarthome/" NODE_ID "/status", 1, true, willMsg)) {
      mqtt.subscribe("smarthome/" NODE_ID "/commands");

      StaticJsonDocument<96> st;
      st["node_id"] = NODE_ID;
      st["status"]  = "online";
      char stMsg[96];
      serializeJson(st, stMsg);
      mqtt.publish("smarthome/" NODE_ID "/status", stMsg, true);
      Serial.println("[MQTT] Conectat");
      return;
    }
    Serial.printf("[MQTT] Eroare: %d\n", mqtt.state());
    if (++attempts >= 10) { delay(1000); ESP.restart(); }
    delay(3000);
  }
}

/* ─── Setup & loop ────────────────────────────────────────── */
void setup() {
  Serial.begin(115200);
  Serial.println("\n[Boot] Smart Home — " NODE_ID " (" LOCATION ")");

  if (!initCamera()) {
    Serial.println("[Cameră] Inițializare eșuată — restart în 5s");
    delay(5000);
    ESP.restart();
  }

  loadCredentials();
  connectWifi();
  startHttpServer();
  connectMqtt();
  Serial.printf("[Boot] Gata! Stream: http://%s/stream\n",
                WiFi.localIP().toString().c_str());
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWifi();
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();

  // Re-publică statusul la 30s (heartbeat pentru lastSeen)
  if (millis() - lastStatus >= 30000) {
    lastStatus = millis();
    StaticJsonDocument<96> st;
    st["node_id"] = NODE_ID;
    st["status"]  = "online";
    char stMsg[96];
    serializeJson(st, stMsg);
    mqtt.publish("smarthome/" NODE_ID "/status", stMsg, true);
  }
}
