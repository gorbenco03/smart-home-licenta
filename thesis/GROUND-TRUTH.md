# Adevărul de bază al sistemului (pentru redactarea capitolelor)

Toate capitolele trebuie să descrie EXACT sistemul real de mai jos. NU inventa funcționalități.
Pentru ce nu e încă măsurat (acuratețe ML, teste automate, model antrenat pe date reale de lungă durată),
prezintă METODOLOGIA și marchează cifrele drept *preliminare / ilustrative*.

## Viziune
Smart home **local-first**: funcționează integral în LAN, fără cloud. Avantaje: confidențialitate
(date personale rămân local), autonomie (merge și fără internet), cost redus, control total.
Contribuția originală de evidențiat = **detecția de anomalii comportamentale cu Isolation Forest, rulată local pe Raspberry Pi**.

## Arhitectură — 5 straturi
1. Senzori & actuatori. 2. Noduri ESP32. 3. Gateway Raspberry Pi (Mosquitto, PostgreSQL/TimescaleDB, motor ML). 4. API NestJS. 5. Aplicație mobilă React Native.

## Hardware real (cele 11 piese)
### Nod interior — ESP32 WROOM-32, firmware Arduino C++ (`firmware/esp32_node/esp32_node.ino`)
Pinout (ADC pe 10 biți, 0–1023):
| Componentă | Pin |
|---|---|
| DHT11 #1 (living) | GPIO4 |
| DHT11 #2 (dormitor) | GPIO23 |
| MQ-2 (gaz, A0 analog) | GPIO34 |
| LDR #1 (lumină) | GPIO35 |
| LDR #2 (lumină) | GPIO36 |
| Buzzer | GPIO5 |
| Servo SG90 | GPIO18 |
| LED #0 | GPIO25 |
| LED #1 | GPIO26 |
| LED #2 | GPIO27 |
| Ventilator 5V | GPIO33 (prin tranzistor NPN/releu) |
NU are PIR și NU are BH1750 (s-a renunțat la senzorul I2C de lux în favoarea celor 2 LDR analogice).
Alimentare: 3.3V pentru DHT11/LDR; 5V extern pentru servo + ventilator. Ventilatorul și servo nu se alimentează direct din GPIO.

### ESP32-CAM (AI-Thinker, cameră OV2640) — exterior
PIR pe GPIO13 (singura sursă de mișcare din sistem), LED exterior GPIO12 (se aprinde 30s la mișcare).
Server HTTP pe port 80: `GET /stream` (MJPEG live), `GET /capture` (snapshot JPEG). Publică mișcarea pe MQTT.

### Raspberry Pi 3B+ — gateway
Mosquitto MQTT (port 1883, user `smarthome`), PostgreSQL + TimescaleDB, API NestJS (port 3000), motor ML Python.

## Comunicație MQTT
Topicuri: `smarthome/{nodeId}/sensors`, `smarthome/{nodeId}/status` (cu Last Will, retained),
`smarthome/{nodeId}/commands`, `smarthome/alerts`. mDNS: `smarthome.local`, `smarthome-cam.local`.
Provisioning Wi-Fi: hotspot `SmartHome-Setup` ca fallback; credențiale salvate în NVS; comanda `wifi_update`.

### Payload senzori (publicat de nodul interior)
```json
{ "nodeId":"esp32_node_a","location":"interior",
  "temperature":22.5,"humidity":55,"temperature2":21.8,"humidity2":58,
  "gasLevel":245,"gasAlert":false,"light1":410,"light2":120,"lightLux":410 }
```
`temperature`/`humidity` = DHT11 #1; `temperature2`/`humidity2` = DHT11 #2; `light1`/`light2` = cele 2 LDR; `lightLux` = alias = light1.

### Comenzi acceptate
`led_on|led_off|led_toggle {led:0..2}`, `fan_on|fan_off`, `servo_move {servoAngle:0..180}`,
`buzzer_beep {count}`, `all_off` (stinge LED-uri + ventilator + servo 0°), `wifi_update {ssid,password,mqtt_host}`.
Alertă gaz: pe frontul crescător când `gasLevel > 350` → publică pe `smarthome/alerts` + beep local.
Ventilator automat (opțional, histerezis): pornește la temp medie > 28°C, oprește la < 26°C.

## Backend NestJS (`api/`)
TypeORM. Entitate `sensor_readings` (cu noile câmpuri temperature2/humidity2/light1/light2, toate nullable).
`mqtt.service.ts` = subscriber + publisher de comenzi. `sensors.gateway.ts` = Socket.IO namespace `/live`,
evenimente `sensor_update`, `alert`, `node_status`. Auth JWT + bcrypt.
Endpointuri REST: `/api/auth/login`, `/api/sensors/{nodes,latest,history}`, `/api/alerts`,
`/api/alerts/{id}/acknowledge`, `/api/commands/{nodeId}`, `/api/rules`, `/api/setup/{status,networks,connect}`.
Modul `simulator/` (SIMULATE=true) generează date mock, inclusiv noile câmpuri, pentru dezvoltare fără hardware.

## Bază de date (PostgreSQL + TimescaleDB)
Tabele: `sensor_readings` (hypertable time-series), `alerts`, `nodes`, `automation_rules`, `users`, `ml_models`.
Tipuri de alertă: `GAS_DETECTED`, `MOTION_NIGHT`, `ALERT_HEAT`, `ALERT_COLD`, `ML_ANOMALY`.

