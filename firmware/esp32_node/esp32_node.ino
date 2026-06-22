/*
 * Smart Home — Firmware nodul interior (ESP32 WROOM-32)
 * ═══════════════════════════════════════════════════════════════
 * Hardware real — pinout complet (CONFIRMAT pe breadboard):
 *
 *   Senzori:
 *     DHT11 #1 (living)   GPIO4   — digital, modul cu pull-up, alim. 3.3V
 *     DHT11 #2 (dormitor) GPIO23  — digital, modul cu pull-up, alim. 3.3V
 *     MQ-2 (A0 analog)    GPIO34  — ADC1, input-only, divizor 2x10k, alim. 5V
 *     LDR #1 (living)     GPIO35  — ADC1, input-only, divizor cu 10k, 3.3V
 *     LDR #2 (dormitor)   GPIO36  — ADC1 (VP), input-only, divizor cu 10k, 3.3V
 *     PIR (miscare/curte) GPIO14  — iesire 3.3V, alim. 5V extern
 *
 *   Actuatori:
 *     LED #0 (living)     GPIO25  — iesire digitala
 *     LED #1 (dormitor)   GPIO26  — iesire digitala
 *     LED #2 (baie)       GPIO33  — iesire digitala
 *     LED exterior (curte)GPIO32  — AUTOMAT la miscare (PIR)
 *     Buzzer PASIV        GPIO13  — necesita tone() (semnal cu frecventa)
 *     Servo SG90 (jaluzele)GPIO18 — PWM 50Hz, alim. 5V extern
 *     Ventilator (releu)  GPIO19  — modul releu ACTIVE-LOW, alim. 5V extern
 *
 *   Releu ventilator (IMPORTANT):
 *     Modul active-LOW alimentat la 5V, comandat de la 3.3V. Pentru a se opri
 *     COMPLET nu fortam pinul la 3.3V, ci il lasam in INPUT (pull-up modul -> 5V).
 *     PORNIT  = pinMode OUTPUT + digitalWrite LOW (0V).
 *     OPRIT   = pinMode INPUT  (pinul "pluteste", modulul il ridica la 5V).
 *     Putere: (+)sursa->COM, NO->(+)ventilator, (-)ventilator->(-)sursa(GND comun).
 *
 *   Toate alimentarile de 5V (MQ2, PIR, servo, releu) vin din SURSA EXTERNA,
 *   cu masa comuna cu ESP32. ESP32 alimenteaza doar 3.3V (DHT, LDR).
 *
 * Librarii necesare (Arduino IDE -> Library Manager):
 *   - DHT sensor library (Adafruit) + Adafruit Unified Sensor
 *   - ESP32Servo (Kevin Harrington)
 *   - PubSubClient (Nick O'Leary)
 *   - ArduinoJson (Benoit Blanchon) >= v6
 *
 * Protocol MQTT (broker Mosquitto pe Raspberry Pi):
 *   publish   smarthome/esp32_node_a/sensors   — citiri la 5s, JSON flat
 *   publish   smarthome/esp32_node_a/status    — online/offline (LWT)
 *   publish   smarthome/alerts                 — alerta gaz / miscare
 *   subscribe smarthome/esp32_node_a/commands  — LED, ventilator, servo, buzzer, wifi
 *
 * Proiect licenta — Universitatea Politehnica Timisoara, 2026.
 */

#include <WiFi.h>
#include <ESPmDNS.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>
#include <Preferences.h>

/* ══ CONFIG NOD ═══════════════════════════════════════════════ */
#define NODE_ID   "esp32_node_a"
#define LOCATION  "interior"
/* ════════════════════════════════════════════════════════════= */

// ── WiFi provisioning ────────────────────────────────────────
#define DEFAULT_WIFI_SSID  "SmartHome-Setup"
#define DEFAULT_WIFI_PASS  "smarthome2026"
#define DEFAULT_MQTT_HOST  "192.168.4.1"

// Fallback final: reteaua de acasa unde RPi e deja conectat (pentru test).
// Brokerul se gaseste prin mDNS (smarthome.local) pe aceasta retea.
#define FALLBACK_WIFI_SSID  "Orange-ADXPcy-2G"
#define FALLBACK_WIFI_PASS  "TtYbS9S24chukKxKEK"   // parola retelei (NU urca pe GitHub)
#define FALLBACK_MQTT_HOST  "smarthome.local"

