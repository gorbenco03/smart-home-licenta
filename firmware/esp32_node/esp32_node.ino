/*
 * Smart Home — Firmware nod senzori/actuatori (ESP32 WROOM-32)
 * ─────────────────────────────────────────────────────────────
 * Un singur sketch pentru ambele noduri. Pentru Nodul B schimbă
 * doar secțiunea CONFIG NOD de mai jos (NODE_ID, LOCATION, HAS_SERVO).
 *
 * Senzori:   DHT22/DHT11 (GPIO4), MQ-2 (GPIO34 analog), PIR (GPIO27),
 *            BH1750 lux (I2C: SDA=21, SCL=22)
 * Actuatori: 4x releu (GPIO26,25,33,32), buzzer (GPIO5),
 *            servo SG90 (GPIO18, doar Nodul A)
 *
 * Librării (Arduino IDE → Library Manager):
 *   - DHT sensor library (Adafruit) + Adafruit Unified Sensor
 *   - BH1750 (Christopher Laws)
 *   - PubSubClient (Nick O'Leary)
 *   - ArduinoJson (Benoit Blanchon)
 *   - ESP32Servo (Kevin Harrington)  — doar pentru Nodul A
 *
 * Protocol MQTT (vezi docs/06_ghid_conexiuni_software.md):
 *   publish   smarthome/{NODE_ID}/sensors   — citiri la 5s, JSON flat
 *   publish   smarthome/{NODE_ID}/status    — online/offline (LWT)
 *   publish   smarthome/alerts              — alertă gaz (prag depășit)
 *   subscribe smarthome/{NODE_ID}/commands  — relee, buzzer, servo, wifi_update
 */

#include <WiFi.h>
#include <ESPmDNS.h>
#include <Wire.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <BH1750.h>
#include <ArduinoJson.h>
#include <Preferences.h>

/* ══ CONFIG NOD — singura secțiune de modificat între noduri ══ */
#define NODE_ID    "esp32_node_a"   // Nodul B: "esp32_node_b"
#define LOCATION   "living"         // Nodul B: "dormitor"
#define HAS_SERVO  1                // Nodul B: 0 (fără perdele)
/* ═════════════════════════════════════════════════════════════ */

#if HAS_SERVO
#include <ESP32Servo.h>
#endif

// ── WiFi provisioning (hotspot RPi ca fallback) ───────────
#define DEFAULT_WIFI_SSID  "SmartHome-Setup"
#define DEFAULT_WIFI_PASS  "smarthome2026"
#define DEFAULT_MQTT_HOST  "192.168.4.1"

#define MQTT_PORT          1883
#define MQTT_USER          "smarthome"
#define MQTT_PASS          "smarthome_mqtt_2026"

// ── Pini (conform docs/hardware_breadboard_guide.md) ──────
#define DHT_PIN     4
#define DHT_TYPE    DHT11        // schimbă în DHT22 dacă ai AM2302
#define MQ2_PIN     34           // ieșirea analogică A0
#define PIR_PIN     27
#define BUZZER_PIN  5
#define SERVO_PIN   18
const int RELAY_PINS[4] = { 26, 25, 33, 32 };

// Modulele uzuale de relee pe 4 canale sunt active-LOW
#define RELAY_ACTIVE_LOW   true

// ── Praguri și intervale ──────────────────────────────────
#define GAS_THRESHOLD      350      // ADC 0–1023; >prag → alertă
#define PUBLISH_INTERVAL   5000     // ms între citiri

// ── Obiecte globale ───────────────────────────────────────
DHT dht(DHT_PIN, DHT_TYPE);
BH1750 lightMeter;
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
Preferences prefs;
#if HAS_SERVO
Servo servo;
#endif

String wifiSsid, wifiPass, mqttHost;
unsigned long lastPublish = 0;
bool gasAlertActive = false;     // pentru alertă doar pe frontul crescător
bool relayState[4]  = { false, false, false, false };
bool bh1750Ok       = false;

/* ─── NVS: credențiale persistente ───────────────────────── */
void loadCredentials() {
  prefs.begin("smarthome", false);
  wifiSsid = prefs.getString("wifi_ssid", DEFAULT_WIFI_SSID);
  wifiPass = prefs.getString("wifi_pass", DEFAULT_WIFI_PASS);
  mqttHost = prefs.getString("mqtt_host", DEFAULT_MQTT_HOST);
  prefs.end();
  Serial.printf("[Config] WiFi: %s | MQTT: %s\n", wifiSsid.c_str(), mqttHost.c_str());
}