## Motor ML — CONTRIBUȚIA ORIGINALĂ (`gateway/ml/`)
- `features.py`: 12 trăsături în ordine fixă: 0 temperature, 1 humidity, 2 gas_normalized (=ADC/4095),
  3 lux_normalized (=log1p(light1)/7), 4 motion, 5 hour_of_day, 6 day_of_week, 7 is_weekend, 8 is_night,
  9 temp_delta_1h, 10 motion_count_10, 11 temp_avg (media DHT11 #1 și #2). Normalizare StandardScaler.
- `train.py`: `IsolationForest` (contamination=0.05, n_estimators=100), pe ultimele 30 zile (minim ~500 rânduri),
  salvează `isolation_forest.pkl` + `scaler.pkl`, metadate în tabela `ml_models`. Reantrenare zilnică la 03:00
  (`scheduler.py` / serviciu systemd `smarthome-ml.service`).
- `infer.py`: `score_samples` în timp real; prag `ANOMALY_THRESHOLD = -0.1`; întoarce `{is_anomaly, score, model_active}`.
- Cold-start (primele ~14 zile, fără model): reguli prag hardcodate (gaz>300, temp>35/<5°C, mișcare 23:00–06:00).
- Algoritm: Isolation Forest (Liu, Ting, Zhou, 2008) — izolează punctele rare prin partiționări aleatoare;
  punctele anomale au lungime de cale medie mai mică ⇒ scor de anomalie mai mare. Nesupervizat, potrivit pentru edge.

## Aplicație mobilă (`mobile/`) — React Native 0.81 / Expo SDK 54 / TypeScript
Tab-uri: **Dashboard** (senzori live, 2 temperaturi/umidități, 2 valori lumină, room tiles, scor de siguranță, sparklines),
**Istoric** (grafice), **Alerte** (timeline cu severitate), **Control** (3 LED-uri, ventilator, servo perdele 0°/90°/180°,
test buzzer, oprire totală, scene, cameră snapshot + live MJPEG în WebView).
Stare: Zustand + React Query; live prin Socket.IO. Discovery: variabilă de mediu / `smarthome.local` / hotspot `192.168.4.1`. Autentificare JWT.

## Cheile bibliografice disponibile în `cls/bib.bib` (folosește DOAR acestea; dacă ai nevoie de altele, adaugă-le în `cls/bib_chN.bib` propriu)
atzori2010iot, gubbi2013iot, stojkoska2017smarthome, alam2012smarthome, lin2017edge, kleppmann2019localfirst,
zheng2018smarthomeprivacy, alrawi2019sokhome, gdpr2016, oasis2019mqtt, light2017mosquitto, naik2017mqttcomparison,
rfc7252, rfc6762mdns, liu2008isolation, liu2012isolationtkdd, chandola2009anomaly, chalapathy2019deepanomaly,
breunig2000lof, scholkopf2001ocsvm, fahim2019anomaly, cook2020anomalyiot, shi2016edge, premsankar2018edgeiot,
pedregosa2011scikit, geron2019handson, mckinney2010pandas, harris2020numpy, espressif2023esp32, espressif2023esp32cam,
aosong2019dht11, hanwei2020mq2, pir2019hcsr501, kodali2016smartiot, maier2014esp, timescaledb2017, postgresql2024,
jensen2017timeseries, nestjs2024, reactnative2024, expo2024, jones2015jwt, provos2003bcrypt, davis2006prcurve, fawcett2006roc.

## Figuri disponibile (placeholdere în `thesis/pics/`) — fiecare se folosește O SINGURĂ dată
| Fișier | Label | Capitol |
|---|---|---|
| fig-arhitectura | fig:arhitectura | 3 |
| fig-usecase | fig:usecase | 3 |
| fig-flux-date | fig:flux-date | 3 |
| fig-er | fig:er | 3 |
| fig-ml-pipeline | fig:ml-pipeline | 3 |
| fig-ml-isolation | fig:ml-isolation | 2 |
| fig-secventa-monitorizare | fig:secv-monitor | 4 |
| fig-secventa-comanda | fig:secv-comanda | 4 |
| fig-secventa-alerta | fig:secv-alerta | 4 |
| fig-pinout | fig:pinout | 4 |
| fig-mobile | fig:mobile | 4 |
| fig-piramida-testare | fig:piramida | 5 |
| fig-eval-anomalii | fig:eval | 5 |

Includere figură (în text):
```latex
\begin{figure}[H]
  \centering
  \includegraphics[width=\singlefigure]{\pics/fig-arhitectura}
  \caption{Arhitectura de ansamblu a sistemului, organizată pe cinci straturi.}
  \label{fig:arhitectura}
\end{figure}
```
Referire în text: `\figref{fig:arhitectura}`, `\tabref{...}`, `\chapref{ch:...}`, `\secref{sec:...}`.
Etichete de capitol existente: `ch:introducere`, `ch:studii`, `ch:metodologie`, `ch:implementare`, `ch:rezultate`, `ch:concluzii`.

## Stil
Română academică cu diacritice. Acronime cu `\gls{...}` (ex. `\gls{mqtt}`, `\gls{if}`, `\gls{ml}`, `\gls{ldr}`, `\gls{led}`, `\gls{pir}`, `\gls{dht}`, `\gls{rpi}`, `\gls{adc}`, `\gls{gpio}`, `\gls{pwm}`, `\gls{api}`, `\gls{rest}`, `\gls{jwt}`, `\gls{iot}`, `\gls{ui}`).
Tabele cu `booktabs` (`\toprule/\midrule/\bottomrule`); coloane late → `p{...}` ca să se rupă textul.
Cod cu `\begin{lstlisting}[language=C++]` sau `[language=TypeScript]` (definite deja), sau `[language=Python]`.
