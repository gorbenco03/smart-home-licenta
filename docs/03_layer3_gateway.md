# Layer 3 — Raspberry Pi 3B+ Gateway

> **Document:** 03 din 05
> **Prerequisite:** Layer 1 și Layer 2 complete — ESP32 publică date pe MQTT (chiar și fără TLS deocamdată)
> **Timp estimat setup:** 4-6 ore
> **Ce obții la final:** Gateway complet funcțional — broker MQTT securizat, baze de date, ML engine, API REST

---

## 1. Setup Raspberry Pi OS

### 1.1 Instalare OS

Descarcă **Raspberry Pi Imager** de la https://rpi.imager.raspberrypi.com

Setări recomandate în Imager (click pe iconița roată ⚙️):
- OS: **Raspberry Pi OS Lite (64-bit)** — fără desktop, economisești ~300MB RAM
- Hostname: `smarthome.local`
- Username: `pi` / parolă puternică
- WiFi: completează dacă folosești wireless (recomandat cablu ethernet pentru gateway)
- SSH: **activat**

### 1.2 Primul boot și update

```bash
# Conectează-te prin SSH
ssh pi@smarthome.local
# sau ssh pi@<IP-ul RPi>

# Update complet
sudo apt update && sudo apt upgrade -y

# Utilitare necesare
sudo apt install -y \
  git curl wget nano htop \
  build-essential libssl-dev \
  python3-pip python3-venv \
  openssl

# Verifică memoria disponibilă
free -h
# Ar trebui să ai ~700-800MB free pe un OS Lite proaspăt
```

### 1.3 IP static — obligatoriu

ESP32 trebuie să știe mereu unde e broker-ul. Setează IP static pe RPi:

```bash
sudo nano /etc/dhcpcd.conf
```

Adaugă la final:
```
interface eth0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8
```

```bash
sudo reboot
# După reboot verifică
ip addr show eth0
# Ar trebui să apară 192.168.1.100
```

> Ajustează `192.168.1.x` la range-ul rețelei tale. Verifică cu `ip route` care e gateway-ul tău.

---

## 2. Mosquitto — MQTT Broker cu TLS

### 2.1 Instalare

```bash
sudo apt install -y mosquitto mosquitto-clients

# Verifică că rulează
sudo systemctl status mosquitto

# Oprește-l temporar — îl reconfigurăm
sudo systemctl stop mosquitto
```

### 2.2 Generare certificate TLS cu OpenSSL

Aceasta e partea cea mai importantă pentru securitate. Generăm:
- **CA (Certificate Authority)** — autoritatea noastră de certificare, semnează tot
- **Server certificate** — pentru Mosquitto
- **Client certificates** — câte unul per ESP32

```bash
# Creează folderul pentru certificate
mkdir -p ~/certs && cd ~/certs

# ── Pasul 1: Generează CA (Certificate Authority) ────────
# Cheie privată CA
openssl genrsa -out ca.key 2048

# Certificat CA autosemnat (valabil 10 ani)
openssl req -new -x509 -days 3650 -key ca.key -out ca.crt \
  -subj "/CN=SmartHomeCA/O=SmartHome/C=RO"

# ── Pasul 2: Certificat server (Mosquitto) ───────────────
# Cheie privată server
openssl genrsa -out server.key 2048

# Certificate Signing Request
openssl req -new -key server.key -out server.csr \
  -subj "/CN=192.168.1.100/O=SmartHome/C=RO"
# CN trebuie să fie IP-ul sau hostname-ul RPi

# Semnează cu CA
openssl x509 -req -days 3650 \
  -in server.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out server.crt

# ── Pasul 3: Certificat client Node A (ESP32) ────────────
openssl genrsa -out client_node_a.key 2048

openssl req -new -key client_node_a.key -out client_node_a.csr \
  -subj "/CN=esp32_node_a/O=SmartHome/C=RO"

openssl x509 -req -days 3650 \
  -in client_node_a.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out client_node_a.crt

# ── Pasul 4: Certificat client Node B ────────────────────
openssl genrsa -out client_node_b.key 2048

openssl req -new -key client_node_b.key -out client_node_b.csr \
  -subj "/CN=esp32_node_b/O=SmartHome/C=RO"

openssl x509 -req -days 3650 \
  -in client_node_b.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out client_node_b.crt

# ── Permisiuni corecte ────────────────────────────────────
chmod 600 *.key
chmod 644 *.crt

# Copiază certificatele server unde le vrea Mosquitto
sudo mkdir -p /etc/mosquitto/certs
sudo cp ca.crt server.crt server.key /etc/mosquitto/certs/
sudo chown -R mosquitto:mosquitto /etc/mosquitto/certs/
sudo chmod 600 /etc/mosquitto/certs/server.key

echo "Certificate generate cu succes!"
ls -la ~/certs/
```

### 2.3 Creare utilizatori MQTT

