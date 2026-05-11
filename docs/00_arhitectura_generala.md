# Sistem Smart Home Local-First — Arhitectură Generală

> **Titlu lucrare:** Sistem Smart Home local-first cu detecție de anomalii comportamentale bazată pe procesare edge
> **Autor:** Chiril
> **Universitate:** Politehnica Timișoara — Ingineria Sistemelor
> **An:** 2025-2026

---

## 1. Viziune și principii de design

Sistemul este construit pe trei principii fundamentale care îl diferențiază de soluțiile comerciale existente (Google Home, Amazon Alexa, Tuya):

### 1.1 Local-first
Toate deciziile, automatizările și alertele se execută **pe Raspberry Pi**, fără niciun apel către internet. Dacă conexiunea la internet cade, sistemul continuă să funcționeze identic. Internetul este folosit exclusiv pentru notificări externe opționale (Telegram, SMS) și acces remote la dashboard.

### 1.2 Privacy by design
Datele senzorilor nu părăsesc rețeaua locală în mod automat. Nu există un cont cloud, nu există telemetrie trimisă către terți. Utilizatorul deține complet datele generate de sistemul său.

### 1.3 Edge intelligence
În loc de reguli statice hardcodate (`if temperature > 30 → fan on`), sistemul **învață pattern-urile normale** ale casei și detectează automat comportamente anormale folosind un model de machine learning rulat local pe Raspberry Pi.

---

## 2. Arhitectura pe layere

Sistemul este organizat în 5 layere funcționale, fiecare cu responsabilități clare și interfețe bine definite.

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 5 — Client & Notificări                          │
│  React Native App  │  Push / Telegram / SMS             │
└────────────────────────────┬────────────────────────────┘
                             │ HTTP REST / WebSocket
┌────────────────────────────▼────────────────────────────┐
│  LAYER 4 — Backend API                                  │
│  Node.js + NestJS  │  REST + WebSocket + JWT Auth       │
└────────────────────────────┬────────────────────────────┘
                             │ internal (same device)
┌────────────────────────────▼────────────────────────────┐
│  LAYER 3 — Raspberry Pi 3B+ Gateway              [RPi]  │
│  Mosquitto MQTT  │  Python ML Engine               │    │
│  TimescaleDB     │  PostgreSQL  │  Rule Engine     │    │
└────────────────────────────┬────────────────────────────┘
                             │ MQTT over TLS (port 8883)
┌────────────────────────────▼────────────────────────────┐
│  LAYER 2 — ESP32 Noduri                                 │
│  ESP32-C3 Node A (living/bucătărie)                     │
│  ESP32-C3 Node B (dormitor/baie)                        │
└────────────────────────────┬────────────────────────────┘
                             │ GPIO / I2C / digital
┌────────────────────────────▼────────────────────────────┐
│  LAYER 1 — Senzori & Actuatori                          │
│  DHT22 │ MQ2 │ PIR │ BH1750 │ Relay │ Buzzer │ LED     │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Descrierea fiecărui layer

### Layer 1 — Senzori & Actuatori

Stratul fizic al sistemului. Senzorii colectează date din mediu, actuatorii execută comenzi.

**Senzori:**

| Senzor | Model | Protocol | Ce măsoară |
|--------|-------|----------|------------|
| Temperatură & umiditate | DHT22 | GPIO one-wire | 0-100°C, 0-100% RH |
| Gaz & fum | MQ2 | GPIO analogic/digital | LPG, CO, fum |
| Mișcare | HC-SR501 PIR | GPIO digital | Prezență umană |
| Lumină ambientală | BH1750 | I2C | 0-65535 lux |

**Actuatori:**

| Actuator | Model | Protocol | Ce controlează |
|----------|-------|----------|----------------|
| Relay | Modul 4-channel 5V | GPIO digital | Prize, lumini, ventilator |
| Buzzer | Buzzer activ 5V | GPIO digital | Alertă sonoră locală |
| LED / bandă LED | WS2812B sau simplu | GPIO PWM | Indicatori vizuali |

