# Ghid Conexiuni Software — nodurile ESP32 ↔ Gateway ↔ Aplicație

> **Document:** 06 — completează [hardware_breadboard_guide.md](hardware_breadboard_guide.md) (pinii fizici)
> cu tot ce înseamnă **software**: protocoale, topicuri MQTT, payload-uri, firmware, provisioning.
> Ultima actualizare: 2026-06-11

---

## 1. Arhitectura completă

```
┌───────────────────────────────────┐   ┌─────────────────────────┐
│  Nod interior — esp32_node_a      │   │ Curte — esp32_cam_node  │
│  Bucătărie: MQ-2 gaz + buzzer     │   │  cameră OV2640          │
│  Living: DHT11, BH1750, servo     │   │  PIR mișcare (GPIO13)   │
│          perdele, releu 0=lumină  │   │  LED auto 30s (GPIO12)  │
│  Dormitor: releu 1=lumină         │   │                         │
└───────────────┬───────────────────┘   └────┬──────────────┬─────┘
                │ MQTT 1883                  │ MQTT 1883    │ HTTP :80
                ▼                            ▼              │ /stream /capture
┌──────────────────────────────────────────────────┐       │
│      Raspberry Pi 3B+ — „smarthome.local"        │       │
│  Mosquitto :1883 → NestJS API :3000 → PG :5432   │       │
│  + smarthome-wifi.service (hotspot fallback)     │       │
│  + avahi (mDNS) + ML Isolation Forest            │       │
└──────────────────────┬───────────────────────────┘       │
                       │ HTTP/WebSocket :3000              │
                       ▼                                   ▼
              ┌─────────────────┐ ◄────── direct ──────────┘
              │   iPhone App    │   (stream-ul NU trece prin RPi)
              └─────────────────┘
```

> Al doilea ESP32 WROOM rămâne rezervă — sketch-ul nodului e configurabil
> (3 linii) dacă vrei vreodată un al doilea nod interior.

**Principiu:** nodurile ESP32 vorbesc **doar MQTT** cu RPi. Aplicația vorbește **doar HTTP/WS**
cu API-ul — excepție camera, pe care app-ul o accesează direct pe HTTP (stream-ul video
nu are sens să treacă prin RPi).

---

## 2. Firmware — ce se flashează pe fiecare placă

| Placă | Sketch | Config în sketch |
|---|---|---|
| Nod interior | `firmware/esp32_node/esp32_node.ino` | implicit: `NODE_ID "esp32_node_a"`, `LOCATION "interior"`, `HAS_SERVO 1` |
| Camera (curte) | `firmware/esp32_cam/esp32_cam.ino` | nimic de schimbat |

Maparea releelor pe nodul interior: **releu 0 = lumină living (GPIO26)**,
**releu 1 = lumină dormitor (GPIO25)**; GPIO33/32 rămân libere pentru extinderi.

> `firmware/esp32_dht11/` este versiunea veche (doar DHT11), păstrată ca referință istorică.
> Folderul `esp32/` (MicroPython) este abordarea abandonată — nu se mai folosește.

### Librării Arduino IDE (Library Manager)

| Librărie | Autor | Pentru |
|---|---|---|
| DHT sensor library | Adafruit | DHT11/DHT22 |
| Adafruit Unified Sensor | Adafruit | dependența DHT |
| BH1750 | Christopher Laws | senzor lumină I2C |
| PubSubClient | Nick O'Leary | MQTT |
| ArduinoJson | Benoit Blanchon | payload-uri JSON |
| ESP32Servo | Kevin Harrington | servo SG90 (doar Nod A) |

Placă în IDE: **ESP32 Dev Module** (nodurile A/B) · **AI Thinker ESP32-CAM** (camera, PSRAM: Enabled).

### Flash

1. Nodurile A/B: USB direct; dacă apare `Wrong boot mode` → ține **BOOT**, apasă-eliberează **EN**, eliberează **BOOT**.
2. ESP32-CAM: necesită adaptor USB-serial (FTDI); **GPIO0 la GND** în timpul upload-ului, apoi scoate puntea + reset.

---

## 3. Protocolul MQTT — contractul dintre noduri și server

Broker: Mosquitto pe RPi, port `1883`, user `smarthome`, parolă `smarthome_mqtt_2026`.

### 3.1 Noduri → Server

| Topic | Cine publică | Când | Payload |
|---|---|---|---|
| `smarthome/{nodeId}/sensors` | A, B | la 5 s | vezi mai jos |
| `smarthome/{nodeId}/status` | A, B, CAM | la conectare + LWT; CAM și heartbeat 30 s | `{"node_id":"esp32_node_a","status":"online"}` |
| `smarthome/alerts` | A, B | gaz > prag (doar front crescător) | `{"node_id":"...","alert_type":"GAS_DETECTED","location":"living","details":{"nivel":412,"prag":350}}` |

Payload senzori (JSON **flat** — exact câmpurile pe care le mapează `api/src/mqtt/mqtt.service.ts`):
```json
{
  "nodeId": "esp32_node_a",
  "location": "living",
  "temperature": 22.4,
  "humidity": 47.0,
  "gasLevel": 148,
  "gasAlert": false,
  "motion": true,
  "lightLux": 312
}
```
- `gasLevel`: ADC pe **10 biți (0–1023)** — firmware-ul setează `analogReadResolution(10)`;
  pragul de alertă e `350` (aceeași scară e folosită de bara de gaz din aplicație).
- `status` cu **LWT (Last Will)**: dacă nodul pică (curent/WiFi), brokerul publică singur
  `offline` → aplicația arată nodul gri, fără cod suplimentar.

