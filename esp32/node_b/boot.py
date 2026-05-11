import network
import time
import machine
import config


def connect_wifi() -> bool:
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
    import ntptime
    try:
        ntptime.settime()
        print("[NTP] Timp sincronizat")
    except Exception as e:
        print(f"[NTP] Eroare sincronizare timp: {e}")
        print("[NTP] TLS poate eșua fără timp corect!")


connected = connect_wifi()

if connected:
    sync_time()
else:
    print("[Boot] WiFi indisponibil — restart în 30s")
    time.sleep(30)
    machine.reset()