**Notă importantă:** Releele și buzzerul necesită o **sursă separată de 5V** față de ESP32. Nu se alimentează din pinii ESP32 — curentul maxim pe GPIO este 12mA, insuficient pentru relee.

---

### Layer 2 — Noduri ESP32

Microcontrolerele ESP32-C3 sunt "creierul local" al fiecărei zone. Citesc senzorii, controlează actuatorii și comunică cu gateway-ul prin Wi-Fi.

**Responsabilități:**
- Citire senzori la interval configurabil (implicit: 30 secunde)
- Publicare date pe broker MQTT în format JSON
- Primire comenzi de la gateway (control relay/buzzer)
- Alertă locală imediată (buzzer pornit direct pe ESP32 fără să aștepte gateway) pentru situații critice (gaz detectat)

**Structura unui mesaj MQTT publicat de ESP32:**

```json
{
  "node_id": "esp32_node_a",
  "timestamp": 1710000000,
  "sensors": {
    "temperature": 23.4,
    "humidity": 58.2,
    "gas_level": 120,
    "gas_alert": false,
    "motion": false,
    "light_lux": 340
  }
}
```

**Topic-uri MQTT:**

```
home/node_a/sensors        → ESP32 publică date
home/node_b/sensors        → ESP32 publică date
home/node_a/commands       → Gateway trimite comenzi
home/node_b/commands       → Gateway trimite comenzi
home/alerts                → Alerte critice (gaz, foc)
```

**Stack software ESP32:**
- Limbaj: MicroPython (recomandat pentru prototip) sau ESP-IDF în C
- Librărie MQTT: `umqtt.simple` (MicroPython) sau `esp-mqtt` (IDF)
- TLS: certificat self-signed generat pe Raspberry Pi

---

### Layer 3 — Raspberry Pi 3B+ Gateway

Inima sistemului. Toate serviciile rulează pe Raspberry Pi. Acesta este singurul dispozitiv care are acces la toate datele și ia decizii.

**Servicii care rulează:**

| Serviciu | Port | Rol |
|----------|------|-----|
| Mosquitto | 8883 (TLS) | MQTT broker — primește date de la ESP32 |
| TimescaleDB | 5432 | Stocare time-series date senzori |
| PostgreSQL | 5432 | Același proces — users, reguli, config |
| Python ML Engine | — | Script periodic, nu server permanent |
| NestJS API | 3000 | REST API + WebSocket pentru mobile app |

**Flux de date intern pe Raspberry Pi:**

```
Mosquitto (date primite)
    │
    ▼
Node.js MQTT subscriber
    │
    ├──► TimescaleDB (INSERT date senzori)
    │
    ├──► Rule Engine (verifică reguli hardcodate)
    │         │
    │         └──► dacă regulă activată → publish MQTT command
    │
    └──► Anomaly Scorer (scor model ML curent)
              │
              └──► dacă anomalie → trigger alertă
```

**TimescaleDB vs InfluxDB — de ce TimescaleDB pe 3B+:**
- InfluxDB 2.x cere 1-2GB RAM — imposibil pe 3B+ cu 1GB total
- TimescaleDB este o extensie PostgreSQL — un singur proces, ~300MB RAM total cu PostgreSQL
- SQL standard — mai ușor de integrat cu NestJS prin TypeORM sau Prisma
- La fel de performant pentru volumul unui sistem casnic (câteva milioane de rânduri/an)

**Schema tabel principal TimescaleDB:**

```sql
CREATE TABLE sensor_readings (
  time        TIMESTAMPTZ NOT NULL,
  node_id     TEXT NOT NULL,
  temperature FLOAT,
  humidity    FLOAT,
  gas_level   INTEGER,
  gas_alert   BOOLEAN DEFAULT FALSE,
  motion      BOOLEAN DEFAULT FALSE,
  light_lux   INTEGER
);

SELECT create_hypertable('sensor_readings', 'time');
```

