# Layer 2 — Noduri ESP32

> **Document:** 02 din 05
> **Prerequisite:** Layer 1 complet și verificat — toți senzorii funcționează individual
> **Timp estimat setup:** 2-3 ore
> **Ce obții la final:** ESP32 trimite date reale la fiecare 30s pe Raspberry Pi prin MQTT over TLS

---

## 1. Instalare MicroPython pe ESP32-C3

### 1.1 Descarcă firmware-ul corect

Mergi la https://micropython.org/download/ESP32_GENERIC_C3/ și descarcă cel mai recent `.bin` stable.

> **Atenție:** ESP32-C3 are firmware diferit față de ESP32 clasic. Nu folosi `ESP32_GENERIC` — nu va porni.

### 1.2 Instalare esptool și flash

```bash
# Pe calculatorul tău (Windows/Mac/Linux)
pip install esptool

# Identifică portul ESP32
# Windows: Device Manager → Ports → COMx
# Linux/Mac:
ls /dev/tty*   # caută /dev/ttyUSB0 sau /dev/ttyACM0

# Șterge flash-ul vechi (OBLIGATORIU înainte de flash nou)
esptool.py --chip esp32c3 --port /dev/ttyUSB0 erase_flash

# Flash firmware MicroPython
esptool.py --chip esp32c3 --port /dev/ttyUSB0 --baud 460800 \
  write_flash -z 0x0 ESP32_GENERIC_C3-20240602-v1.23.0.bin
```

### 1.3 Verificare și acces REPL

```bash
# Instalează mpremote pentru a lucra cu ESP32
pip install mpremote

# Conectare REPL (terminal interactiv pe ESP32)
mpremote connect /dev/ttyUSB0

# Dacă totul e OK, vei vedea:
# MicroPython v1.23.0 on 2024-06-02; ESP32C3 module with ESP32-C3
# Type "help()" for more information.
# >>>
```

### 1.4 Tool recomandat — Thonny IDE