void saveCredentials(const String& ssid, const String& pass, const String& host) {
  prefs.begin("smarthome", false);
  prefs.putString("wifi_ssid", ssid);
  prefs.putString("wifi_pass", pass);
  prefs.putString("mqtt_host", host);
  prefs.end();
  Serial.println("[Config] Credențiale salvate în NVS");
}

/* ─── WiFi: rețeaua salvată, apoi fallback pe hotspot ─────── */
void connectWifi() {
  Serial.printf("[WiFi] Conectare la %s...\n", wifiSsid.c_str());
  WiFi.begin(wifiSsid.c_str(), wifiPass.c_str());

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500); Serial.print("."); attempts++;
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\n[WiFi] Eșec — revin la hotspotul de setup");
    wifiSsid = DEFAULT_WIFI_SSID;
    wifiPass = DEFAULT_WIFI_PASS;
    mqttHost = DEFAULT_MQTT_HOST;
    WiFi.begin(DEFAULT_WIFI_SSID, DEFAULT_WIFI_PASS);
    attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 60) {
      delay(500); Serial.print("."); attempts++;
    }
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("\n[WiFi] Nici hotspotul nu răspunde — restart în 5s");
      delay(5000);
      ESP.restart();
    }
  }
  Serial.printf("\n[WiFi] Conectat! IP: %s\n", WiFi.localIP().toString().c_str());
}

/* ─── mDNS: smarthome.local → IP (RPi pe rețele noi) ──────── */
String resolveMqttHost() {
  if (!mqttHost.endsWith(".local")) return mqttHost;

  String name = mqttHost.substring(0, mqttHost.length() - 6);
  static bool mdnsStarted = false;
  if (!mdnsStarted) {
    if (!MDNS.begin("esp32-" NODE_ID)) return DEFAULT_MQTT_HOST;
    mdnsStarted = true;
  }
  for (int i = 0; i < 5; i++) {
    IPAddress ip = MDNS.queryHost(name.c_str(), 3000);
    if (ip != IPAddress(0, 0, 0, 0)) {
      Serial.printf("[mDNS] %s → %s\n", mqttHost.c_str(), ip.toString().c_str());
      return ip.toString();
    }
    delay(2000);
  }
  Serial.println("[mDNS] Eșec — folosesc IP-ul default");
  return DEFAULT_MQTT_HOST;
}

/* ─── Actuatori ───────────────────────────────────────────── */
void setRelay(int index, bool on) {
  if (index < 0 || index > 3) return;
  relayState[index] = on;
  bool level = RELAY_ACTIVE_LOW ? !on : on;
  digitalWrite(RELAY_PINS[index], level ? HIGH : LOW);
  Serial.printf("[Releu %d] %s\n", index, on ? "PORNIT" : "OPRIT");
}

void beep(int count) {
  for (int i = 0; i < count; i++) {
    digitalWrite(BUZZER_PIN, HIGH); delay(200);
    digitalWrite(BUZZER_PIN, LOW);  delay(150);
  }
}

/* ─── Comenzi MQTT de la server ───────────────────────────── */
void onMessage(char* topic, byte* payload, unsigned int length) {
  String msg;
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  Serial.printf("[MQTT] Comandă: %s\n", msg.c_str());

  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, msg)) return;
  String action = doc["action"] | "";

  if (action == "relay_on")     setRelay(doc["relay"] | -1, true);
  else if (action == "relay_off")    setRelay(doc["relay"] | -1, false);
  else if (action == "relay_toggle") {
    int r = doc["relay"] | -1;
    if (r >= 0 && r <= 3) setRelay(r, !relayState[r]);
  }
  else if (action == "buzzer_beep")  beep(doc["count"] | 1);
  else if (action == "all_off") {
    for (int i = 0; i < 4; i++) setRelay(i, false);
  }
#if HAS_SERVO
  else if (action == "servo_move") {
    int angle = doc["servoAngle"] | 0;
    angle = constrain(angle, 0, 180);
    servo.write(angle);
    Serial.printf("[Servo] %d°\n", angle);
  }
#endif
  else if (action == "wifi_update") {
    String newSsid = doc["ssid"] | "";
    String newPass = doc["password"] | "";
    String newHost = doc["mqtt_host"] | "";
    if (newSsid.isEmpty()) return;
    if (newHost.isEmpty()) newHost = "smarthome.local";
    Serial.printf("[Setup] WiFi nou: %s → restart în 3s\n", newSsid.c_str());
    saveCredentials(newSsid, newPass, newHost);
    delay(3000);
    ESP.restart();
  }
}

