import time
import config

from sensors.dht22   import DHT22Sensor
from sensors.mq2     import MQ2Sensor
from sensors.pir     import PIRSensor
from sensors.bh1750  import BH1750Sensor
from actuators.relay import RelayModule
from actuators.buzzer import Buzzer
from mqtt_client     import MQTTManager

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


def handle_command(payload: dict):
    action = payload.get("action", "")

    if action == "relay_on":
        relay.on(payload.get("relay", 0))
        buzzer.confirm()
    elif action == "relay_off":
        relay.off(payload.get("relay", 0))
    elif action == "relay_toggle":
        relay.toggle(payload.get("relay", 0))
    elif action == "buzzer_beep":
        buzzer.beep(count=payload.get("count", 1))
    elif action == "all_off":
        relay.all_off()
        buzzer.off()
        print("[CMD] Emergency all_off executat")
    else:
        print(f"[CMD] Comandă necunoscută: {action}")


mqtt = MQTTManager(on_command_callback=handle_command)

print("[Boot] Conectare MQTT...")
if not mqtt.connect():
    print("[Boot] MQTT indisponibil la start — voi reîncerca în loop")

buzzer.confirm()
print("[Boot] Sistem activ\n")

last_read_time   = 0
last_reconnect   = 0
gas_alert_active = False

while True:
    now = time.time()

    if now - last_reconnect >= 30:
        mqtt.reconnect_if_needed()
        last_reconnect = now

    mqtt.check_messages()

    if now - last_read_time >= config.READ_INTERVAL_S:
        last_read_time = now

        dht_data    = dht22.read()
        mq2_data    = mq2.read()
        pir_data    = pir.read()
        bh1750_data = bh1750.read()

        if mq2_data.get("gas_alert") and mq2_data.get("warmed_up"):
            if not gas_alert_active:
                gas_alert_active = True
                print("[ALERT] GAZ DETECTAT — reacție locală imediată!")
                relay.all_off()
                buzzer.alert_gas()
                mqtt.publish_alert("GAS_DETECTED", {
                    "gas_level": mq2_data["gas_level"],
                    "location": config.NODE_LOCATION
                })
        else:
            if gas_alert_active:
                print("[ALERT] Gaz dispărut — resetez alerta")
                gas_alert_active = False

        current_hour = time.localtime()[3]
        if pir_data.get("motion") and (current_hour >= 23 or current_hour < 6):
            mqtt.publish_alert("MOTION_NIGHT", {
                "location": config.NODE_LOCATION,
                "hour": current_hour
            })
            buzzer.alert_motion()

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

        success = mqtt.publish_sensors(sensor_payload)

        temp = sensor_payload.get("temperature", "N/A")
        hum  = sensor_payload.get("humidity", "N/A")
        gas  = sensor_payload.get("gas_level", "N/A")
        lux  = sensor_payload.get("light_lux", "N/A")
        mot  = "DA" if sensor_payload.get("motion") else "nu"
        pub  = "OK" if success else "EROARE"

        print(f"[{now}] T:{temp}°C H:{hum}% G:{gas} L:{lux}lx M:{mot} → MQTT:{pub}")

    time.sleep_ms(200)
