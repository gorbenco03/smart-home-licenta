import dht
import machine
import time


class DHT22Sensor:
    def __init__(self, pin_number: int):
        self.pin = machine.Pin(pin_number, machine.Pin.IN, machine.Pin.PULL_UP)
        self.sensor = dht.DHT22(self.pin)
        self._last_read = 0
        self._last_temp = None
        self._last_hum = None

    def read(self) -> dict:
        now = time.ticks_ms()

        if time.ticks_diff(now, self._last_read) < 2100:
            return {
                "temperature": self._last_temp,
                "humidity": self._last_hum,
                "valid": self._last_temp is not None
            }

        try:
            self.sensor.measure()
            self._last_temp = self.sensor.temperature()
            self._last_hum = self.sensor.humidity()
            self._last_read = now

            return {
                "temperature": round(self._last_temp, 1),
                "humidity": round(self._last_hum, 1),
                "valid": True
            }

        except OSError as e:
            print(f"[DHT22] Eroare citire: {e}")
            return {
                "temperature": self._last_temp,
                "humidity": self._last_hum,
                "valid": False,
                "error": str(e)
            }