/* ─── MQTT cu Last Will (status offline automat) ──────────── */
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
    Serial.print("[MQTT] Conectare...");
    if (mqtt.connect("esp32-" NODE_ID, MQTT_USER, MQTT_PASS,
                     "smarthome/" NODE_ID "/status", 1, true, willMsg)) {
      Serial.println(" OK");
      mqtt.subscribe("smarthome/" NODE_ID "/commands");

      StaticJsonDocument<96> st;
      st["node_id"] = NODE_ID;
      st["status"]  = "online";
      char stMsg[96];
      serializeJson(st, stMsg);
      mqtt.publish("smarthome/" NODE_ID "/status", stMsg, true);
      return;
    }
    Serial.printf(" Eroare: %d — reîncerc în 3s\n", mqtt.state());
    if (++attempts >= 10) {
      Serial.println("[MQTT] Broker negăsit după 10 încercări — restart");
      delay(1000);
      ESP.restart();
    }
    delay(3000);
  }
}

/* ─── Alertă gaz către server (doar pe frontul crescător) ─── */
void publishGasAlert(int level) {
  StaticJsonDocument<192> doc;
  doc["node_id"]    = NODE_ID;
  doc["alert_type"] = "GAS_DETECTED";
  doc["location"]   = LOCATION;
  JsonObject d = doc.createNestedObject("details");
  d["nivel"] = level;
  d["prag"]  = GAS_THRESHOLD;
  char payload[192];
  serializeJson(doc, payload);
  mqtt.publish("smarthome/alerts", payload, false);
  Serial.printf("[ALERTĂ] Gaz %d > %d — trimisă la server\n", level, GAS_THRESHOLD);
}

/* ─── Citire + publicare senzori ──────────────────────────── */
void publishSensors() {
  float temp  = dht.readTemperature();
  float humid = dht.readHumidity();
  int   gas   = analogRead(MQ2_PIN);          // 0–1023 (rezoluție setată în setup)
  bool  motion = digitalRead(PIR_PIN) == HIGH;
  float lux   = bh1750Ok ? lightMeter.readLightLevel() : -1;

  if (isnan(temp) || isnan(humid)) {
    Serial.println("[DHT] Eroare citire — sar peste publicare");
    return;
  }

  bool gasAlert = gas > GAS_THRESHOLD;
  if (gasAlert && !gasAlertActive) {          // front crescător
    publishGasAlert(gas);
    beep(3);                                  // semnal sonor local imediat
  }
  gasAlertActive = gasAlert;

  StaticJsonDocument<256> doc;
  doc["nodeId"]      = NODE_ID;
  doc["location"]    = LOCATION;
  doc["temperature"] = round(temp * 10.0) / 10.0;
  doc["humidity"]    = round(humid * 10.0) / 10.0;
  doc["gasLevel"]    = gas;
  doc["gasAlert"]    = gasAlert;
  doc["motion"]      = motion;
  if (lux >= 0) doc["lightLux"] = round(lux);

  char payload[256];
  serializeJson(doc, payload);
  mqtt.publish("smarthome/" NODE_ID "/sensors", payload);

  Serial.printf("[Senzori] %.1f°C %.0f%% | gaz %d%s | %s | %.0f lx\n",
                temp, humid, gas, gasAlert ? " ⚠" : "",
                motion ? "mișcare" : "liniște", lux);
}

/* ─── Setup & loop ────────────────────────────────────────── */
void setup() {
  Serial.begin(115200);
  Serial.println("\n[Boot] Smart Home — " NODE_ID " (" LOCATION ")");

  // ADC 10 biți (0–1023) — scala așteptată de server și aplicație
  analogReadResolution(10);

  pinMode(PIR_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  for (int i = 0; i < 4; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);
    setRelay(i, false);                       // toate releele oprite la boot
  }

#if HAS_SERVO
  servo.attach(SERVO_PIN);
  servo.write(0);
#endif

  dht.begin();
  Wire.begin(21, 22);
  bh1750Ok = lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);
  if (!bh1750Ok) Serial.println("[BH1750] Negăsit pe I2C — lux dezactivat");

  loadCredentials();
  connectWifi();
  connectMqtt();
  Serial.println("[Boot] Gata!");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWifi();
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();

  if (millis() - lastPublish >= PUBLISH_INTERVAL) {
    lastPublish = millis();
    publishSensors();
  }
}