#define MQTT_PORT  1883
#define MQTT_USER  "smarthome"
#define MQTT_PASS  "smarthome_mqtt_2026"

// ── Pini senzori ─────────────────────────────────────────────
#define DHT1_PIN   4    // DHT11 #1 — living
#define DHT1_TYPE  DHT11
#define DHT2_PIN   23   // DHT11 #2 — dormitor
#define DHT2_TYPE  DHT11
#define MQ2_PIN    34   // ADC1 — analogRead 0–1023
#define LDR1_PIN   35   // ADC1 — analogRead 0–1023
#define LDR2_PIN   36   // ADC1 (VP) — analogRead 0–1023
#define PIR_PIN    14   // intrare digitala — miscare

// ── Pini actuatori ───────────────────────────────────────────
const int LED_PINS[4] = { 25, 26, 33, 32 }; // #0 living, #1 dormitor, #2 baie, #3 curte
#define LED_OUTDOOR  3   // index LED exterior (controlabil din app + automat la miscare)
#define BUZZER_PIN  13   // buzzer PASIV — folosim tone()
#define BUZZER_FREQ 3000 // Hz — frecventa tonului (buzzer pasiv suna tare ~3kHz)
#define SERVO_PIN   18   // servo jaluzele
#define FAN_PIN     19   // releu ventilator (ACTIVE-LOW, truc INPUT pt. oprire)

// ── Intervale ────────────────────────────────────────────────
#define PUBLISH_INTERVAL  5000   // ms între publicări senzori

/*
 * MQ-2 — calibrare automata de baseline + alerta pe delta:
 *   Dupa warm-up (~60s) masuram baseline-ul in aer curat. Alerta se declanseaza
 *   cand gazul depaseste (baseline + GAS_MARGIN). Baseline-ul se adapteaza lent
 *   (EMA) la driftul senzorului cat timp aerul e curat. Asa pragul nu depinde de
 *   valoarea absoluta (la fiecare senzor difera).
 */
#define GAS_WARMUP_MS  60000   // 60s pana incepem calibrarea
#define GAS_MARGIN     150     // cat peste baseline = alerta

/*
 * Control ventilator — manual + automat cu prag configurabil din app:
 *   AUTO (implicit): peste fanThreshold °C porneste, sub (prag-histerezis) opreste.
 *   MANUAL: fan_on/fan_off forteaza starea pana la fan_auto.
 */
#define FAN_THRESHOLD_DEFAULT  28.0f
#define FAN_HYSTERESIS          2.0f

// ── PIR — ignora primele secunde (calibrare senzor) ──────────
#define PIR_WARMUP_MS  60000

// ── Obiecte globale ───────────────────────────────────────────
DHT dht1(DHT1_PIN, DHT1_TYPE);
DHT dht2(DHT2_PIN, DHT2_TYPE);
Servo servoJaluzele;
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
Preferences prefs;

String wifiSsid, wifiPass, mqttHost;
unsigned long lastPublish = 0;
unsigned long bootMillis   = 0;

bool  ledState[4] = { false, false, false, false };
bool  fanState    = false;
bool  fanAuto     = true;
float fanThreshold = FAN_THRESHOLD_DEFAULT;

int   gasBaseline   = -1;       // -1 = necalibrat înca
bool  gasAlertActive = false;

bool  motionState       = false;
bool  motionAlertActive = false;
bool  motionArmed       = false;   // armat din telefon (mod alarma miscare)

/* ─── NVS: credentiale + config ventilator ───────────────── */
void loadCredentials() {
  prefs.begin("smarthome", false);
  wifiSsid = prefs.getString("wifi_ssid", DEFAULT_WIFI_SSID);
  wifiPass = prefs.getString("wifi_pass", DEFAULT_WIFI_PASS);
  mqttHost = prefs.getString("mqtt_host", DEFAULT_MQTT_HOST);
  fanAuto      = prefs.getBool("fan_auto", true);
  fanThreshold = prefs.getFloat("fan_thr", FAN_THRESHOLD_DEFAULT);
  motionArmed  = prefs.getBool("motion_arm", false);
  prefs.end();
  Serial.printf("[Config] WiFi: %s | MQTT: %s | Fan: %s @ %.1f C\n",
                wifiSsid.c_str(), mqttHost.c_str(),
                fanAuto ? "AUTO" : "MANUAL", fanThreshold);
}