### 3.2 Server → Noduri (topic `smarthome/{nodeId}/commands`)

| Acțiune | Payload | Cine o execută |
|---|---|---|
| Releu pornit/oprit | `{"action":"relay_on","relay":0}` / `relay_off` / `relay_toggle` | A, B |
| Buzzer | `{"action":"buzzer_beep","count":2}` | A, B |
| Totul oprit | `{"action":"all_off"}` | A, B |
| Perdele | `{"action":"servo_move","servoAngle":90}` | doar A |
| Schimbare WiFi | `{"action":"wifi_update","ssid":"...","password":"...","mqtt_host":"smarthome.local"}` | A, B, CAM |

Fluxul unei comenzi din aplicație: **App → POST /api/commands/{nodeId} → CommandsService →
EventEmitter `command.sent` → MqttService → publish pe topic → nodul execută**.

### 3.3 Camera (HTTP direct, fără MQTT pentru video)

| Endpoint | Folosit de | Descriere |
|---|---|---|
| `http://<ip-cam>/capture` | ControlScreen (snapshot la 5 s) | un cadru JPEG |
| `http://<ip-cam>/stream` | modalul „Vezi live" | MJPEG continuu |

IP-ul camerei se setează în aplicație prin `EXPO_PUBLIC_CAMERA_HOST` (vezi
`mobile/src/services/config.ts`). Camera se anunță și pe mDNS ca `smarthome-cam.local`.

---

## 4. WiFi provisioning — cum migrează tot sistemul în altă casă

Toate cele 3 noduri folosesc **același mecanism** (NVS namespace `smarthome`):

```
1. Boot → încearcă WiFi-ul salvat în NVS (20 încercări × 0.5 s)
2. Eșec → fallback pe hotspotul RPi: SmartHome-Setup / smarthome2026 (192.168.4.1)
3. RPi (fără WiFi cunoscut) și-a pornit singur hotspotul (smarthome-wifi.service)
4. Telefonul: app → Setup → alege rețeaua nouă + parola
5. RPi trimite wifi_update pe MQTT către TOATE nodurile aflate pe hotspot
6. Nodurile salvează în NVS → restart → se conectează la noua rețea
7. Pe noua rețea, nodurile găsesc brokerul prin mDNS: smarthome.local → IP
```

Detalii de robustețe (implementate în firmware):
- `smarthome.local` se rezolvă prin **ESPmDNS** (`MDNS.queryHost`), nu prin DNS — pe orice rețea;
- MQTT are **retry limitat (10×3 s) → restart**, fără ștergerea credențialelor — un RPi
  care rebootează nu scoate nodurile de pe rețea;
- dacă nici WiFi salvat, nici hotspotul nu răspund → restart la 5 s și reluare.

---

## 5. Verificare end-to-end (de pe Mac sau RPi)

```bash
# 1. Vezi tot traficul senzorilor (de pe RPi)
mosquitto_sub -h localhost -u smarthome -P smarthome_mqtt_2026 -t "smarthome/#" -v

# 2. Simulează o comandă de releu către Nodul A
mosquitto_pub -h localhost -u smarthome -P smarthome_mqtt_2026 \
  -t "smarthome/esp32_node_a/commands" -m '{"action":"relay_toggle","relay":0}'

# 3. Test buzzer
mosquitto_pub -h localhost -u smarthome -P smarthome_mqtt_2026 \
  -t "smarthome/esp32_node_a/commands" -m '{"action":"buzzer_beep","count":2}'

# 4. Test servo (perdele 50%)
mosquitto_pub -h localhost -u smarthome -P smarthome_mqtt_2026 \
  -t "smarthome/esp32_node_a/commands" -m '{"action":"servo_move","servoAngle":90}'

# 5. Camera (din browser, pe aceeași rețea)
open http://<ip-cam>/capture

# 6. Verifică datele ajunse în DB
psql -U smarthome -d smarthome_db \
  -c "SELECT node_id, temperature, gas_level, motion FROM sensor_readings ORDER BY timestamp DESC LIMIT 5;"
```

Test de alertă gaz fără gaz real: apropie o brichetă **neaprinsă** (doar gazul) de MQ-2,
sau scade temporar `GAS_THRESHOLD` în firmware la o valoare sub citirea ambientală.

---

## 6. Troubleshooting rapid

| Simptom | Cauză probabilă | Fix |
|---|---|---|
| Nodul nu apare în app | nu publică `status` | verifică serial monitor: MQTT conectat? user/parolă? |
| `MQTT Eroare: 5` | not authorised | parola din firmware ≠ `/etc/mosquitto/passwd` |
| `MQTT Eroare: -2` | broker negăsit | mDNS eșuat → verifică `avahi-daemon` pe RPi |
| DHT citește NaN | pull-up lipsă / fire lungi | rezistor 10 kΩ între DATA și 3.3 V |
| BH1750 „Negăsit pe I2C" | SDA/SCL inversate | SDA=GPIO21, SCL=GPIO22; ADDR la GND |
| Releele pornesc invers | modul activ-HIGH | `RELAY_ACTIVE_LOW false` în firmware |
| Camera nu pornește | alimentare slabă | ESP32-CAM cere 5 V/2 A pe pinul 5V, nu de la FTDI |
| Stream sacadat | WiFi slab / frame mare | `FRAMESIZE_VGA` + `jpeg_quality 15` |
| Gaz mereu în alertă | MQ-2 neîncălzit | senzorul are nevoie de 2-3 min „burn-in" după pornire |
