import ssl
import time
import json
import machine
import network
from umqtt.simple import MQTTClient
import config


class MQTTManager:
    def __init__(self, on_command_callback=None):
        self._client = None
        self._connected = False
        self._on_command = on_command_callback
        self._reconnect_delay = 5

    def _load_cert(self, path: str) -> bytes:
        try:
            with open(path, 'rb') as f:
                return f.read()
        except OSError:
            print(f"[MQTT] Certificat lipsă: {path}")
            return None

    def connect(self) -> bool:
        try:
            ssl_params = {
                "key":    self._load_cert(config.TLS_CLIENT_KEY),
                "cert":   self._load_cert(config.TLS_CLIENT_CERT),
                "cadata": self._load_cert(config.TLS_CA_CERT),
                "cert_reqs": ssl.CERT_REQUIRED,
                "server_hostname": config.MQTT_BROKER
            }

            self._client = MQTTClient(
                client_id  = config.NODE_ID,
                server     = config.MQTT_BROKER,
                port       = config.MQTT_PORT,
                user       = config.MQTT_USER,
                password   = config.MQTT_PASSWORD,
                keepalive  = config.MQTT_KEEPALIVE,
                ssl        = True,
                ssl_params = ssl_params
            )

            self._client.set_callback(self._on_message)

            last_will = json.dumps({
                "node_id": config.NODE_ID,
                "status": "offline",
                "timestamp": time.time()
            })
            self._client.set_last_will(
                config.TOPIC_STATUS,
                last_will.encode(),
                retain=True,
                qos=1
            )

            self._client.connect()
            self._connected = True
            self._client.subscribe(config.TOPIC_COMMANDS.encode(), qos=1)
            self._publish_status("online")
            print(f"[MQTT] Conectat la {config.MQTT_BROKER}:{config.MQTT_PORT}")
            return True

        except Exception as e:
            print(f"[MQTT] Eroare conectare: {e}")
            self._connected = False
            return False

    def _on_message(self, topic: bytes, msg: bytes):
        try:
            payload = json.loads(msg.decode())
            print(f"[MQTT] Comandă primită: {payload}")
            if self._on_command:
                self._on_command(payload)
        except Exception as e:
            print(f"[MQTT] Eroare procesare comandă: {e}")

    def _publish_status(self, status: str):
        payload = json.dumps({
            "node_id": config.NODE_ID,
            "status": status,
            "timestamp": time.time(),
            "location": config.NODE_LOCATION
        })
        try:
            self._client.publish(
                config.TOPIC_STATUS.encode(),
                payload.encode(),
                retain=True,
                qos=1
            )
        except:
            pass

    def publish_sensors(self, sensor_data: dict) -> bool:
        if not self._connected:
            print("[MQTT] Nu e conectat — date pierdute")
            return False

        payload = json.dumps({
            "node_id": config.NODE_ID,
            "timestamp": time.time(),
            "location": config.NODE_LOCATION,
            "sensors": sensor_data
        })

        try:
            self._client.publish(
                config.TOPIC_SENSORS.encode(),
                payload.encode(),
                qos=config.MQTT_QOS_SENSORS
            )
            return True
        except Exception as e:
            print(f"[MQTT] Eroare publish senzori: {e}")
            self._connected = False
            return False

    def publish_alert(self, alert_type: str, details: dict) -> bool:
        payload = json.dumps({
            "node_id": config.NODE_ID,
            "timestamp": time.time(),
            "alert_type": alert_type,
            "location": config.NODE_LOCATION,
            "details": details
        })

        try:
            self._client.publish(
                config.TOPIC_ALERTS.encode(),
                payload.encode(),
                qos=config.MQTT_QOS_ALERTS
            )
            print(f"[MQTT] Alertă publicată: {alert_type}")
            return True
        except Exception as e:
            print(f"[MQTT] Eroare publish alertă: {e}")
            return False

    def check_messages(self):
        if not self._connected:
            return
        try:
            self._client.check_msg()
        except Exception as e:
            print(f"[MQTT] Eroare check_msg: {e}")
            self._connected = False

    def reconnect_if_needed(self) -> bool:
        if self._connected:
            return True

        wlan = network.WLAN(network.STA_IF)
        if not wlan.isconnected():
            print("[MQTT] WiFi deconectat — aștept reconectare WiFi...")
            return False

        print(f"[MQTT] Încerc reconectare în {self._reconnect_delay}s...")
        time.sleep(self._reconnect_delay)
        return self.connect()

    def disconnect(self):
        if self._client and self._connected:
            self._publish_status("offline")
            self._client.disconnect()
            self._connected = False