void saveFanConfig() {
  prefs.begin("smarthome", false);
  prefs.putBool("fan_auto", fanAuto);
  prefs.putFloat("fan_thr", fanThreshold);
  prefs.end();
}

void saveMotionConfig() {
  prefs.begin("smarthome", false);
  prefs.putBool("motion_arm", motionArmed);
  prefs.end();
}

void saveCredentials(const String& ssid, const String& pass,
                     const String& host) {
  prefs.begin("smarthome", false);
  prefs.putString("wifi_ssid", ssid);
  prefs.putString("wifi_pass", pass);
  prefs.putString("mqtt_host", host);
  prefs.end();
  Serial.println("[Config] Credentiale salvate in NVS");
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
  // 1) Reteaua salvata in NVS (configurata din app prin wifi_update)
  if (tryWifi(wifiSsid.c_str(), wifiPass.c_str(), 20)) {
    Serial.printf("[WiFi] Conectat (salvata)! IP: %s\n",
                  WiFi.localIP().toString().c_str());
    return;
  }

  // 2) Hotspotul de setup ridicat de Raspberry Pi (provisioning prin MQTT)
  if (tryWifi(DEFAULT_WIFI_SSID, DEFAULT_WIFI_PASS, 20)) {
    wifiSsid = DEFAULT_WIFI_SSID;
    wifiPass = DEFAULT_WIFI_PASS;
    mqttHost = DEFAULT_MQTT_HOST;
    Serial.printf("[WiFi] Conectat (setup RPi)! IP: %s\n",
                  WiFi.localIP().toString().c_str());
    return;
  }

  // 3) Fallback: reteaua de acasa unde RPi e deja conectat (test direct)
  if (tryWifi(FALLBACK_WIFI_SSID, FALLBACK_WIFI_PASS, 30)) {
    wifiSsid = FALLBACK_WIFI_SSID;
    wifiPass = FALLBACK_WIFI_PASS;
    mqttHost = FALLBACK_MQTT_HOST;   // gasit prin mDNS smarthome.local
    Serial.printf("[WiFi] Conectat (fallback acasa)! IP: %s\n",
                  WiFi.localIP().toString().c_str());
    return;
  }

  Serial.println("[WiFi] Nicio retea disponibila — restart in 5s");
  delay(5000);
  ESP.restart();
}

/* ─── mDNS: smarthome.local → IP-ul Raspberry Pi ──────────── */
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
      Serial.printf("[mDNS] %s -> %s\n",
                    mqttHost.c_str(), ip.toString().c_str());
      return ip.toString();
    }
    delay(2000);
  }
  Serial.println("[mDNS] Esec — folosesc IP-ul default");
  return DEFAULT_MQTT_HOST;
}

/* ─── Actuatori ───────────────────────────────────────────── */

// LED (index 0–3: living, dormitor, baie, curte)
void setLed(int index, bool on) {
  if (index < 0 || index > 3) return;
  ledState[index] = on;
  digitalWrite(LED_PINS[index], on ? HIGH : LOW);
  Serial.printf("[LED %d] %s\n", index, on ? "PORNIT" : "OPRIT");
}

// Ventilator prin releu ACTIVE-LOW (truc INPUT pentru oprire completa)
void setFan(bool on) {
  fanState = on;
  if (on) {
    pinMode(FAN_PIN, OUTPUT);
    digitalWrite(FAN_PIN, LOW);   // 0V curat -> releu activat
  } else {
    pinMode(FAN_PIN, INPUT);      // liber -> pull-up modul (5V) -> oprit complet
  }
  Serial.printf("[Ventilator] %s\n", on ? "PORNIT" : "OPRIT");
}

// Buzzer pasiv — N bip-uri cu tone()
void beep(int count) {
  for (int i = 0; i < count; i++) {
    tone(BUZZER_PIN, BUZZER_FREQ); delay(180);
    noTone(BUZZER_PIN);            delay(120);
  }
}