---

### Layer 4 — Backend API

API-ul expune datele și funcționalitățile sistemului către aplicația mobilă. Rulează pe același Raspberry Pi, comunicând direct cu bazele de date prin conexiuni locale (fără overhead de rețea).

**Tehnologie:** Node.js + NestJS (același stack cu care ești familiar din Lavial/RIVA)

**Endpoints principali:**

```
GET  /api/sensors/latest          → ultimele citiri toate nodurile
GET  /api/sensors/history         → istoric cu filtre time range
GET  /api/sensors/:nodeId         → date nod specific
POST /api/commands/:nodeId        → trimite comandă actuator
GET  /api/rules                   → listează reguli automatizare
POST /api/rules                   → creează regulă nouă
PUT  /api/rules/:id               → modifică regulă
GET  /api/alerts                  → istoric alerte
POST /auth/login                  → JWT token
WS   /ws/live                     → stream date live via WebSocket
```

**Autentificare:** JWT cu httpOnly cookies — identic cu ce ai construit deja în proiectele anterioare.

**WebSocket:** Când Mosquitto primește date noi de la ESP32, NestJS le emite imediat prin WebSocket către aplicația mobilă conectată. Latență end-to-end sub 100ms pe rețea locală.

---

### Layer 5 — Client & Notificări

**React Native + Expo** — aplicație mobilă care rulează pe iOS și Android.

**Funcționalități:**

1. **Dashboard live** — date senzori în timp real via WebSocket, actualizate automat
2. **Control manual** — pornire/oprire relay, buzzer, LED din aplicație
3. **Istoric & grafice** — grafice temperatură, umiditate, lux pe intervale selectabile
4. **Alertă push locală** — notificare pe telefon când se detectează gaz, fum sau anomalie ML
5. **Home screen widget** — status sumar (temperatură, alertă activă) fără a deschide aplicația
6. **Offline mode** — ultimele date cunoscute afișate din cache local (MMKV) când telefonul nu e pe rețeaua locală

**Notificări externe (opționale, necesită internet):**
- Telegram Bot API — mesaj instant când apare alertă
- SMS prin Twilio sau SMS Gateway românesc
- Email prin Resend sau SendGrid

---

## 4. Protocolul de comunicare — MQTT over TLS

### De ce MQTT și nu CoAP sau HTTP?

| Criteriu | MQTT | CoAP | HTTP |
|----------|------|------|------|
| Overhead | Foarte mic (2 bytes header) | Mic | Mare |
| Model | Pub/Sub (asincron) | Req/Res | Req/Res |
| QoS | 0, 1, 2 (garantat) | Basic | Prin retry manual |
| Maturitate | Foarte mare | Mediu | Foarte mare |
| Librării ESP32 | Excelente | Limitate | Bune |
| Potrivit pentru IoT | Perfect | Bun | Suboptimal |

MQTT cu **QoS 1** (cel puțin o dată) pentru date senzori normale și **QoS 2** (exact o dată) pentru alerte critice.

### Securitate TLS

Conexiunea MQTT între ESP32 și Raspberry Pi este criptată cu TLS mutual:

```
ESP32                          Raspberry Pi (Mosquitto)
  │                                      │
  │──── TLS Handshake ──────────────────►│
  │     (certificat client)              │
  │◄─── Verificare certificat ───────────│
  │                                      │
  │══════ MQTT over TLS (port 8883) ════►│
```

Certificatele sunt self-signed, generate cu OpenSSL pe Raspberry Pi. Nu necesită CA extern.

---

## 5. ML Engine — Isolation Forest pentru detecție anomalii

### Conceptul

Isolation Forest este un algoritm de detecție anomalii care **izolează** punctele anormale în loc să modeleze comportamentul normal. Funcționează prin construirea de arbori de decizie aleatori — punctele anormale sunt izolate rapid (arbori scurți), cele normale necesită mai mulți pași.