Pentru dezvoltare mai comodă, Thonny IDE (https://thonny.org) are suport nativ MicroPython:
- Run → Select interpreter → MicroPython (ESP32)
- File browser direct pe filesystem-ul ESP32
- Upload/download fișiere cu drag & drop

---

## 2. Structura fișierelor pe ESP32

```
/ (root filesystem ESP32)
├── boot.py          ← rulează automat la pornire (conectare WiFi)
├── main.py          ← rulează după boot.py (loop principal)
├── config.py        ← credențiale WiFi, adresa broker, setări
├── sensors/
│   ├── __init__.py
│   ├── dht22.py     ← din Layer 1
│   ├── mq2.py       ← din Layer 1
│   ├── pir.py       ← din Layer 1
│   └── bh1750.py    ← din Layer 1
├── actuators/
│   ├── __init__.py
│   ├── relay.py     ← din Layer 1
│   └── buzzer.py    ← din Layer 1
├── mqtt_client.py   ← conexiune MQTT + TLS
└── certs/
    ├── ca.crt       ← certificat CA (generat pe Raspberry Pi, Layer 3)
    ├── client.crt   ← certificat client ESP32
    └── client.key   ← cheie privată client
```

> **Notă despre certificate:** Fișierele din `certs/` le generezi în Layer 3 și le copiezi pe ESP32 după. Deocamdată lasă folderul gol.

---

## 3. config.py — toate setările într-un loc

```python
# config.py
# NU pune acest fișier pe GitHub! Adaugă-l în .gitignore

# ─── WiFi ────────────────────────────────────────────────
WIFI_SSID     = "numele_retelei_tale"
WIFI_PASSWORD = "parola_wifi"
WIFI_TIMEOUT  = 15  # secunde timeout conectare

# ─── Identitate nod ──────────────────────────────────────
NODE_ID       = "esp32_node_a"          # unic per ESP32
NODE_LOCATION = "living"                # pentru logging

# ─── MQTT Broker (Raspberry Pi) ──────────────────────────
MQTT_BROKER   = "192.168.1.100"        # IP-ul Raspberry Pi în rețeaua locală
MQTT_PORT     = 8883                    # TLS port (1883 = fără TLS, doar pentru test)
MQTT_USER     = "esp32_node_a"          # user creat în Mosquitto
MQTT_PASSWORD = "parola_mqtt_node_a"    # parolă Mosquitto

# ─── Topic-uri MQTT ──────────────────────────────────────
TOPIC_SENSORS  = f"home/{NODE_ID}/sensors"
TOPIC_COMMANDS = f"home/{NODE_ID}/commands"
TOPIC_ALERTS   = "home/alerts"
TOPIC_STATUS   = f"home/{NODE_ID}/status"

# ─── Certificate TLS ─────────────────────────────────────
TLS_CA_CERT     = "/certs/ca.crt"
TLS_CLIENT_CERT = "/certs/client.crt"
TLS_CLIENT_KEY  = "/certs/client.key"

# ─── Senzori — pini GPIO ─────────────────────────────────
PIN_DHT22         = 4
PIN_MQ2_DIGITAL   = 5
PIN_MQ2_ANALOG    = 0
PIN_PIR           = 6
PIN_BH1750_SDA    = 8
PIN_BH1750_SCL    = 9

# ─── Actuatori — pini GPIO ───────────────────────────────
PIN_RELAY_1       = 7   # lumină
PIN_RELAY_2       = 10  # ventilator
PIN_RELAY_3       = 3   # rezervat
PIN_RELAY_4       = 2   # rezervat
PIN_BUZZER        = 1

# ─── Comportament sistem ─────────────────────────────────
READ_INTERVAL_S      = 30     # citire senzori la fiecare N secunde
GAS_ALERT_THRESHOLD  = 400    # nivel ADC peste care se declanșează alertă
MQTT_KEEPALIVE       = 60     # keepalive MQTT în secunde
MQTT_QOS_SENSORS     = 1      # QoS pentru date normale
MQTT_QOS_ALERTS      = 2      # QoS pentru alerte critice (exact once)
```

---

## 4. boot.py — conectare WiFi la pornire

```python
# boot.py
# Rulează automat la fiecare pornire/restart ESP32

import network
import time
import machine
import config

def connect_wifi() -> bool:
    """
    Conectează ESP32 la WiFi.
    Returnează True dacă reușește, False dacă timeout.
    """
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)

    if wlan.isconnected():
        print(f"[WiFi] Deja conectat: {wlan.ifconfig()[0]}")
        return True

    print(f"[WiFi] Conectare la '{config.WIFI_SSID}'...")
    wlan.connect(config.WIFI_SSID, config.WIFI_PASSWORD)

    timeout = config.WIFI_TIMEOUT
    while not wlan.isconnected() and timeout > 0:
        print(".", end="")
        time.sleep(1)
        timeout -= 1

    if wlan.isconnected():
        ip, netmask, gateway, dns = wlan.ifconfig()
        print(f"\n[WiFi] Conectat!")
        print(f"[WiFi] IP: {ip} | Gateway: {gateway}")
        return True
    else:
        print(f"\n[WiFi] EROARE: Nu s-a putut conecta în {config.WIFI_TIMEOUT}s")
        return False


def sync_time():
    """
    Sincronizează ceasul intern cu NTP.
    Necesar pentru TLS — certificatele au dată de expirare.
    """
    import ntptime
    try:
        ntptime.settime()
        print(f"[NTP] Timp sincronizat")
    except Exception as e:
        print(f"[NTP] Eroare sincronizare timp: {e}")
        print("[NTP] TLS poate eșua fără timp corect!")


# ─── Entry point boot ────────────────────────────────────
connected = connect_wifi()

if connected:
    sync_time()
else:
    print("[Boot] WiFi indisponibil — restart în 30s")
    time.sleep(30)
    machine.reset()
```

---

## 5. mqtt_client.py — conexiune MQTT cu TLS

```python
# mqtt_client.py

import ssl
import time
import json
import machine
import network
from umqtt.simple import MQTTClient
import config

class MQTTManager:
    """
    Gestionează conexiunea MQTT cu TLS mutual authentication.
    Reconectare automată la pierderea conexiunii.
    """

    def __init__(self, on_command_callback=None):
        self._client = None
        self._connected = False
        self._on_command = on_command_callback
        self._reconnect_delay = 5   # secunde între încercări de reconectare
        self._message_queue = []    # mesaje în așteptare dacă e deconectat

    def _load_cert(self, path: str) -> bytes:
        """Citește un fișier certificat din filesystem"""
        try:
            with open(path, 'rb') as f:
                return f.read()
        except OSError:
            print(f"[MQTT] Certificat lipsă: {path}")
            print("[MQTT] Copiază certificatele din Layer 3!")
            return None

    def _create_ssl_context(self):
        """Creează context SSL cu certificate mutuale"""
        ca_cert     = self._load_cert(config.TLS_CA_CERT)
        client_cert = self._load_cert(config.TLS_CLIENT_CERT)
        client_key  = self._load_cert(config.TLS_CLIENT_KEY)

        if not all([ca_cert, client_cert, client_key]):
            raise RuntimeError("Certificate TLS lipsă — nu pot conecta securizat")

        return ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)

    def connect(self) -> bool:
        """
        Conectează la broker MQTT cu TLS.
        Returnează True la succes.
        """
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

            # Setează callback pentru mesaje primite (comenzi)
            self._client.set_callback(self._on_message)

            # Mesaj "last will" — publicat automat de broker dacă ESP32 se deconectează
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

            # Subscribe la topic-ul de comenzi
            self._client.subscribe(config.TOPIC_COMMANDS.encode(), qos=1)

            # Publică status online
            self._publish_status("online")
            print(f"[MQTT] Conectat la {config.MQTT_BROKER}:{config.MQTT_PORT}")
            return True

        except Exception as e:
            print(f"[MQTT] Eroare conectare: {e}")
            self._connected = False
            return False

    def _on_message(self, topic: bytes, msg: bytes):
        """
        Callback apelat când sosește o comandă de la gateway.
        Exemplu mesaj: {"action": "relay_on", "relay": 1}
        """
        try:
            topic_str = topic.decode()
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
        """
        Publică date senzori pe topic-ul standard.
        Returnează True la succes.
        """
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
        """
        Publică alertă critică cu QoS 2 (exact once).
        Folosit pentru gaz, fum, mișcare nocturnă.
        """
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
        """
        Verifică dacă au sosit mesaje noi (comenzi).
        Apelează în loop-ul principal.
        """
        if not self._connected:
            return
        try:
            self._client.check_msg()
        except Exception as e:
            print(f"[MQTT] Eroare check_msg: {e}")
            self._connected = False

    def reconnect_if_needed(self) -> bool:
        """
        Verifică și reconectează dacă e necesar.
        Apelează periodic în loop-ul principal.
        """
        if self._connected:
            return True

        # Verifică mai întâi WiFi
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
```

---

## 6. main.py — loop-ul principal

```python
# main.py
# Loop principal: citire senzori → publicare MQTT → procesare comenzi → alertă locală

import time
import config

from sensors.dht22   import DHT22Sensor
from sensors.mq2     import MQ2Sensor
from sensors.pir     import PIRSensor
from sensors.bh1750  import BH1750Sensor
from actuators.relay import RelayModule
from actuators.buzzer import Buzzer
from mqtt_client     import MQTTManager

# ─── Inițializare hardware ───────────────────────────────
print(f"\n[Boot] Node: {config.NODE_ID} | Location: {config.NODE_LOCATION}")
print("[Boot] Inițializare senzori...")

dht22  = DHT22Sensor(pin_number=config.PIN_DHT22)
mq2    = MQ2Sensor(digital_pin=config.PIN_MQ2_DIGITAL, analog_pin=config.PIN_MQ2_ANALOG)
pir    = PIRSensor(pin_number=config.PIN_PIR)
bh1750 = BH1750Sensor(sda_pin=config.PIN_BH1750_SDA, scl_pin=config.PIN_BH1750_SCL)
relay  = RelayModule(
    pins=[config.PIN_RELAY_1, config.PIN_RELAY_2, config.PIN_RELAY_3, config.PIN_RELAY_4],
    active_low=True
)
buzzer = Buzzer(pin_number=config.PIN_BUZZER)

print("[Boot] Hardware OK")

# ─── Handler comenzi primite de la gateway ───────────────
def handle_command(payload: dict):
    """
    Procesează comenzile primite prin MQTT de la gateway/aplicație.

    Formate suportate:
      {"action": "relay_on",  "relay": 0}  → pornește relay 1
      {"action": "relay_off", "relay": 0}  → oprește relay 1
      {"action": "buzzer_beep", "count": 3}
      {"action": "all_off"}               → oprește tot (urgență)
    """
    action = payload.get("action", "")

    if action == "relay_on":
        relay_idx = payload.get("relay", 0)
        relay.on(relay_idx)
        buzzer.confirm()

    elif action == "relay_off":
        relay_idx = payload.get("relay", 0)
        relay.off(relay_idx)

    elif action == "relay_toggle":
        relay_idx = payload.get("relay", 0)
        relay.toggle(relay_idx)

    elif action == "buzzer_beep":
        count = payload.get("count", 1)
        buzzer.beep(count=count)

    elif action == "all_off":
        relay.all_off()
        buzzer.off()
        print("[CMD] Emergency all_off executat")

    else:
        print(f"[CMD] Comandă necunoscută: {action}")


# ─── Inițializare MQTT ───────────────────────────────────
mqtt = MQTTManager(on_command_callback=handle_command)

print("[Boot] Conectare MQTT...")
if not mqtt.connect():
    print("[Boot] MQTT indisponibil la start — voi reîncerca în loop")

buzzer.confirm()  # beep scurt = sistem pornit OK
print("[Boot] Sistem activ\n")

# ─── Variabile stare ─────────────────────────────────────
last_read_time   = 0
last_reconnect   = 0
gas_alert_active = False

# ─── Loop principal ──────────────────────────────────────
while True:
    now = time.time()

    # ── 1. Verifică/reconectează MQTT ────────────────────
    if now - last_reconnect >= 30:
        mqtt.reconnect_if_needed()
        last_reconnect = now

    # ── 2. Verifică comenzi primite ──────────────────────
    mqtt.check_messages()

    # ── 3. Citire senzori și publicare ───────────────────
    if now - last_read_time >= config.READ_INTERVAL_S:
        last_read_time = now

        # Citire toți senzorii
        dht_data  = dht22.read()
        mq2_data  = mq2.read()
        pir_data  = pir.read()
        bh1750_data = bh1750.read()

        # ── 4. Alertă gaz — reacție imediată locală ──────
        # Nu așteptăm gateway-ul — ESP32 reacționează direct
        if mq2_data.get("gas_alert") and mq2_data.get("warmed_up"):
            if not gas_alert_active:
                gas_alert_active = True
                print("[ALERT] GAZ DETECTAT — reacție locală imediată!")

                # Oprire relay electric (siguranță)
                relay.all_off()

                # Alertă sonoră imediată
                buzzer.alert_gas()

                # Publică alertă cu QoS 2
                mqtt.publish_alert("GAS_DETECTED", {
                    "gas_level": mq2_data["gas_level"],
                    "location": config.NODE_LOCATION
                })
        else:
            if gas_alert_active:
                print("[ALERT] Gaz dispărut — resetez alerta")
                gas_alert_active = False

        # ── 5. Alertă mișcare nocturnă ───────────────────
        # Verificare oră — alert dacă mișcare între 23:00-06:00
        # time.localtime() returnează (year, month, day, hour, ...)
        current_hour = time.localtime()[3]
        if pir_data.get("motion") and (current_hour >= 23 or current_hour < 6):
            mqtt.publish_alert("MOTION_NIGHT", {
                "location": config.NODE_LOCATION,
                "hour": current_hour
            })
            buzzer.alert_motion()

        # ── 6. Construiește payload date senzori ─────────
        sensor_payload = {
            "temperature":  dht_data.get("temperature"),
            "humidity":     dht_data.get("humidity"),
            "temp_valid":   dht_data.get("valid", False),
            "gas_level":    mq2_data.get("gas_level"),
            "gas_alert":    mq2_data.get("gas_alert", False),
            "gas_warmed":   mq2_data.get("warmed_up", False),
            "motion":       pir_data.get("motion", False),
            "light_lux":    bh1750_data.get("light_lux"),
            "light_valid":  bh1750_data.get("valid", False)
        }

        # ── 7. Publică pe MQTT ───────────────────────────
        success = mqtt.publish_sensors(sensor_payload)

        # Log local
        temp = sensor_payload.get("temperature", "N/A")
        hum  = sensor_payload.get("humidity", "N/A")
        gas  = sensor_payload.get("gas_level", "N/A")
        lux  = sensor_payload.get("light_lux", "N/A")
        mot  = "DA" if sensor_payload.get("motion") else "nu"
        pub  = "OK" if success else "EROARE"

        print(f"[{now}] T:{temp}°C H:{hum}% G:{gas} L:{lux}lx M:{mot} → MQTT:{pub}")

    # ── 8. Mică pauză să nu blocheze CPU ─────────────────
    time.sleep_ms(200)
```

---

## 7. Cum copiezi fișierele pe ESP32

```bash
# Folosind mpremote de pe calculatorul tău

# Creează structura de foldere pe ESP32
mpremote connect /dev/ttyUSB0 mkdir sensors
mpremote connect /dev/ttyUSB0 mkdir actuators
mpremote connect /dev/ttyUSB0 mkdir certs

# Copiază fișierele (din folderul proiectului tău)
mpremote connect /dev/ttyUSB0 cp config.py :config.py
mpremote connect /dev/ttyUSB0 cp boot.py :boot.py
mpremote connect /dev/ttyUSB0 cp main.py :main.py
mpremote connect /dev/ttyUSB0 cp mqtt_client.py :mqtt_client.py

mpremote connect /dev/ttyUSB0 cp sensors/dht22.py :sensors/dht22.py
mpremote connect /dev/ttyUSB0 cp sensors/mq2.py :sensors/mq2.py
mpremote connect /dev/ttyUSB0 cp sensors/pir.py :sensors/pir.py
mpremote connect /dev/ttyUSB0 cp sensors/bh1750.py :sensors/bh1750.py

mpremote connect /dev/ttyUSB0 cp actuators/relay.py :actuators/relay.py
mpremote connect /dev/ttyUSB0 cp actuators/buzzer.py :actuators/buzzer.py

# __init__.py gol pentru foldere ca module Python
echo "" | mpremote connect /dev/ttyUSB0 cp - :sensors/__init__.py
echo "" | mpremote connect /dev/ttyUSB0 cp - :actuators/__init__.py

# Verifică ce e pe ESP32
mpremote connect /dev/ttyUSB0 ls
mpremote connect /dev/ttyUSB0 ls sensors/
```

> **Certificatele TLS** (`certs/`) le copiezi **după** ce le generezi în Layer 3. Deocamdată lasă folderul gol.

---

## 8. Test fără TLS — pentru debugging rapid

Înainte să ai certificatele generate (Layer 3), poți testa cu MQTT simplu pe portul 1883. Modifică temporar în `config.py`:

```python
# config.py — versiune TEST (fără TLS)
MQTT_PORT = 1883  # în loc de 8883
```

Și în `mqtt_client.py`, înlocuiește temporar blocul `ssl_params`:

```python
# Versiune fără TLS — DOAR PENTRU TEST LOCAL
self._client = MQTTClient(
    client_id = config.NODE_ID,
    server    = config.MQTT_BROKER,
    port      = 1883,
    user      = config.MQTT_USER,
    password  = config.MQTT_PASSWORD,
    keepalive = config.MQTT_KEEPALIVE,
    ssl       = False   # fără TLS
)
```

> **Revino la TLS** după ce generezi certificatele în Layer 3. Nu lăsa portul 1883 deschis în producție.

---

## 9. Node B — diferențe față de Node A

Node B (dormitor/baie) e identic cu Node A cu excepția `config.py`:

```python
# config.py pentru Node B — doar ce diferă

NODE_ID       = "esp32_node_b"
NODE_LOCATION = "dormitor"

MQTT_USER     = "esp32_node_b"
MQTT_PASSWORD = "parola_mqtt_node_b"

TOPIC_SENSORS  = "home/esp32_node_b/sensors"
TOPIC_COMMANDS = "home/esp32_node_b/commands"
TOPIC_STATUS   = "home/esp32_node_b/status"

# Pini identici dacă hardware-ul e la fel
# Ajustează dacă ai senzori diferiți pe Node B
```

Codul `main.py`, `boot.py`, `mqtt_client.py` și toți senzorii sunt **identici**. Copiezi același cod, schimbi doar `config.py`.

---

## 10. Depanare probleme comune

### ESP32 nu se conectează la WiFi

```python
# Rulează în REPL pentru diagnostic
import network
wlan = network.WLAN(network.STA_IF)
wlan.active(True)
print(wlan.scan())  # listează rețelele WiFi văzute
# Dacă lista e goală — ESP32 nu vede rețeaua, verifică antena
```

### MQTT connection refused

```
Cauze posibile:
1. IP greșit în config.py — verifică IP-ul Raspberry Pi cu `hostname -I`
2. Mosquitto nu rulează pe RPi — verifică cu `sudo systemctl status mosquitto`
3. User/parolă greșite — verifică mosquitto password file
4. Port firewall blocat — `sudo ufw allow 8883` pe RPi
```

### DHT22 returnează None constant

```python
# Verifică în REPL:
import machine, dht
pin = machine.Pin(4, machine.Pin.IN, machine.Pin.PULL_UP)
d = dht.DHT22(pin)
d.measure()
print(d.temperature())
# Dacă aruncă OSError: verifică rezistorul pull-up 4.7kΩ și firul DATA
```

### BH1750 nu e găsit pe I2C

```python
# Scan I2C în REPL:
import machine
i2c = machine.I2C(0, sda=machine.Pin(8), scl=machine.Pin(9), freq=400000)
print(i2c.scan())  # ar trebui să returneze [35] (0x23) sau [92] (0x5C)
# Dacă lista e goală — verifică SDA/SCL și alimentarea 3.3V
```

### MQ2 dă mereu alertă (false positive)

```
1. Nu s-a preîncălzit suficient — așteaptă 60-120 secunde după pornire
2. Threshold prea mic — mărește GAS_ALERT_THRESHOLD în config.py (încearcă 500-600)
3. Lipsă divizor de tensiune — verifică că AO trece prin 10kΩ/10kΩ
```

---

## 11. Verificare înainte să treci la Layer 3

- [ ] MicroPython instalat și accesibil prin REPL
- [ ] `boot.py` conectează la WiFi automat la pornire
- [ ] `main.py` pornește fără erori și afișează log-uri în consolă
- [ ] Date senzori apar în log la fiecare 30 secunde
- [ ] MQTT se conectează la broker (chiar și fără TLS temporar)
- [ ] Comenzile primite prin MQTT controlează relay-ul și buzzerul
- [ ] Alerta de gaz pornește buzzerul și oprește relay-urile local, fără gateway
- [ ] Node B are `config.py` actualizat cu `NODE_ID` și `MQTT_USER` diferite
- [ ] Ambele noduri publică simultan fără conflicte

---

*Următorul document: `03_layer3_gateway.md` — configurarea completă Raspberry Pi: Mosquitto cu TLS, TimescaleDB, PostgreSQL, Python ML Engine, NestJS API.*