```bash
# Creează fișierul de parole
sudo mosquitto_passwd -c /etc/mosquitto/passwd esp32_node_a
# Introdu parola când e cerut (același cu MQTT_PASSWORD din config.py)

sudo mosquitto_passwd /etc/mosquitto/passwd esp32_node_b
# Parolă diferită pentru node B

sudo mosquitto_passwd /etc/mosquitto/passwd nestjs_api
# User pentru NestJS API care citește date

sudo mosquitto_passwd /etc/mosquitto/passwd admin
# User admin pentru debugging

sudo chown mosquitto:mosquitto /etc/mosquitto/passwd
sudo chmod 600 /etc/mosquitto/passwd
```

### 2.4 Configurare Mosquitto

```bash
sudo nano /etc/mosquitto/mosquitto.conf
```

```conf
# /etc/mosquitto/mosquitto.conf

# ─── General ─────────────────────────────────────────────
pid_file /run/mosquitto/mosquitto.pid
persistence true
persistence_location /var/lib/mosquitto/
log_dest file /var/log/mosquitto/mosquitto.log
log_type error
log_type warning
log_type notice
log_type information
log_timestamp true

# ─── Listener fără TLS (doar pentru localhost) ───────────
# Folosit de NestJS API care rulează pe același RPi
listener 1883 localhost
allow_anonymous false
password_file /etc/mosquitto/passwd

# ─── Listener TLS pentru ESP32 (rețea locală) ────────────
listener 8883
allow_anonymous false
password_file /etc/mosquitto/passwd

# Certificate TLS
cafile   /etc/mosquitto/certs/ca.crt
certfile /etc/mosquitto/certs/server.crt
keyfile  /etc/mosquitto/certs/server.key

# Cer certificat de la client (mutual TLS)
require_certificate true
use_identity_as_username false

# Versiune TLS minimă
tls_version tlsv1.2

# ─── ACL — cine poate publica/citi ce topic-uri ──────────
acl_file /etc/mosquitto/acl

# ─── Limite conexiune ────────────────────────────────────
max_connections 20
max_keepalive 120
```

### 2.5 Configurare ACL (Access Control List)

```bash
sudo nano /etc/mosquitto/acl
```

```
# /etc/mosquitto/acl
# format: user <username> → topic <topic> <permisiune>

# ── ESP32 Node A ──────────────────────────────────────────
user esp32_node_a
topic write home/esp32_node_a/sensors
topic write home/alerts
topic write home/esp32_node_a/status
topic read  home/esp32_node_a/commands

# ── ESP32 Node B ──────────────────────────────────────────
user esp32_node_b
topic write home/esp32_node_b/sensors
topic write home/alerts
topic write home/esp32_node_b/status
topic read  home/esp32_node_b/commands

# ── NestJS API (citește tot, publică comenzi) ─────────────
user nestjs_api
topic read  home/#
topic write home/esp32_node_a/commands
topic write home/esp32_node_b/commands

# ── Admin (acces complet) ─────────────────────────────────
user admin
topic readwrite #
```

### 2.6 Pornire și test Mosquitto

```bash
sudo systemctl start mosquitto
sudo systemctl enable mosquitto
sudo systemctl status mosquitto

# Test: subscribe la toate topic-urile (din alt terminal)
mosquitto_sub -h localhost -p 1883 \
  -u admin -P parola_admin \
  -t "home/#" -v

# Test: publică un mesaj de test
mosquitto_pub -h localhost -p 1883 \
  -u admin -P parola_admin \
  -t "home/test" -m '{"test": true}'
```

### 2.7 Copiază certificatele pe ESP32

```bash
# De pe Raspberry Pi, copiază certificatele pe calculatorul tău
# apoi pe ESP32 cu mpremote

# Pe calculatorul tău:
scp pi@192.168.1.100:~/certs/ca.crt .
scp pi@192.168.1.100:~/certs/client_node_a.crt .
scp pi@192.168.1.100:~/certs/client_node_a.key .

# Copiază pe ESP32 Node A:
mpremote connect /dev/ttyUSB0 cp ca.crt :certs/ca.crt
mpremote connect /dev/ttyUSB0 cp client_node_a.crt :certs/client.crt
mpremote connect /dev/ttyUSB0 cp client_node_a.key :certs/client.key

# Similar pentru Node B (cu client_node_b.*)
```

---

## 3. PostgreSQL + TimescaleDB

### 3.1 Instalare PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib

sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verifică versiunea
psql --version
```

### 3.2 Instalare TimescaleDB

```bash
# Adaugă repository TimescaleDB
curl -s https://packagecloud.io/install/repositories/timescale/timescaledb/script.deb.sh | sudo bash

# Instalare (pentru versiunea PostgreSQL instalată — verifică cu psql --version)
sudo apt install -y timescaledb-2-postgresql-15

# Configurare automată (optimizează postgresql.conf pentru RPi)
sudo timescaledb-tune --quiet --yes