### De ce Isolation Forest și nu altceva?

- **Nu necesită date etichetate** — nu știi dinainte ce e "anormal"
- **Eficient pe hardware slab** — rulează confortabil pe Raspberry Pi 3B+
- **Puțini hiperparametri** — practic doar `contamination` (proporția estimată de anomalii)
- **Explicabil** — poți arăta feature importance în lucrare

### Features folosite

```python
features = [
    'temperature',
    'humidity',
    'gas_level',
    'light_lux',
    'motion',           # 0 sau 1
    'hour_of_day',      # 0-23
    'day_of_week',      # 0-6
    'temp_delta_1h',    # diferența față de acum 1 oră
    'motion_count_1h'   # câte detecții de mișcare în ultima oră
]
```

### Pipeline ML complet

```
Faza 1 — Colectare (primele 14 zile):
  ESP32 → MQTT → TimescaleDB
  Niciun model activ, doar reguli hardcodate

Faza 2 — Antrenare inițială (ziua 15):
  Script Python citește 14 zile din TimescaleDB
  Antrenează IsolationForest(contamination=0.05)
  Salvează model ca model_v1.pkl

Faza 3 — Inferență continuă:
  La fiecare citire nouă → scorare cu modelul curent
  Score < -0.1 → anomalie → alertă

Faza 4 — Reantrenare periodică:
  Cron job zilnic la 03:00
  Reantrenează pe ultimele 30 de zile
  Înlocuiește model vechi cu model nou
```

### Cold start — problema și soluția

Primele 14 zile sistemul nu are model ML. Soluție: reguli hardcodate ca fallback:

```python
HARDCODED_RULES = [
    {"sensor": "gas_level",   "operator": ">",  "threshold": 300,  "action": "ALERT_GAS"},
    {"sensor": "temperature", "operator": ">",  "threshold": 35,   "action": "ALERT_HEAT"},
    {"sensor": "temperature", "operator": "<",  "threshold": 5,    "action": "ALERT_COLD"},
    {"sensor": "motion",      "operator": "==", "threshold": True, "time_range": "23:00-06:00", "action": "ALERT_MOTION_NIGHT"},
]
```

Aceste reguli rămân active și după antrenarea modelului, ca al doilea strat de siguranță.

---

## 6. Scenarii de funcționare demonstrate

### Scenariu 1 — Alertă gaz (critic, fără ML)
```
MQ2 detectează gaz (nivel > 300)
  → ESP32: pornește buzzer LOCAL imediat
  → ESP32: publică pe home/alerts (QoS 2)
  → Raspberry Pi: primește alertă
  → Rule Engine: oprește relay gaz/electric
  → NestJS: notificare push pe telefon + Telegram
  → TimescaleDB: înregistrează evenimentul
```

### Scenariu 2 — Automatizare lumină (regulă simplă)
```
PIR detectează mișcare la 02:30
  → ESP32: publică pe home/node_a/sensors
  → Rule Engine: verifică regulă "motion_night"
  → Condiție: motion=true AND hour BETWEEN 23 AND 6
  → Acțiune: publică comandă pe home/node_a/commands
  → ESP32: pornește relay lumină
  → Oprire automată după 5 minute (timer în Rule Engine)
```

### Scenariu 3 — Anomalie detectată de ML
```
Temperatura crește la 28°C la ora 06:00 (normal 19°C la acea oră)
  → Isolation Forest scorează citirea: -0.15 (anomalie)
  → Nivelul absolut NU depășește threshold-ul hardcodat (35°C)
  → Dar modelul știe că 28°C la 06:00 e neobișnuit pentru această casă
  → Alertă "anomalie comportamentală — temperatură neobișnuită"
  → Utilizatorul verifică și descoperă că a uitat fereastra deschisă iarna
```

Scenariul 3 este **contribuția originală** față de orice sistem cu reguli statice.

---

## 7. Structura repository Git

