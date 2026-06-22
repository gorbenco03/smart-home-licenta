# Specificații diagrame — Lucrare de licență (Vidac Denisa)

Brief autonom pentru fiecare figură, de realizat în Claude Design. Fiecare diagramă
devine o secțiune `<section id="fig-...">` cu un `<div data-card>` în fișierul `.dc.html`
exportat. Numele de fișier de mai jos este și `id`-ul secțiunii și numele PDF-ului final
din `thesis/pics/` (înlocuiește placeholderul cu același nume).

## Convenții grafice comune (paletă consecventă)
- **Fundal** alb. **Text** gri-antracit `#1f2937`.
- **Straturi/actori**: bleu `#2563eb` (contur) pe fundal `#eff6ff`.
- **Dispozitive hardware** (ESP32, senzori): verde `#059669` pe `#ecfdf5`.
- **Servicii software** (MQTT, API, DB, ML): mov `#7c3aed` pe `#f5f3ff`.
- **Aplicație mobilă / utilizator**: chihlimbar `#d97706` pe `#fffbeb`.
- **Alerte / anomalii**: roșu `#dc2626` pe `#fef2f2`.
- Săgeți: linie continuă 1.5px pentru flux de date; punctată pentru comenzi/control.
- Font sans-serif (Inter/Helvetica), etichete **în limba română**, fără umbre puternice.
- Raport de aspect ~4:3 sau 16:9; lizibil la lățimea unei pagini A4 (≈16 cm).

---

## 1. `fig-arhitectura` — Arhitectura de ansamblu (5 straturi)
**Label LaTeX:** `\label{fig:arhitectura}` · **Capitol:** 3 (Metodologie)
Cinci benzi orizontale stivuite, de jos în sus:
1. **Stratul 1 — Senzori & actuatori**: 2×DHT11, MQ-2, 2×LDR, PIR (la cameră), 3×LED, ventilator, servomotor, buzzer, cameră OV2640.
2. **Stratul 2 — Noduri ESP32**: „ESP32 nod interior (Arduino C++)" și „ESP32-CAM (exterior)". Săgeți GPIO/ADC/PWM/I2C de la stratul 1.
3. **Stratul 3 — Gateway Raspberry Pi**: cutii pentru Mosquitto (MQTT 1883), PostgreSQL+TimescaleDB, Motor ML (Isolation Forest).
4. **Stratul 4 — API NestJS**: REST + WebSocket + JWT.
5. **Stratul 5 — Aplicație mobilă** React Native/Expo + utilizator.
Între strat 2 și 3: săgeată **MQTT (Wi-Fi)**; camera spre app: săgeată **HTTP/MJPEG**. Între 3-4 intern; 4-5 **REST + WebSocket**. Evidențiază „totul în LAN, fără cloud" (chenar punctat în jurul straturilor 1–4 etichetat „Rețea locală").