sudo systemctl restart postgresql
```

### 3.3 Creare baze de date și utilizatori

```bash
sudo -u postgres psql
```

```sql
-- În psql

-- Utilizator pentru aplicație
CREATE USER smarthome WITH PASSWORD 'parola_db_puternica';

-- Baza de date principală
CREATE DATABASE smarthome_db OWNER smarthome;

-- Ieși din psql
\q
```

```bash
# Conectează-te ca smarthome la baza de date
psql -U smarthome -d smarthome_db -h localhost
```

### 3.4 Schema completă baze de date

```sql
-- Activează extensia TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ════════════════════════════════════════════════════════
-- TABEL PRINCIPAL: date senzori (time-series)
-- ════════════════════════════════════════════════════════
CREATE TABLE sensor_readings (
  time          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  node_id       TEXT            NOT NULL,
  location      TEXT,
  temperature   FLOAT,
  humidity      FLOAT,
  gas_level     INTEGER,
  gas_alert     BOOLEAN         DEFAULT FALSE,
  motion        BOOLEAN         DEFAULT FALSE,
  light_lux     FLOAT,
  -- Coloane calculate pentru ML features
  temp_delta_1h FLOAT,          -- completat de ML engine
  motion_count_1h INTEGER       -- completat de ML engine
);

-- Transformă în hypertable (TimescaleDB magic)
SELECT create_hypertable('sensor_readings', 'time');

-- Index pentru query-uri frecvente
CREATE INDEX ON sensor_readings (node_id, time DESC);

-- Retenție automată date (șterge ce e mai vechi de 1 an)
SELECT add_retention_policy('sensor_readings', INTERVAL '1 year');

-- Compresie automată date mai vechi de 7 zile (economisește spațiu pe SD card)
ALTER TABLE sensor_readings SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'node_id'
);
SELECT add_compression_policy('sensor_readings', INTERVAL '7 days');

-- ════════════════════════════════════════════════════════
-- TABEL: alerte
-- ════════════════════════════════════════════════════════
CREATE TABLE alerts (
  id            SERIAL          PRIMARY KEY,
  time          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  node_id       TEXT            NOT NULL,
  alert_type    TEXT            NOT NULL,  -- GAS_DETECTED, MOTION_NIGHT, ML_ANOMALY, etc.
  severity      TEXT            NOT NULL DEFAULT 'medium', -- low, medium, high, critical
  location      TEXT,
  details       JSONB,
  acknowledged  BOOLEAN         DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ
);

CREATE INDEX ON alerts (time DESC);
CREATE INDEX ON alerts (acknowledged, time DESC);

-- ════════════════════════════════════════════════════════
-- TABEL: utilizatori aplicație mobilă
-- ════════════════════════════════════════════════════════
CREATE TABLE users (
  id            SERIAL          PRIMARY KEY,
  username      TEXT            UNIQUE NOT NULL,
  email         TEXT            UNIQUE NOT NULL,
  password_hash TEXT            NOT NULL,
  created_at    TIMESTAMPTZ     DEFAULT NOW(),
  last_login    TIMESTAMPTZ
);