```
smart-home/
├── esp32/
│   ├── node_a/
│   │   ├── main.py          # MicroPython entry point
│   │   ├── mqtt_client.py   # MQTT connection + publish
│   │   ├── sensors.py       # DHT22, MQ2, PIR, BH1750 drivers
│   │   └── config.py        # WiFi credentials, broker address
│   └── node_b/
│       └── ...              # Similar cu node_a
│
├── gateway/
│   ├── mosquitto/
│   │   ├── mosquitto.conf
│   │   └── certs/           # TLS certificates (gitignored)
│   ├── ml/
│   │   ├── train.py         # Antrenare Isolation Forest
│   │   ├── infer.py         # Scorare în timp real
│   │   ├── features.py      # Feature engineering
│   │   └── models/          # Modele salvate .pkl (gitignored)
│   └── db/
│       ├── init.sql          # Schema TimescaleDB + PostgreSQL
│       └── migrations/
│
├── api/
│   ├── src/
│   │   ├── sensors/         # Module NestJS
│   │   ├── commands/
│   │   ├── rules/
│   │   ├── alerts/
│   │   ├── auth/
│   │   └── mqtt/            # MQTT subscriber service
│   ├── package.json
│   └── .env.example
│
├── mobile/
│   ├── src/
│   │   ├── screens/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── services/        # API calls, WebSocket, cache
│   ├── app.json
│   └── package.json
│
└── docs/
    ├── 00_arhitectura_generala.md   ← acest fișier
    ├── 01_layer1_senzori.md
    ├── 02_layer2_esp32.md
    ├── 03_layer3_gateway.md
    ├── 04_layer4_api.md
    └── 05_layer5_mobile.md
```

---

## 8. Cerințe non-funcționale

| Cerință | Valoare țintă | Justificare |
|---------|---------------|-------------|
| Latență alertă critică | < 500ms | Gaz detectat → buzzer local pe ESP32, fără să aștepte gateway |
| Latență date live în app | < 2 secunde | WebSocket pe rețea locală |
| Funcționare fără internet | 100% funcțional | Local-first by design |
| Uptime gateway | > 99% (în condiții normale) | Raspberry Pi cu alimentare stabilă |
| Consum RAM total (RPi) | < 800MB | Lasă buffer pentru OS pe 1GB RAM |
| Retenție date | 1 an rolling | TimescaleDB retention policy automată |
| Reantrenare model ML | La 24h | Cron job nocturn |

---

## 9. Comparație cu soluții existente

| Criteriu | Google Home | Home Assistant | **Sistemul propus** |
|----------|-------------|----------------|---------------------|
| Funcționează fără internet | ✗ | ✓ (parțial) | ✓ complet |
| Date rămân local | ✗ | ✓ | ✓ |
| Detecție anomalii ML | ✗ | Plugin terț | ✓ nativ, local |
| Open source | ✗ | ✓ | ✓ |
| Control complet hardware | ✗ | Parțial | ✓ |
| Complexitate setup | Mică | Medie | Mare (scop academic) |

---

## 10. Referințe și tehnologii

- **MQTT Protocol:** OASIS Standard v5.0 — https://mqtt.org
- **Mosquitto:** Eclipse Foundation — https://mosquitto.org
- **TimescaleDB:** https://www.timescale.com
- **Isolation Forest:** Liu, Fei Tony, et al. "Isolation forest." ICDM 2008
- **ESP32-C3:** Espressif Systems — https://www.espressif.com
- **NestJS:** https://nestjs.com
- **React Native + Expo:** https://expo.dev
- **Home Assistant:** https://www.home-assistant.io (referință pentru comparație)
- **Matter Protocol:** CSA — https://csa-iot.org/developer-resource/matter-overview

---

*Document generat ca parte a documentației tehnice pentru lucrarea de licență.*
*Următorul document: `01_layer1_senzori.md` — conectarea și configurarea senzorilor și actuatorilor pe ESP32.*