// Sirena scurta (alarma) — alterneaza 2 frecvente
void siren(int cycles) {
  for (int i = 0; i < cycles; i++) {
    tone(BUZZER_PIN, 2200); delay(150);
    tone(BUZZER_PIN, 3500); delay(150);
  }
  noTone(BUZZER_PIN);
}

/* ─── Comenzi MQTT primite de la server ───────────────────── */
void onMessage(char* topic, byte* payload, unsigned int length) {
  String msg;
  msg.reserve(length);
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  Serial.printf("[MQTT] Comanda: %s\n", msg.c_str());

  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, msg)) {
    Serial.println("[MQTT] JSON invalid — ignorat");
    return;
  }
  String action = doc["action"] | "";

  if (action == "led_on") {
    setLed(doc["led"] | -1, true);
  }
  else if (action == "led_off") {
    setLed(doc["led"] | -1, false);
  }
  else if (action == "led_toggle") {
    int idx = doc["led"] | -1;
    if (idx >= 0 && idx <= 3) setLed(idx, !ledState[idx]);
  }
  else if (action == "fan_on") {
    fanAuto = false; setFan(true); saveFanConfig();
  }
  else if (action == "fan_off") {
    fanAuto = false; setFan(false); saveFanConfig();
  }
  else if (action == "fan_auto") {
    fanAuto = true; saveFanConfig();
    Serial.println("[Fan] Mod AUTO");
  }
  else if (action == "fan_threshold") {
    float t = (float)(doc["value"] | (double)FAN_THRESHOLD_DEFAULT);
    fanThreshold = constrain(t, 10.0f, 40.0f);
    saveFanConfig();
    Serial.printf("[Fan] Prag automat: %.1f C\n", fanThreshold);
  }
  else if (action == "motion_arm") {
    motionArmed = true; saveMotionConfig();
    Serial.println("[PIR] ARMAT (detectie miscare pornita)");
  }
  else if (action == "motion_disarm") {
    motionArmed = false; saveMotionConfig();
    digitalWrite(LED_PINS[LED_OUTDOOR], ledState[LED_OUTDOOR] ? HIGH : LOW); // revine la starea manuala
    motionState = false; motionAlertActive = false;
    Serial.println("[PIR] DEZARMAT (detectie miscare oprita)");
  }
  else if (action == "servo_move") {
    int angle = constrain((int)(doc["servoAngle"] | 0), 0, 180);
    servoJaluzele.write(angle);
    Serial.printf("[Servo] %d grade\n", angle);
  }
  else if (action == "buzzer_beep") {
    beep(doc["count"] | 1);
  }
  else if (action == "all_off") {
    for (int i = 0; i < 4; i++) setLed(i, false);
    fanAuto = false; setFan(false); saveFanConfig();
    servoJaluzele.write(0);
    Serial.println("[all_off] Toate actuatoarele oprite");
  }
  else if (action == "wifi_update") {
    String newSsid = doc["ssid"]      | "";
    String newPass = doc["password"]  | "";
    String newHost = doc["mqtt_host"] | "";
    if (newSsid.isEmpty()) {
      Serial.println("[Setup] wifi_update fara SSID — ignorat");
      return;
    }
    if (newHost.isEmpty()) newHost = "smarthome.local";
    Serial.printf("[Setup] WiFi nou: %s -> restart in 3s\n", newSsid.c_str());
    saveCredentials(newSsid, newPass, newHost);
    delay(3000);
    ESP.restart();
  }
  else {
    Serial.printf("[MQTT] Actiune necunoscuta: %s\n", action.c_str());
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
    Serial.printf(" Eroare: %d — reincerc in 3s\n", mqtt.state());
    if (++attempts >= 10) {
      Serial.println("[MQTT] Broker negasit dupa 10 incercari — restart");
      delay(1000);
      ESP.restart();
    }
    delay(3000);
  }
}

/* ─── Citire ADC mediata (reduce zgomotul) ────────────────── */
int readAvg(int pin, int samples) {
  long sum = 0;
  for (int i = 0; i < samples; i++) { sum += analogRead(pin); delay(2); }
  return (int)(sum / samples);
}

