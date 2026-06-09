#include <WiFi.h>
#include <ESPmDNS.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// ── Config implicită (hotspot RPi) ───────────────────────
#define DEFAULT_WIFI_SSID  "SmartHome-Setup"
#define DEFAULT_WIFI_PASS  "smarthome2026"
#define DEFAULT_MQTT_HOST  "192.168.4.1"    // IP fix al hotspot-ului RPi

#define MQTT_PORT          1883
#define MQTT_USER          "smarthome"
#define MQTT_PASS          "smarthome_mqtt_2026"
#define NODE_ID            "esp32_node_a"

#define DHT_PIN            4
#define DHT_TYPE           DHT11
#define INTERVAL_MS        5000
// ─────────────────────────────────────────────────────────

DHT dht(DHT_PIN, DHT_TYPE);
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
Preferences prefs;

unsigned long lastRead = 0;
String wifiSsid, wifiPass, mqttHost;

// ── Încarcă credențiale salvate (sau default) ─────────────
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

// ── Conectare WiFi ────────────────────────────────────────
void connectWifi() {
  Serial.printf("[WiFi] Conectare la %s...\n", wifiSsid.c_str());
  WiFi.begin(wifiSsid.c_str(), wifiPass.c_str());

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] Conectat! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WiFi] Eroare! Reîncerc cu hotspot-ul implicit...");
    wifiSsid = DEFAULT_WIFI_SSID;
    wifiPass = DEFAULT_WIFI_PASS;
    mqttHost = DEFAULT_MQTT_HOST;
    WiFi.begin(DEFAULT_WIFI_SSID, DEFAULT_WIFI_PASS);
    while (WiFi.status() != WL_CONNECTED) {
      delay(500); Serial.print(".");
    }
    Serial.printf("\n[WiFi] Conectat la hotspot! IP: %s\n", WiFi.localIP().toString().c_str());
  }
}

// ── Procesare comenzi MQTT ────────────────────────────────
void onMessage(char* topic, byte* payload, unsigned int length) {
  String msg;
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];

  Serial.printf("[MQTT] Mesaj pe %s: %s\n", topic, msg.c_str());

  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, msg)) return;

  String action = doc["action"] | "";

  // Actualizare WiFi de la RPi
  if (action == "wifi_update") {
    String newSsid = doc["ssid"] | "";
    String newPass = doc["password"] | "";
    String newHost = doc["mqtt_host"] | "";

    if (newSsid.isEmpty()) return;

    // Dacă nu e specificat host MQTT nou, folosim același hostname
    // dar pe noua rețea RPi va fi smarthome.local
    if (newHost.isEmpty()) newHost = "smarthome.local";

    Serial.printf("[Setup] WiFi nou primit: %s → reconectare în 3s...\n", newSsid.c_str());
    saveCredentials(newSsid, newPass, newHost);

    delay(3000);
    ESP.restart();  // Restart cu noile credențiale
  }
}

// ── Rezolvare host MQTT ───────────────────────────────────
// PubSubClient nu rezolvă nume .local prin DNS obișnuit — pe rețele noi
// (după provisioning) RPi e găsit prin mDNS: smarthome.local → IP.
String resolveMqttHost() {
  if (!mqttHost.endsWith(".local")) return mqttHost;

  String name = mqttHost.substring(0, mqttHost.length() - 6);  // fără ".local"
  Serial.printf("[mDNS] Rezolv %s...\n", mqttHost.c_str());

  static bool mdnsStarted = false;
  if (!mdnsStarted) {
    if (!MDNS.begin("esp32-" NODE_ID)) {
      Serial.println("[mDNS] Eroare init — folosesc IP-ul default");
      return DEFAULT_MQTT_HOST;
    }
    mdnsStarted = true;
  }

  for (int i = 0; i < 5; i++) {
    IPAddress ip = MDNS.queryHost(name.c_str(), 3000);
    if (ip != IPAddress(0, 0, 0, 0)) {
      Serial.printf("[mDNS] %s → %s\n", mqttHost.c_str(), ip.toString().c_str());
      return ip.toString();
    }
    Serial.println("[mDNS] Negăsit, reîncerc...");
    delay(2000);
  }

  Serial.println("[mDNS] Eșec — folosesc IP-ul default");
  return DEFAULT_MQTT_HOST;
}

// ── Conectare MQTT ────────────────────────────────────────
// Retry limitat: dacă brokerul nu răspunde, restart (fără ștergerea
// credențialelor — mutarea în altă rețea e tratată de connectWifi(),
// care revine singur pe hotspotul default când WiFi-ul salvat lipsește).
void connectMqtt() {
  String host = resolveMqttHost();
  mqtt.setServer(host.c_str(), MQTT_PORT);
  mqtt.setCallback(onMessage);

  int attempts = 0;
  while (!mqtt.connected()) {
    Serial.print("[MQTT] Conectare...");
    if (mqtt.connect("esp32-" NODE_ID, MQTT_USER, MQTT_PASS)) {
      Serial.println(" OK");
      mqtt.subscribe(("smarthome/" NODE_ID "/commands"));
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

void setup() {
  Serial.begin(115200);
  dht.begin();
  loadCredentials();
  connectWifi();
  connectMqtt();
  Serial.println("[Setup] Gata!");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWifi();
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();

  if (millis() - lastRead >= INTERVAL_MS) {
    lastRead = millis();

    float temp  = dht.readTemperature();
    float humid = dht.readHumidity();

    if (isnan(temp) || isnan(humid)) {
      Serial.println("[DHT11] Eroare citire!");
      return;
    }

    StaticJsonDocument<200> doc;
    doc["nodeId"]      = NODE_ID;
    doc["temperature"] = round(temp * 10.0) / 10.0;
    doc["humidity"]    = round(humid * 10.0) / 10.0;
    doc["ts"]          = millis();

    char payload[200];
    serializeJson(doc, payload);
    mqtt.publish("smarthome/" NODE_ID "/sensors", payload);

    Serial.printf("[DHT11] Temp: %.1f°C | Umiditate: %.0f%%\n", temp, humid);
  }
}
