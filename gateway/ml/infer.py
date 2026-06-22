import joblib
import pandas as pd
import os
from datetime import datetime

from features import build_features

MODEL_DIR   = os.path.join(os.path.dirname(__file__), "models")
MODEL_PATH  = os.path.join(MODEL_DIR, "isolation_forest.pkl")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.pkl")

ANOMALY_THRESHOLD = -0.1


class AnomalyDetector:
    def __init__(self):
        self._model  = None
        self._scaler = None
        self._load_model()

    def _load_model(self):
        if not os.path.exists(MODEL_PATH):
            print("[Infer] Model lipsă — rulează train.py mai întâi")
            return

        self._model  = joblib.load(MODEL_PATH)
        self._scaler = joblib.load(SCALER_PATH)
        print("[Infer] Model ML încărcat")

    def reload_model(self):
        self._load_model()

    def is_ready(self) -> bool:
        return self._model is not None

    def score(self, reading: dict) -> dict:
        if not self.is_ready():
            return {
                "is_anomaly": False,
                "score": None,
                "model_active": False,
                "reason": "model_not_trained"
            }

        try:
            df = pd.DataFrame([reading])
            df['time']       = pd.to_datetime(reading.get('timestamp', datetime.now().timestamp()), unit='s')
            df['gas_level']  = reading.get('gas_level', 0)
            df['gas_alert']  = reading.get('gas_alert', False)
            # light1 (LDR ADC 0–1023) este sursa primară; light_lux = alias backward-compat
            df['light1']     = reading.get('light1', reading.get('light_lux', 0))
            df['light_lux']  = df['light1']
            df['motion']     = int(reading.get('motion', False))
            # DHT11 #2 — opțional; features.py face fallback la #1 dacă lipsește
            if 'temperature2' in reading:
                df['temperature2'] = reading['temperature2']
            if 'humidity2' in reading:
                df['humidity2'] = reading['humidity2']

            X = build_features(df)
            X_scaled = self._scaler.transform(X)
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


_detector = None


def get_detector() -> AnomalyDetector:
    global _detector
    if _detector is None:
        _detector = AnomalyDetector()
    return _detector


if __name__ == "__main__":
    detector = get_detector()

    normal = {
        "temperature": 22.0, "humidity": 55.0,
        "temperature2": 21.5, "humidity2": 57.0,
        "gas_level": 150, "gas_alert": False,
        "motion": False, "light1": 410, "light_lux": 410,
        "timestamp": datetime.now().timestamp()
    }
    print("Citire normală:", detector.score(normal))

    anomaly = {
        "temperature": 32.0, "humidity": 85.0,
        "temperature2": 31.2, "humidity2": 83.0,
        "gas_level": 200, "gas_alert": False,
        "motion": True, "light1": 5, "light_lux": 5,
        "timestamp": datetime.now().timestamp()
    }
    print("Citire suspectă:", detector.score(anomaly))