-- ════════════════════════════════════════════════════════
-- TABEL: reguli automatizare
-- ════════════════════════════════════════════════════════
CREATE TABLE automation_rules (
  id            SERIAL          PRIMARY KEY,
  name          TEXT            NOT NULL,
  description   TEXT,
  node_id       TEXT,           -- NULL = se aplică tuturor nodurilor
  sensor        TEXT            NOT NULL,  -- temperature, gas_level, motion, etc.
  operator      TEXT            NOT NULL,  -- >, <, ==, >=, <=
  threshold     FLOAT           NOT NULL,
  time_from     TIME,           -- NULL = toată ziua
  time_to       TIME,
  days_of_week  INTEGER[],      -- NULL = toate zilele, [1,2,3,4,5] = Lun-Vin
  action_type   TEXT            NOT NULL,  -- relay_on, relay_off, buzzer, alert
  action_target TEXT,           -- ex: "relay_1" sau "node_a"
  action_params JSONB,
  enabled       BOOLEAN         DEFAULT TRUE,
  created_at    TIMESTAMPTZ     DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════
-- TABEL: noduri ESP32 înregistrate
-- ════════════════════════════════════════════════════════
CREATE TABLE nodes (
  id            SERIAL          PRIMARY KEY,
  node_id       TEXT            UNIQUE NOT NULL,
  location      TEXT            NOT NULL,
  description   TEXT,
  last_seen     TIMESTAMPTZ,
  online        BOOLEAN         DEFAULT FALSE,
  firmware_ver  TEXT,
  registered_at TIMESTAMPTZ     DEFAULT NOW()
);

INSERT INTO nodes (node_id, location, description) VALUES
  ('esp32_node_a', 'living', 'Nod principal - living si bucatarie'),
  ('esp32_node_b', 'dormitor', 'Nod secundar - dormitor si baie');

-- ════════════════════════════════════════════════════════
-- TABEL: ML model metadata
-- ════════════════════════════════════════════════════════
CREATE TABLE ml_models (
  id              SERIAL        PRIMARY KEY,
  version         TEXT          NOT NULL,
  trained_at      TIMESTAMPTZ   DEFAULT NOW(),
  training_rows   INTEGER,
  contamination   FLOAT,
  features        TEXT[],
  accuracy_notes  TEXT,
  is_active       BOOLEAN       DEFAULT FALSE
);

-- ════════════════════════════════════════════════════════
-- VIEW: ultimele citiri per nod (util pentru dashboard)
-- ════════════════════════════════════════════════════════
CREATE VIEW latest_readings AS
SELECT DISTINCT ON (node_id)
  node_id, location, time,
  temperature, humidity, gas_level,
  gas_alert, motion, light_lux
FROM sensor_readings
ORDER BY node_id, time DESC;

-- Acordă permisiuni utilizatorului aplicației
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO smarthome;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO smarthome;
```

```bash
# Salvează schema și rulează
# (din fișier)
psql -U smarthome -d smarthome_db -h localhost -f schema.sql

# Verifică că totul s-a creat
psql -U smarthome -d smarthome_db -h localhost -c "\dt"
```

---

## 4. Python ML Engine — Isolation Forest

### 4.1 Setup environment Python

```bash
mkdir -p ~/gateway/ml
cd ~/gateway/ml

python3 -m venv venv
source venv/bin/activate

pip install \
  scikit-learn==1.4.0 \
  pandas==2.1.0 \
  numpy==1.26.0 \
  psycopg2-binary==2.9.9 \
  joblib==1.3.2 \
  schedule==1.2.1

pip freeze > requirements.txt
```

### 4.2 features.py — feature engineering

```python
# ~/gateway/ml/features.py

import pandas as pd
import numpy as np

def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Construiește feature-uri pentru Isolation Forest din datele brute.
    Input: DataFrame cu coloanele din sensor_readings
    Output: DataFrame cu feature-uri normalizate
    """
    df = df.copy()
    df['time'] = pd.to_datetime(df['time'])
    df = df.sort_values('time')

    # ── Feature-uri temporale ─────────────────────────────
    df['hour_of_day']  = df['time'].dt.hour
    df['day_of_week']  = df['time'].dt.dayofweek  # 0=Luni, 6=Duminică
    df['is_weekend']   = df['day_of_week'].isin([5, 6]).astype(int)
    df['is_night']     = df['hour_of_day'].apply(
        lambda h: 1 if (h >= 23 or h < 6) else 0
    )

    # ── Delta temperatură față de ora precedentă ──────────
    # Detectează schimbări bruște de temperatură
    df['temp_delta_1h'] = df['temperature'].diff(periods=2).fillna(0)
    # (la 30s interval, 2 perioade = ~1 minut; ajustează la nevoie)

    # ── Număr detecții mișcare în fereastra precedentă ───
    # Rolling window de 10 citiri (~5 minute la 30s interval)
    df['motion_count_10'] = df['motion'].astype(int).rolling(
        window=10, min_periods=1
    ).sum()

    # ── Normalizare valori brute ──────────────────────────
    # gas_level e pe 0-4095, celelalte pe scale diferite
    # Isolation Forest e sensibil la scale — normalizăm
    df['gas_normalized'] = df['gas_level'].fillna(0) / 4095.0
    df['lux_normalized'] = np.log1p(df['light_lux'].fillna(0)) / 12.0

    # ── Lista finală de feature-uri pentru model ──────────
    FEATURE_COLUMNS = [
        'temperature',
        'humidity',
        'gas_normalized',
        'lux_normalized',
        'motion',
        'hour_of_day',
        'day_of_week',
        'is_weekend',
        'is_night',
        'temp_delta_1h',
        'motion_count_10'
    ]

    # Completează valorile lipsă cu media coloanei
    for col in FEATURE_COLUMNS:
        if col in df.columns:
            df[col] = df[col].fillna(df[col].median())

    return df[FEATURE_COLUMNS]


FEATURE_NAMES = [
    'temperature', 'humidity', 'gas_normalized', 'lux_normalized',
    'motion', 'hour_of_day', 'day_of_week', 'is_weekend', 'is_night',
    'temp_delta_1h', 'motion_count_10'
]
```

### 4.3 train.py — antrenare model

```python
# ~/gateway/ml/train.py

import os
import sys
import joblib
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import psycopg2
from psycopg2.extras import RealDictCursor

from features import build_features, FEATURE_NAMES

# ─── Configurare ─────────────────────────────────────────
DB_CONFIG = {
    "host":     "localhost",
    "dbname":   "smarthome_db",
    "user":     "smarthome",
    "password": "parola_db_puternica"
}

MODEL_DIR   = "/home/pi/gateway/ml/models"
MODEL_PATH  = f"{MODEL_DIR}/isolation_forest.pkl"
SCALER_PATH = f"{MODEL_DIR}/scaler.pkl"

# Isolation Forest parametri
CONTAMINATION    = 0.05   # estimăm că ~5% din date sunt anomalii
N_ESTIMATORS     = 100    # număr de arbori
TRAINING_DAYS    = 30     # câte zile de date folosim pentru antrenare
MIN_ROWS_NEEDED  = 500    # minim de citiri pentru a antrena


def load_training_data() -> pd.DataFrame:
    """Citește ultimele TRAINING_DAYS zile din TimescaleDB"""
    print(f"[Train] Citesc ultimele {TRAINING_DAYS} zile din DB...")

    query = """
        SELECT
            time, node_id, temperature, humidity,
            gas_level, gas_alert, motion, light_lux
        FROM sensor_readings
        WHERE
            time > NOW() - INTERVAL %s
            AND gas_alert = FALSE   -- excludem anomalii confirmate din antrenare
        ORDER BY time ASC
    """

    try:
        conn = psycopg2.connect(**DB_CONFIG)
        df = pd.read_sql_query(
            query,
            conn,
            params=(f"{TRAINING_DAYS} days",)
        )
        conn.close()
        print(f"[Train] {len(df)} citiri încărcate")
        return df
    except Exception as e:
        print(f"[Train] Eroare DB: {e}")
        sys.exit(1)


def train_model(df: pd.DataFrame):
    """Antrenează Isolation Forest și salvează modelul"""

    if len(df) < MIN_ROWS_NEEDED:
        print(f"[Train] Insuficiente date: {len(df)} < {MIN_ROWS_NEEDED}")
        print(f"[Train] Mai colectează date și încearcă mai târziu.")
        sys.exit(0)

    # Construiește feature-uri
    print("[Train] Construiesc feature-uri...")
    X = build_features(df)
    print(f"[Train] Shape features: {X.shape}")

    # Scalare — IsolationForest funcționează mai bine cu date normalizate
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Antrenare
    print(f"[Train] Antrenez Isolation Forest (contamination={CONTAMINATION})...")
    model = IsolationForest(
        n_estimators=N_ESTIMATORS,
        contamination=CONTAMINATION,
        random_state=42,
        n_jobs=-1  # folosește toate core-urile disponibile
    )
    model.fit(X_scaled)

    # Testare rapidă pe datele de antrenare
    predictions = model.predict(X_scaled)
    n_anomalies = (predictions == -1).sum()
    print(f"[Train] Anomalii detectate în date antrenare: {n_anomalies} ({n_anomalies/len(df)*100:.1f}%)")

    # Salvează modelul și scaler-ul
    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    print(f"[Train] Model salvat: {MODEL_PATH}")

    # Înregistrează în DB
    log_model_to_db(len(df))

    return model, scaler


def log_model_to_db(training_rows: int):
    """Înregistrează metadata modelului în PostgreSQL"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()

        # Dezactivează modelul curent
        cur.execute("UPDATE ml_models SET is_active = FALSE")

        # Inserează noul model
        cur.execute("""
            INSERT INTO ml_models
              (version, training_rows, contamination, features, is_active)
            VALUES (%s, %s, %s, %s, TRUE)
        """, (
            datetime.now().strftime("v%Y%m%d_%H%M"),
            training_rows,
            CONTAMINATION,
            FEATURE_NAMES
        ))

        conn.commit()
        conn.close()
        print("[Train] Metadata model înregistrată în DB")
    except Exception as e:
        print(f"[Train] Eroare înregistrare DB: {e}")


if __name__ == "__main__":
    print(f"[Train] ══ Antrenare model ML {datetime.now().strftime('%Y-%m-%d %H:%M')} ══")
    df = load_training_data()
    train_model(df)
    print("[Train] ══ Finalizat ══")
```

### 4.4 infer.py — inferență în timp real

```python
# ~/gateway/ml/infer.py
# Apelat de NestJS API sau de un subscriber MQTT separat

import joblib
import pandas as pd
import numpy as np
import os
import sys
import json
import psycopg2
from datetime import datetime

from features import build_features

MODEL_DIR   = "/home/pi/gateway/ml/models"
MODEL_PATH  = f"{MODEL_DIR}/isolation_forest.pkl"
SCALER_PATH = f"{MODEL_DIR}/scaler.pkl"

DB_CONFIG = {
    "host":     "localhost",
    "dbname":   "smarthome_db",
    "user":     "smarthome",
    "password": "parola_db_puternica"
}

# Threshold score — sub această valoare = anomalie
# IsolationForest score: -1 la 0 (mai negativ = mai anormal)
ANOMALY_THRESHOLD = -0.1


class AnomalyDetector:
    def __init__(self):
        self._model  = None
        self._scaler = None
        self._load_model()

    def _load_model(self):
        if not os.path.exists(MODEL_PATH):
            print("[Infer] Model lipsă — rulează train.py mai întâi")
            print("[Infer] Folosesc doar reguli hardcodate până atunci")
            return

        self._model  = joblib.load(MODEL_PATH)
        self._scaler = joblib.load(SCALER_PATH)
        print("[Infer] Model ML încărcat")

    def reload_model(self):
        """Reîncarcă modelul după reantrenare"""
        self._load_model()

    def is_ready(self) -> bool:
        return self._model is not None

    def score(self, reading: dict) -> dict:
        """
        Scorează o citire nouă.

        Input: dict cu valorile senzorilor
        Output: dict cu scor și decizie

        Exemplu input:
        {
            "temperature": 28.5,
            "humidity": 60.0,
            "gas_level": 150,
            "gas_alert": False,
            "motion": False,
            "light_lux": 45.0,
            "timestamp": 1710000000
        }
        """
        if not self.is_ready():
            return {
                "is_anomaly": False,
                "score": None,
                "model_active": False,
                "reason": "model_not_trained"
            }

        try:
            # Construiește DataFrame cu o singură citire
            df = pd.DataFrame([reading])
            df['time'] = pd.to_datetime(reading.get('timestamp', datetime.now()), unit='s')

            # Completează câmpuri lipsă
            df['gas_level']  = df.get('gas_level', pd.Series([0]))
            df['gas_alert']  = df.get('gas_alert', pd.Series([False]))
            df['light_lux']  = df.get('light_lux', pd.Series([0]))
            df['motion']     = df.get('motion', pd.Series([False])).astype(int)

            X = build_features(df)
            X_scaled = self._scaler.transform(X)

            # score_samples returnează anomaly score
            # Mai negativ = mai anormal
            score = float(self._model.score_samples(X_scaled)[0])
            is_anomaly = score < ANOMALY_THRESHOLD

            return {
                "is_anomaly": is_anomaly,
                "score": round(score, 4),
                "threshold": ANOMALY_THRESHOLD,
                "model_active": True,
                "reason": "ml_score" if is_anomaly else "normal"
            }

        except Exception as e:
            print(f"[Infer] Eroare scoring: {e}")
            return {
                "is_anomaly": False,
                "score": None,
                "model_active": False,
                "reason": f"error: {e}"
            }


# ─── Singleton pentru reutilizare ─────────────────────────
_detector = None

def get_detector() -> AnomalyDetector:
    global _detector
    if _detector is None:
        _detector = AnomalyDetector()
    return _detector


# ─── CLI pentru testare rapidă ────────────────────────────
if __name__ == "__main__":
    detector = get_detector()

    # Test cu citire normală
    normal = {
        "temperature": 22.0, "humidity": 55.0,
        "gas_level": 150, "gas_alert": False,
        "motion": False, "light_lux": 300.0,
        "timestamp": datetime.now().timestamp()
    }
    print("Citire normală:", detector.score(normal))

    # Test cu anomalie (temperatură ridicată noaptea)
    anomaly = {
        "temperature": 32.0, "humidity": 85.0,
        "gas_level": 200, "gas_alert": False,
        "motion": True, "light_lux": 5.0,
        "timestamp": datetime.now().timestamp()
    }
    print("Citire suspectă:", detector.score(anomaly))
```

### 4.5 scheduler.py — reantrenare automată zilnică

```python
# ~/gateway/ml/scheduler.py
# Rulează ca serviciu systemd — reantrenează modelul zilnic la 03:00

import schedule
import time
import subprocess
import logging
from datetime import datetime

logging.basicConfig(
    filename='/var/log/smarthome_ml.log',
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s'
)

VENV_PYTHON = "/home/pi/gateway/ml/venv/bin/python3"
TRAIN_SCRIPT = "/home/pi/gateway/ml/train.py"


def retrain():
    logging.info("Pornesc reantrenare model ML...")
    try:
        result = subprocess.run(
            [VENV_PYTHON, TRAIN_SCRIPT],
            capture_output=True, text=True, timeout=300
        )
        if result.returncode == 0:
            logging.info(f"Reantrenare reusita:\n{result.stdout}")
        else:
            logging.error(f"Eroare reantrenare:\n{result.stderr}")
    except subprocess.TimeoutExpired:
        logging.error("Timeout reantrenare (>5min)")
    except Exception as e:
        logging.error(f"Exceptie reantrenare: {e}")


# Reantrenare zilnică la 03:00 (activitate minimă în casă)
schedule.every().day.at("03:00").do(retrain)

logging.info("ML Scheduler pornit")
print("ML Scheduler pornit — reantrenare zilnică la 03:00")

while True:
    schedule.run_pending()
    time.sleep(60)
```

### 4.6 Serviciu systemd pentru ML scheduler

```bash
sudo nano /etc/systemd/system/smarthome-ml.service
```

```ini
[Unit]
Description=Smart Home ML Scheduler
After=network.target postgresql.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/gateway/ml
ExecStart=/home/pi/gateway/ml/venv/bin/python3 /home/pi/gateway/ml/scheduler.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable smarthome-ml
sudo systemctl start smarthome-ml
sudo systemctl status smarthome-ml
```

---

## 5. NestJS API

### 5.1 Instalare Node.js

```bash
# Node.js LTS via nvm (recomandat față de apt)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

nvm install --lts
nvm use --lts
node --version   # ar trebui v20.x

npm install -g @nestjs/cli
```

### 5.2 Creare proiect NestJS

```bash
mkdir -p ~/gateway/api
cd ~/gateway/api

nest new . --package-manager npm --skip-git
# Alege npm când e întrebat

npm install \
  @nestjs/websockets @nestjs/platform-socket.io \
  @nestjs/jwt @nestjs/passport \
  passport passport-jwt passport-local \
  pg typeorm @nestjs/typeorm \
  mqtt \
  bcrypt \
  class-validator class-transformer \
  @nestjs/config
```

### 5.3 .env — variabile de mediu

```bash
nano ~/gateway/api/.env
```

```env
# Baze de date
DB_HOST=localhost
DB_PORT=5432
DB_NAME=smarthome_db
DB_USER=smarthome
DB_PASS=parola_db_puternica

# MQTT (localhost fără TLS — aceeași mașină cu Mosquitto)
MQTT_URL=mqtt://localhost:1883
MQTT_USER=nestjs_api
MQTT_PASS=parola_mqtt_nestjs

# JWT
JWT_SECRET=un_secret_foarte_lung_si_random_minim_32_caractere
JWT_EXPIRES=7d

# Server
PORT=3000
NODE_ENV=production
```

### 5.4 MQTT Subscriber Service

```typescript
// src/mqtt/mqtt.service.ts
// Primește date de la ESP32 prin Mosquitto și le procesează

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { SensorsService } from '../sensors/sensors.service';
import { AlertsService } from '../alerts/alerts.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private client: mqtt.MqttClient;

  constructor(
    private config: ConfigService,
    private sensorsService: SensorsService,
    private alertsService: AlertsService,
    private eventEmitter: EventEmitter2,
  ) {}

  onModuleInit() {
    this.client = mqtt.connect(this.config.get('MQTT_URL'), {
      username: this.config.get('MQTT_USER'),
      password: this.config.get('MQTT_PASS'),
      clientId: 'nestjs_gateway',
      reconnectPeriod: 5000,
    });

    this.client.on('connect', () => {
      console.log('[MQTT] Conectat la Mosquitto');
      // Subscribe la toate nodurile
      this.client.subscribe('home/+/sensors', { qos: 1 });
      this.client.subscribe('home/alerts', { qos: 2 });
      this.client.subscribe('home/+/status', { qos: 1 });
    });

    this.client.on('message', (topic, payload) => {
      this.handleMessage(topic, payload.toString());
    });

    this.client.on('error', (err) => {
      console.error('[MQTT] Eroare:', err.message);
    });
  }

  private async handleMessage(topic: string, payload: string) {
    try {
      const data = JSON.parse(payload);

      if (topic.endsWith('/sensors')) {
        // Salvează în DB
        await this.sensorsService.savereading(data);

        // Emite event pentru WebSocket → aplicație mobilă
        this.eventEmitter.emit('sensor.reading', data);

        // Evaluează reguli automatizare
        await this.evaluateRules(data);

      } else if (topic === 'home/alerts') {
        await this.alertsService.createAlert(data);
        this.eventEmitter.emit('alert.new', data);

      } else if (topic.endsWith('/status')) {
        await this.sensorsService.updateNodeStatus(data);
        this.eventEmitter.emit('node.status', data);
      }

    } catch (e) {
      console.error(`[MQTT] Eroare procesare mesaj ${topic}:`, e.message);
    }
  }

  private async evaluateRules(sensorData: any) {
    // Citește regulile active din DB și evaluează
    // Dacă o regulă e îndeplinită, publică comandă pe MQTT
    const rules = await this.sensorsService.getActiveRules(sensorData.node_id);

    for (const rule of rules) {
      const value = sensorData.sensors?.[rule.sensor];
      if (value === undefined) continue;

      let triggered = false;
      const hour = new Date().getHours();

      // Verifică condiția
      switch (rule.operator) {
        case '>':  triggered = value > rule.threshold; break;
        case '<':  triggered = value < rule.threshold; break;
        case '>=': triggered = value >= rule.threshold; break;
        case '<=': triggered = value <= rule.threshold; break;
        case '==': triggered = value == rule.threshold; break;
      }

      // Verifică fereastra de timp dacă e setată
      if (triggered && rule.time_from && rule.time_to) {
        const fromH = parseInt(rule.time_from.split(':')[0]);
        const toH   = parseInt(rule.time_to.split(':')[0]);
        if (toH > fromH) {
          triggered = hour >= fromH && hour < toH;
        } else {
          // Interval peste miezul nopții (ex: 23:00-06:00)
          triggered = hour >= fromH || hour < toH;
        }
      }

      if (triggered) {
        this.publishCommand(sensorData.node_id, {
          action: rule.action_type,
          ...rule.action_params,
        });
      }
    }
  }

  publishCommand(nodeId: string, command: object) {
    const topic = `home/${nodeId}/commands`;
    this.client.publish(topic, JSON.stringify(command), { qos: 1 });
    console.log(`[MQTT] Comandă trimisă → ${topic}:`, command);
  }

  onModuleDestroy() {
    this.client?.end();
  }
}
```

### 5.5 WebSocket Gateway — date live

```typescript
// src/sensors/sensors.gateway.ts