/* ─── Alerta gaz (front crescator) ────────────────────────── */
void publishGasAlert(int level, int prag) {
  StaticJsonDocument<192> doc;
  doc["node_id"]    = NODE_ID;
  doc["alert_type"] = "GAS_DETECTED";
  doc["location"]   = LOCATION;
  JsonObject d = doc.createNestedObject("details");
  d["nivel"] = level;
  d["prag"]  = prag;
  char payload[192];
  serializeJson(doc, payload);
  mqtt.publish("smarthome/alerts", payload, false);
  Serial.printf("[ALERTA] Gaz %d > %d — trimisa la server\n", level, prag);
}

/* ─── Alerta miscare (front crescator) ────────────────────── */
void publishMotionAlert() {
  StaticJsonDocument<160> doc;
  doc["node_id"]    = NODE_ID;
  doc["alert_type"] = "MOTION_DETECTED";
  doc["location"]   = "curte";
  char payload[160];
  serializeJson(doc, payload);
  mqtt.publish("smarthome/alerts", payload, false);
  Serial.println("[ALERTA] Miscare detectata — trimisa la server");
}

/* ─── PIR: bec exterior + alarma + alerta (rulat des in loop) ─ */
void handleMotion() {
  // Dezarmat din telefon -> nu detectam nimic
  if (!motionArmed) return;

  // Ignora primele secunde (PIR-ul se calibreaza)
  if (millis() - bootMillis < PIR_WARMUP_MS) return;

  bool m = (digitalRead(PIR_PIN) == HIGH);

  if (m && !motionState) {                       // front crescator
    digitalWrite(LED_PINS[LED_OUTDOOR], HIGH);   // aprinde becul de afara
    beep(1);                                     // bip scurt de avertizare
    if (mqtt.connected() && !motionAlertActive) publishMotionAlert();
    motionAlertActive = true;
    Serial.println("[PIR] Miscare!");
  } else if (!m && motionState) {                // front descrescator
    digitalWrite(LED_PINS[LED_OUTDOOR], ledState[LED_OUTDOOR] ? HIGH : LOW); // revine la manual
    motionAlertActive = false;
  }
  motionState = m;
}