## 2. `fig-usecase` — Diagrama use-case
**Label:** `\label{fig:usecase}` · **Capitol:** 3
Actor „Utilizator" (stânga) și actor secundar „Motor ML" (dreapta, sistem). Cazuri de utilizare (elipse): Autentificare, Vizualizare senzori (dashboard), Vizualizare istoric, Control LED-uri, Control ventilator, Control perdele (servo), Test buzzer/Oprire totală, Vizualizare flux cameră, Primire alerte, Configurare Wi-Fi (provisioning). „Motor ML" e asociat cu „Generare alertă anomalie" (`<<extend>>` pe „Primire alerte"). „Detectare gaz" e `<<include>>` la monitorizare.

## 3. `fig-flux-date` — Fluxul de date MQTT
**Label:** `\label{fig:flux-date}` · **Capitol:** 3
Flux orizontal: `ESP32 → publish smarthome/esp32_node_a/sensors → Mosquitto → NestJS (subscriber) → {TimescaleDB, WebSocket → App, Motor ML}`. Ramură de comandă (punctată, sens invers): `App → POST /api/commands → NestJS → publish .../commands → ESP32`. Ramură alertă (roșu): `ESP32 → smarthome/alerts` și `Motor ML → alertă ML_ANOMALY`. Etichetează topicele MQTT pe săgeți.

## 4. `fig-er` — Diagrama entitate-relație (baza de date)
**Label:** `\label{fig:er}` · **Capitol:** 3
Entități cu câmpuri cheie:
- **sensor_readings** (hypertable): time, node_id, location, temperature, humidity, temperature2, humidity2, gas_level, gas_alert, motion, light1, light2, light_lux.
- **alerts**: id, time, node_id, alert_type, severity, location, details, acknowledged.
- **nodes**: id, node_id, location, last_seen, online, node_type.
- **automation_rules**: id, name, sensor, operator, threshold, time_from, time_to, action_type, enabled.
- **users**: id, username, password_hash.
- **ml_models**: id, version, trained_at, training_rows, contamination, features, is_active.
Relații: nodes 1—N sensor_readings; nodes 1—N alerts. Marchează cheile primare/străine.

## 5. `fig-secventa-monitorizare` — Secvență: monitorizare
**Label:** `\label{fig:secv-monitor}` · **Capitol:** 4
Lifelines: ESP32, Mosquitto, NestJS, TimescaleDB, App. Mesaje: citire senzori (la 5s) → publish sensors → NestJS salvează în DB → emit `sensor_update` (WebSocket) → App actualizează dashboard.

## 6. `fig-secventa-comanda` — Secvență: comandă actuator
**Label:** `\label{fig:secv-comanda}` · **Capitol:** 4
Lifelines: App, NestJS, Mosquitto, ESP32. Mesaje: utilizator apasă „LED 1 ON" → `POST /api/commands/esp32_node_a {action:led_on, led:0}` → NestJS publish `.../commands` → ESP32 execută `setLed(0,true)` → confirmare în log. Punctat = sens control.

## 7. `fig-secventa-alerta` — Secvență: detecție anomalie (ML)
**Label:** `\label{fig:secv-alerta}` · **Capitol:** 4
Lifelines: ESP32, NestJS, Motor ML (infer.py), DB, App. Mesaje: citire nouă → NestJS → infer ML (score_samples) → dacă score < prag → creează alertă `ML_ANOMALY` în DB → emit WebSocket → App notifică utilizatorul.

## 8. `fig-ml-pipeline` — Pipeline-ul ML Isolation Forest
**Label:** `\label{fig:ml-pipeline}` · **Capitol:** 3/4 (contribuția originală)
Flux pe etape: **Colectare** (sensor_readings) → **Feature engineering** (`features.py`: temperatură, umiditate, gaz_norm, lux_norm(light1), mișcare, oră, zi, weekend, noapte, delta_temp, motion_count, temp_avg) → **Normalizare** (StandardScaler) → **Antrenare** (`train.py`, Isolation Forest, contamination=0.05, n_estimators=100, cron zilnic 03:00) → **Persistență** (isolation_forest.pkl + scaler.pkl) → **Inferență** (`infer.py`, score_samples în timp real) → **Decizie** (score < prag → ML_ANOMALY). Marchează bucla „reantrenare zilnică". Evidențiază „cold-start (primele zile) → reguli prag" până la primul model.

## 9. `fig-ml-isolation` — Principiul izolării
**Label:** `\label{fig:ml-isolation}` · **Capitol:** 2 sau 3
Ilustrație conceptuală: un nor de puncte „normale" dens + un punct „anomal" izolat. Două sub-panouri arătând că punctul anomal este separat prin puține tăieturi (split-uri) aleatoare, în timp ce un punct normal necesită multe tăieturi. Text: „lungime de cale mică ⇒ scor de anomalie mare".

## 10. `fig-piramida-testare` — Piramida testării
**Label:** `\label{fig:piramida}` · **Capitol:** 5
Piramidă clasică pe 3 niveluri: bază = teste unitare (servicii NestJS, features.py), mijloc = teste de integrare (API + MQTT + DB), vârf = teste end-to-end (firmware↔broker↔API↔app). Lateral, notă „testare manuală pe hardware (breadboard)".

## 11. `fig-eval-anomalii` — Evaluarea detecției de anomalii
**Label:** `\label{fig:eval}` · **Capitol:** 5
Grafic ilustrativ (date preliminare): serie temporală a scorului de anomalie pe 24h, cu prag orizontal și câteva puncte peste prag marcate ca anomalii (roșu). Opțional, panou secundar cu o curbă ROC ilustrativă. **Marchează clar „date ilustrative / preliminare".**

## 12. `fig-pinout` — Schema de conexiuni a nodului interior
**Label:** `\label{fig:pinout}` · **Capitol:** 4
Reprezentare ESP32 WROOM-32 cu pinii etichetați conform mapării reale: DHT11#1=GPIO4, DHT11#2=GPIO23, MQ-2=GPIO34, LDR1=GPIO35, LDR2=GPIO36, buzzer=GPIO5, servo=GPIO18, LED0=GPIO25, LED1=GPIO26, LED2=GPIO27, ventilator=GPIO33 (prin tranzistor). Notează alimentarea 5V externă pentru servo/ventilator și 3.3V pentru senzori.

## 13. `fig-mobile` — Capturi din aplicația mobilă
**Label:** `\label{fig:mobile}` · **Capitol:** 4/5
Placeholder pentru 2–3 capturi reale (Dashboard, Control, Alerte) pe care le furnizează utilizatorul. Până atunci, rămâne placeholder.
