# config.example.py — copiază în config.py și completează

WIFI_SSID     = "SSID_RETEA"
WIFI_PASSWORD = "PAROLA_WIFI"
WIFI_TIMEOUT  = 15

NODE_ID       = "esp32_node_a"          # schimbă în esp32_node_b pentru Node B
NODE_LOCATION = "living"                # sau "dormitor" pentru Node B

MQTT_BROKER   = "192.168.1.100"        # IP static Raspberry Pi
MQTT_PORT     = 8883
MQTT_USER     = "esp32_node_a"
MQTT_PASSWORD = "PAROLA_MQTT"

TOPIC_SENSORS  = f"home/{NODE_ID}/sensors"
TOPIC_COMMANDS = f"home/{NODE_ID}/commands"
TOPIC_ALERTS   = "home/alerts"
TOPIC_STATUS   = f"home/{NODE_ID}/status"

TLS_CA_CERT     = "/certs/ca.crt"
TLS_CLIENT_CERT = "/certs/client.crt"
TLS_CLIENT_KEY  = "/certs/client.key"

PIN_DHT22         = 4
PIN_MQ2_DIGITAL   = 5
PIN_MQ2_ANALOG    = 0
PIN_PIR           = 6
PIN_BH1750_SDA    = 8
PIN_BH1750_SCL    = 9

PIN_RELAY_1       = 7
PIN_RELAY_2       = 10
PIN_RELAY_3       = 3
PIN_RELAY_4       = 2
PIN_BUZZER        = 1

READ_INTERVAL_S      = 30
GAS_ALERT_THRESHOLD  = 400
MQTT_KEEPALIVE       = 60
MQTT_QOS_SENSORS     = 1
MQTT_QOS_ALERTS      = 2
