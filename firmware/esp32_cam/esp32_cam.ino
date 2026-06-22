/*
 * Smart Home — Firmware ESP32-CAM AI-Thinker (Nodul curte/exterior)
 * ──────────────────────────────────────────────────────────────
 * Supraveghere curte:
 *   GET /capture  — snapshot JPEG (folosit de aplicație la 5s)
 *   GET /stream   — stream MJPEG live (modalul „Vezi live")
 *   PIR (GPIO13)  — detecție mișcare, publicată pe MQTT
 *   LED (GPIO12)  — se aprinde automat 30s la mișcare (proiector
 *                   prin tranzistor/releu, sau LED simplu la demo)
 *
 * Plus: status MQTT online/offline (LWT) ca nodul să apară în app,
 * și wifi_update prin MQTT pentru provisioning, ca celălalt nod.
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
#define LOCATION  "curte"

// ── PIR + LED exterior ─────────────────────────────────────
// GPIO12/13 sunt printre puținii pini liberi pe AI-Thinker.
// Atenție: GPIO12 trebuie să fie LOW la boot (strapping pin) —
// LED-ul/tranzistorul tras la GND e exact ce trebuie.
#define PIR_PIN        13
#define LED_PIN        12
#define LED_ON_MS      30000   // LED aprins 30s după ultima mișcare

// ── WiFi provisioning (identic cu nodurile senzori) ───────
#define DEFAULT_WIFI_SSID  "SmartHome-Setup"
#define DEFAULT_WIFI_PASS  "smarthome2026"
#define DEFAULT_MQTT_HOST  "192.168.4.1"

// Fallback final: reteaua de acasa unde RPi e deja conectat (pentru test).
#define FALLBACK_WIFI_SSID  "Orange-ADXPcy-2G"
#define FALLBACK_WIFI_PASS  "TtYbS9S24chukKxKEK"   // parola retelei (NU urca pe GitHub)
#define FALLBACK_MQTT_HOST  "smarthome.local"

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
unsigned long lastStatus  = 0;
unsigned long lastMotion  = 0;     // ultimul moment cu mișcare
unsigned long lastPublish = 0;
unsigned long lastMqttTry = 0;     // throttle reconectare MQTT (non-blocking)
bool ledOn = false;

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

/* ─── WiFi: incearca o retea cu timeout ───────────────────── */
bool tryWifi(const char* ssid, const char* pass, int maxAttempts) {
  Serial.printf("[WiFi] Incerc \"%s\"...", ssid);
  WiFi.disconnect();
  WiFi.begin(ssid, pass);
  int a = 0;
  while (WiFi.status() != WL_CONNECTED && a < maxAttempts) {
    delay(500); Serial.print("."); a++;
  }
  bool ok = (WiFi.status() == WL_CONNECTED);
  Serial.println(ok ? " OK" : " esuat");
  return ok;
}

/* ─── WiFi: 3 niveluri (salvata -> hotspot RPi -> retea acasa) ─ */
void connectWifi() {
  if (tryWifi(wifiSsid.c_str(), wifiPass.c_str(), 20)) {
    Serial.printf("[WiFi] Conectat (salvata)! IP: %s\n", WiFi.localIP().toString().c_str());
    return;
  }
  if (tryWifi(DEFAULT_WIFI_SSID, DEFAULT_WIFI_PASS, 20)) {
    wifiSsid = DEFAULT_WIFI_SSID; wifiPass = DEFAULT_WIFI_PASS; mqttHost = DEFAULT_MQTT_HOST;
    Serial.printf("[WiFi] Conectat (setup RPi)! IP: %s\n", WiFi.localIP().toString().c_str());
    return;
  }
  if (tryWifi(FALLBACK_WIFI_SSID, FALLBACK_WIFI_PASS, 30)) {
    wifiSsid = FALLBACK_WIFI_SSID; wifiPass = FALLBACK_WIFI_PASS; mqttHost = FALLBACK_MQTT_HOST;
    Serial.printf("[WiFi] Conectat (fallback acasa)! IP: %s\n", WiFi.localIP().toString().c_str());
    return;
  }
  Serial.println("[WiFi] Nicio retea disponibila — restart in 5s");
  delay(5000);
  ESP.restart();
}

String resolveMqttHost() {
  if (!mqttHost.endsWith(".local")) return mqttHost;
  String name = mqttHost.substring(0, mqttHost.length() - 6);
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

// O singură încercare, NON-blocking, FĂRĂ restart: camera (HTTP) trebuie
// să rămână funcțională chiar dacă brokerul (Raspberry Pi) lipsește.
bool connectMqtt() {
  if (mqtt.connected()) return true;

  String host = resolveMqttHost();
  mqtt.setServer(host.c_str(), MQTT_PORT);
  mqtt.setCallback(onMessage);
  mqtt.setSocketTimeout(2);   // eșec rapid dacă brokerul lipsește (nu bloca camera)

  StaticJsonDocument<96> will;
  will["node_id"] = NODE_ID;
  will["status"]  = "offline";
  char willMsg[96];
  serializeJson(will, willMsg);

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
    return true;
  }
  Serial.printf("[MQTT] Indisponibil (%d) — camera merge oricum\n", mqtt.state());
  return false;
}

/* ─── Setup & loop ────────────────────────────────────────── */
void setup() {
  Serial.begin(115200);
  Serial.println("\n[Boot] Smart Home — " NODE_ID " (" LOCATION ")");

  pinMode(PIR_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  if (!initCamera()) {
    Serial.println("[Cameră] Inițializare eșuată — restart în 5s");
    delay(5000);
    ESP.restart();
  }

  loadCredentials();
  connectWifi();

  // Camera devine accesibilă ca http://smarthome-cam.local pe orice rețea
  if (MDNS.begin("smarthome-cam")) {
    MDNS.addService("http", "tcp", 80);
    Serial.println("[mDNS] smarthome-cam.local activ");
  }

  startHttpServer();
  connectMqtt();
  Serial.printf("[Boot] Gata! Stream: http://%s/stream\n",
                WiFi.localIP().toString().c_str());
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWifi();
  // Reîncearcă MQTT la fiecare 15s, fără a bloca stream-ul camerei
  if (!mqtt.connected()) {
    if (millis() - lastMqttTry >= 15000) { lastMqttTry = millis(); connectMqtt(); }
  } else {
    mqtt.loop();
  }

  // ── Mișcare în curte → LED aprins + raportare ──
  bool motion = digitalRead(PIR_PIN) == HIGH;
  if (motion) {
    lastMotion = millis();
    if (!ledOn) {
      digitalWrite(LED_PIN, HIGH);
      ledOn = true;
      Serial.println("[Curte] Mișcare — LED aprins");
    }
  }
  if (ledOn && millis() - lastMotion >= LED_ON_MS) {
    digitalWrite(LED_PIN, LOW);
    ledOn = false;
  }

  // Publică starea de mișcare la 5s (apare în app ca nod „curte")
  if (millis() - lastPublish >= 5000) {
    lastPublish = millis();
    StaticJsonDocument<128> doc;
    doc["nodeId"]   = NODE_ID;
    doc["location"] = LOCATION;
    doc["motion"]   = motion;
    char payload[128];
    serializeJson(doc, payload);
    mqtt.publish("smarthome/" NODE_ID "/sensors", payload);
  }

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
