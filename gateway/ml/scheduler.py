import schedule
import time
import subprocess
import logging
import os
from datetime import datetime

logging.basicConfig(
    filename='/var/log/smarthome_ml.log',
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s'
)

VENV_PYTHON  = os.path.join(os.path.dirname(__file__), "venv/bin/python3")
TRAIN_SCRIPT = os.path.join(os.path.dirname(__file__), "train.py")


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


schedule.every().day.at("03:00").do(retrain)

logging.info("ML Scheduler pornit")
print("ML Scheduler pornit — reantrenare zilnică la 03:00")

while True:
    schedule.run_pending()
    time.sleep(60)