/* ─── Citire senzori si publicare MQTT ────────────────────── */
void publishSensors() {
  float temp1  = dht1.readTemperature();
  float humid1 = dht1.readHumidity();
  float temp2  = dht2.readTemperature();
  float humid2 = dht2.readHumidity();

  bool dht1ok = !isnan(temp1) && !isnan(humid1);
  bool dht2ok = !isnan(temp2) && !isnan(humid2);

  // Chiar daca ambele DHT esueaza, publicam restul (gaz, lumina, miscare, fan).
  // Doar omitem campurile de temperatura/umiditate care lipsesc.
  if (!dht1ok && !dht2ok)
    Serial.println("[DHT] Ambii senzori in eroare — public restul fara temperatura");

  // MQ-2 + LDR (ADC1, 10 biti), mediate
  int gas    = readAvg(MQ2_PIN, 5);
  int light1 = readAvg(LDR1_PIN, 3);
  int light2 = readAvg(LDR2_PIN, 3);

  // Calibrare automata baseline gaz dupa warm-up
  if (gasBaseline < 0 && millis() - bootMillis > GAS_WARMUP_MS) {
    gasBaseline = gas;
    Serial.printf("[MQ2] Baseline calibrat: %d (prag alerta = %d)\n",
                  gasBaseline, gasBaseline + GAS_MARGIN);
  }

  bool gasAlert = false;
  if (gasBaseline >= 0) {
    int prag = gasBaseline + GAS_MARGIN;
    gasAlert = (gas > prag);
    if (gasAlert && !gasAlertActive) {
      publishGasAlert(gas, prag);
      siren(3);                       // alarma sonora locala imediata
    }
    gasAlertActive = gasAlert;
    // Adaptare lenta a baseline-ului cat timp aerul e curat (drift senzor)
    if (!gasAlert && gas < gasBaseline + GAS_MARGIN / 2)
      gasBaseline = (int)(gasBaseline * 0.98f + gas * 0.02f);
  }

  // Control automat ventilator (mod AUTO) — doar daca avem o temperatura valida
  if (fanAuto && (dht1ok || dht2ok)) {
    float tempAvg = dht1ok && dht2ok ? (temp1 + temp2) / 2.0f
                  : dht1ok           ? temp1
                  :                    temp2;
    if (!fanState && tempAvg >= fanThreshold) {
      setFan(true);
      Serial.printf("[AutoFan] %.1f C >= prag %.1f C — PORNIT\n",
                    tempAvg, fanThreshold);
    } else if (fanState && tempAvg <= fanThreshold - FAN_HYSTERESIS) {
      setFan(false);
      Serial.printf("[AutoFan] %.1f C <= %.1f C — OPRIT\n",
                    tempAvg, fanThreshold - FAN_HYSTERESIS);
    }
  }

  // Payload JSON (contract comun cu backend si mobile)
  StaticJsonDocument<384> doc;
  doc["nodeId"]   = NODE_ID;
  doc["location"] = LOCATION;
  if (dht1ok) {
    doc["temperature"] = (float)(round(temp1  * 10.0f) / 10.0f);
    doc["humidity"]    = (float)(round(humid1 * 10.0f) / 10.0f);
  }
  if (dht2ok) {
    doc["temperature2"] = (float)(round(temp2  * 10.0f) / 10.0f);
    doc["humidity2"]    = (float)(round(humid2 * 10.0f) / 10.0f);
  }
  doc["gasLevel"] = gas;
  doc["gasAlert"] = gasAlert;
  doc["light1"]   = light1;
  doc["light2"]   = light2;
  doc["lightLux"] = light1;          // alias pentru UI
  doc["motion"]      = motionState;
  doc["motionArmed"] = motionArmed;
  doc["fanOn"]        = fanState;
  doc["fanAuto"]      = fanAuto;
  doc["fanThreshold"] = (float)(round(fanThreshold * 10.0f) / 10.0f);

  char payload[384];
  serializeJson(doc, payload);
  mqtt.publish("smarthome/" NODE_ID "/sensors", payload);

  Serial.printf(
    "[Senzori] T1=%.1f/%.0f%% T2=%.1f/%.0f%% Gaz=%d%s LDR1=%d LDR2=%d Misc=%d\n",
    dht1ok ? temp1 : 0.0f, dht1ok ? humid1 : 0.0f,
    dht2ok ? temp2 : 0.0f, dht2ok ? humid2 : 0.0f,
    gas, gasAlert ? " (!)" : "", light1, light2, motionState);
}

/* ─── Setup ───────────────────────────────────────────────── */
void setup() {
  Serial.begin(115200);
  Serial.println("\n[Boot] Smart Home — " NODE_ID " (" LOCATION ")");
  bootMillis = millis();

  analogReadResolution(10);          // 0–1023

  // LED-uri (3 interior + 1 exterior/curte)
  for (int i = 0; i < 4; i++) {
    pinMode(LED_PINS[i], OUTPUT);
    digitalWrite(LED_PINS[i], LOW);
  }
  pinMode(PIR_PIN, INPUT);

  // Buzzer pasiv
  pinMode(BUZZER_PIN, OUTPUT);
  noTone(BUZZER_PIN);

  // Ventilator OPRIT la boot = pin in INPUT (releu active-LOW)
  pinMode(FAN_PIN, INPUT);
  fanState = false;

  // ADC input-only
  pinMode(MQ2_PIN,  INPUT);
  pinMode(LDR1_PIN, INPUT);
  pinMode(LDR2_PIN, INPUT);

  // Servo (jaluzele inchise la 0°). Un timer dedicat pentru servo.
  ESP32PWM::allocateTimer(0);
  servoJaluzele.setPeriodHertz(50);
  servoJaluzele.attach(SERVO_PIN, 500, 2400);
  servoJaluzele.write(0);

  dht1.begin();
  dht2.begin();

  loadCredentials();
  connectWifi();
  connectMqtt();

  Serial.println("[Boot] Gata! (MQ2 si PIR se calibreaza ~60s)");
}

/* ─── Loop ────────────────────────────────────────────────── */
void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWifi();
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();

  handleMotion();                    // PIR verificat des (reactie rapida)

  if (millis() - lastPublish >= PUBLISH_INTERVAL) {
    lastPublish = millis();
    publishSensors();
  }
}
