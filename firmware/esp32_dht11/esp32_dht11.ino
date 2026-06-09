#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ── Configurare ──────────────────────────────────────────
#define WIFI_SSID     "numele_retelei_tale"
#define WIFI_PASS     "parola_wifi"

#define MQTT_HOST     "192.168.1.64"   // IP-ul Raspberry Pi
#define MQTT_PORT     1883
#define MQTT_USER     "smarthome"
#define MQTT_PASS     "smarthome_mqtt_2026"
#define NODE_ID       "esp32_node_a"

#define DHT_PIN       4
#define DHT_TYPE      DHT11
#define INTERVAL_MS   5000             // citire la fiecare 5 secunde
// ─────────────────────────────────────────────────────────

DHT dht(DHT_PIN, DHT_TYPE);
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

unsigned long lastRead = 0;

void connectWifi() {
  Serial.print("[WiFi] Conectare la ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("[WiFi] Conectat! IP: ");
  Serial.println(WiFi.localIP());
}

void connectMqtt() {
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  while (!mqtt.connected()) {
    Serial.print("[MQTT] Conectare...");
    String clientId = "esp32-" + String(NODE_ID);
    if (mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
      Serial.println(" OK");
    } else {
      Serial.print(" Eroare: ");
      Serial.println(mqtt.state());
      delay(3000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  connectWifi();
  connectMqtt();
  Serial.println("[Setup] Gata! Citesc DHT11...");
}

void loop() {
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();

  if (millis() - lastRead >= INTERVAL_MS) {
    lastRead = millis();

    float temp  = dht.readTemperature();
    float humid = dht.readHumidity();

    if (isnan(temp) || isnan(humid)) {
      Serial.println("[DHT11] Eroare citire! Verifica conexiunile.");
      return;
    }

    // Construieste JSON
    StaticJsonDocument<200> doc;
    doc["nodeId"]      = NODE_ID;
    doc["temperature"] = round(temp * 10.0) / 10.0;
    doc["humidity"]    = round(humid * 10.0) / 10.0;
    doc["ts"]          = millis();

    char payload[200];
    serializeJson(doc, payload);

    String topic = "smarthome/" + String(NODE_ID) + "/sensors";
    mqtt.publish(topic.c_str(), payload);

    Serial.print("[DHT11] Temp: ");
    Serial.print(temp);
    Serial.print(" °C  |  Umiditate: ");
    Serial.print(humid);
    Serial.println(" %");
  }
}