import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { UseGuards } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: '*' },   // în producție: restricționează la IP-ul RPi
  namespace: '/live',
})
export class SensorsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedClients = 0;

  handleConnection(client: Socket) {
    this.connectedClients++;
    console.log(`[WS] Client conectat. Total: ${this.connectedClients}`);
  }

  handleDisconnect(client: Socket) {
    this.connectedClients--;
    console.log(`[WS] Client deconectat. Total: ${this.connectedClients}`);
  }

  @OnEvent('sensor.reading')
  handleSensorReading(data: any) {
    // Emite datele noi către toți clienții conectați
    this.server.emit('sensor_update', data);
  }

  @OnEvent('alert.new')
  handleNewAlert(data: any) {
    this.server.emit('alert', data);
  }

  @OnEvent('node.status')
  handleNodeStatus(data: any) {
    this.server.emit('node_status', data);
  }
}
```

### 5.6 Pornire NestJS ca serviciu

```bash
# Build pentru producție
cd ~/gateway/api
npm run build

# Serviciu systemd
sudo nano /etc/systemd/system/smarthome-api.service
```

```ini
[Unit]
Description=Smart Home NestJS API
After=network.target postgresql.service mosquitto.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/gateway/api
ExecStart=/home/pi/.nvm/versions/node/v20.11.0/bin/node dist/main.js
Restart=always
RestartSec=5
EnvironmentFile=/home/pi/gateway/api/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable smarthome-api
sudo systemctl start smarthome-api
sudo systemctl status smarthome-api

