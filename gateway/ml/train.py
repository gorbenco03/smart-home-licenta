import os
import sys
import joblib
import pandas as pd
from datetime import datetime
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import psycopg2

from features import build_features, FEATURE_NAMES

DB_CONFIG = {
    "host":     "localhost",
    "dbname":   "smarthome_db",
    "user":     "smarthome",
    "password": os.environ.get("DB_PASS", "parola_db_puternica")
}

MODEL_DIR   = os.path.join(os.path.dirname(__file__), "models")
MODEL_PATH  = os.path.join(MODEL_DIR, "isolation_forest.pkl")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.pkl")

CONTAMINATION   = 0.05
N_ESTIMATORS    = 100
TRAINING_DAYS   = 30
MIN_ROWS_NEEDED = 500


def load_training_data() -> pd.DataFrame:
    print(f"[Train] Citesc ultimele {TRAINING_DAYS} zile din DB...")

    query = """
        SELECT time, node_id, temperature, humidity,
               gas_level, gas_alert, motion, light_lux
        FROM sensor_readings
        WHERE time > NOW() - INTERVAL %s
          AND gas_alert = FALSE
        ORDER BY time ASC
    """

    try:
        conn = psycopg2.connect(**DB_CONFIG)
        df = pd.read_sql_query(query, conn, params=(f"{TRAINING_DAYS} days",))
        conn.close()
        print(f"[Train] {len(df)} citiri încărcate")
        return df
    except Exception as e:
        print(f"[Train] Eroare DB: {e}")
        sys.exit(1)


def train_model(df: pd.DataFrame):
    if len(df) < MIN_ROWS_NEEDED:
        print(f"[Train] Insuficiente date: {len(df)} < {MIN_ROWS_NEEDED}")
        print("[Train] Mai colectează date și încearcă mai târziu.")
        sys.exit(0)

    print("[Train] Construiesc feature-uri...")
    X = build_features(df)
    print(f"[Train] Shape features: {X.shape}")

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    print(f"[Train] Antrenez Isolation Forest (contamination={CONTAMINATION})...")
    model = IsolationForest(
        n_estimators=N_ESTIMATORS,
        contamination=CONTAMINATION,
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_scaled)

    predictions = model.predict(X_scaled)
    n_anomalies = (predictions == -1).sum()
    print(f"[Train] Anomalii în date antrenare: {n_anomalies} ({n_anomalies/len(df)*100:.1f}%)")

    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    print(f"[Train] Model salvat: {MODEL_PATH}")

    _log_model_to_db(len(df))
    return model, scaler


def _log_model_to_db(training_rows: int):
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        cur.execute("UPDATE ml_models SET is_active = FALSE")
        cur.execute("""
            INSERT INTO ml_models (version, training_rows, contamination, features, is_active)
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
    print(f"[Train] ══ Antrenare {datetime.now().strftime('%Y-%m-%d %H:%M')} ══")
    df = load_training_data()
    train_model(df)
    print("[Train] ══ Finalizat ══")
