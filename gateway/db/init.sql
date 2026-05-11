-- Schema completă Smart Home
-- Rulează: psql -U smarthome -d smarthome_db -h localhost -f init.sql

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ── Date senzori (time-series) ────────────────────────────
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
  temp_delta_1h FLOAT,
  motion_count_1h INTEGER
);

SELECT create_hypertable('sensor_readings', 'time');
CREATE INDEX ON sensor_readings (node_id, time DESC);
SELECT add_retention_policy('sensor_readings', INTERVAL '1 year');

ALTER TABLE sensor_readings SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'node_id'
);
SELECT add_compression_policy('sensor_readings', INTERVAL '7 days');

-- ── Alerte ───────────────────────────────────────────────
CREATE TABLE alerts (
  id              SERIAL          PRIMARY KEY,
  time            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  node_id         TEXT            NOT NULL,
  alert_type      TEXT            NOT NULL,
  severity        TEXT            NOT NULL DEFAULT 'medium',
  location        TEXT,
  details         JSONB,
  acknowledged    BOOLEAN         DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ
);

CREATE INDEX ON alerts (time DESC);
CREATE INDEX ON alerts (acknowledged, time DESC);

-- ── Utilizatori ──────────────────────────────────────────
CREATE TABLE users (
  id            SERIAL          PRIMARY KEY,
  username      TEXT            UNIQUE NOT NULL,
  email         TEXT            UNIQUE NOT NULL,
  password_hash TEXT            NOT NULL,
  created_at    TIMESTAMPTZ     DEFAULT NOW(),
  last_login    TIMESTAMPTZ
);

-- ── Reguli automatizare ──────────────────────────────────
CREATE TABLE automation_rules (
  id            SERIAL          PRIMARY KEY,
  name          TEXT            NOT NULL,
  description   TEXT,
  node_id       TEXT,
  sensor        TEXT            NOT NULL,
  operator      TEXT            NOT NULL,
  threshold     FLOAT           NOT NULL,
  time_from     TIME,
  time_to       TIME,
  days_of_week  INTEGER[],
  action_type   TEXT            NOT NULL,
  action_target TEXT,
  action_params JSONB,
  enabled       BOOLEAN         DEFAULT TRUE,
  created_at    TIMESTAMPTZ     DEFAULT NOW()
);

-- ── Noduri ESP32 ─────────────────────────────────────────
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
  ('esp32_node_a', 'living',   'Nod principal - living si bucatarie'),
  ('esp32_node_b', 'dormitor', 'Nod secundar - dormitor si baie');

-- ── ML model metadata ────────────────────────────────────
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

-- ── View: ultimele citiri per nod ────────────────────────
CREATE VIEW latest_readings AS
SELECT DISTINCT ON (node_id)
  node_id, location, time,
  temperature, humidity, gas_level,
  gas_alert, motion, light_lux
FROM sensor_readings
ORDER BY node_id, time DESC;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO smarthome;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO smarthome;