# Verifică că API-ul răspunde
curl http://localhost:3000/api/sensors/latest
```

---

## 6. Antrenare primului model ML

```bash
# Activează venv
source ~/gateway/ml/venv/bin/activate

# Rulează antrenarea manuală prima dată
# (după cel puțin 14 zile de date colectate)
python3 ~/gateway/ml/train.py

# Testează inferența
python3 ~/gateway/ml/infer.py
```

---

## 7. Monitorizare și comenzi utile

```bash
# Status toate serviciile
sudo systemctl status mosquitto postgresql smarthome-api smarthome-ml

# Logs în timp real
sudo journalctl -u smarthome-api -f
sudo journalctl -u smarthome-ml -f
tail -f /var/log/mosquitto/mosquitto.log
tail -f /var/log/smarthome_ml.log

# Verifică date în DB (ultimele 10 citiri)
psql -U smarthome -d smarthome_db -h localhost \
  -c "SELECT time, node_id, temperature, humidity, gas_alert, motion FROM sensor_readings ORDER BY time DESC LIMIT 10;"

# Verifică câte rânduri sunt în DB
psql -U smarthome -d smarthome_db -h localhost \
  -c "SELECT node_id, COUNT(*) as citiri, MIN(time) as prima, MAX(time) as ultima FROM sensor_readings GROUP BY node_id;"

# Memorie RAM folosită
free -h

# Spațiu disc (SD card)
df -h
```

---

## 8. Verificare înainte să treci la Layer 4

- [ ] IP static 192.168.1.100 configurat și persistent după reboot
- [ ] Mosquitto rulează pe portul 8883 (TLS) și 1883 (localhost)
- [ ] Certificatele TLS generate și copiate pe ESP32
- [ ] ESP32 se conectează cu TLS și publică date (verifici în log Mosquitto)
- [ ] TimescaleDB activ — date din ESP32 apar în `sensor_readings`
- [ ] `train.py` rulează fără erori (chiar dacă zice "insuficiente date" e OK)
- [ ] `infer.py` returnează scor pentru citiri de test
- [ ] ML scheduler pornit ca serviciu systemd
- [ ] NestJS API răspunde la `http://192.168.1.100:3000/api/sensors/latest`
- [ ] WebSocket emite date live (testezi din browser cu un client Socket.io)

---

*Următorul document: `04_layer4_api.md` — NestJS complet: toate endpoint-urile, autentificare JWT, integrare ML scoring, WebSocket, structura modulelor.*
