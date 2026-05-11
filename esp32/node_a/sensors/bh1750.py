import machine
import time


class BH1750Sensor:
    CONTINUOUS_HIGH_RES  = 0x10
    CONTINUOUS_HIGH_RES2 = 0x11
    CONTINUOUS_LOW_RES   = 0x13
    ONE_TIME_HIGH_RES    = 0x20

    ADDR_LOW  = 0x23
    ADDR_HIGH = 0x5C

    def __init__(self, sda_pin: int = 8, scl_pin: int = 9, addr: int = None):
        self.i2c = machine.I2C(
            0,
            sda=machine.Pin(sda_pin),
            scl=machine.Pin(scl_pin),
            freq=400000
        )
        self.addr = addr or self.ADDR_LOW
        self._init_sensor()

    def _init_sensor(self):
        try:
            self.i2c.writeto(self.addr, bytes([0x01]))
            time.sleep_ms(10)
            self.i2c.writeto(self.addr, bytes([self.CONTINUOUS_HIGH_RES]))
            time.sleep_ms(180)
            print(f"[BH1750] Inițializat la adresa 0x{self.addr:02X}")
        except OSError as e:
            print(f"[BH1750] Eroare inițializare: {e}")
            print("[BH1750] Verifică conexiunile SDA/SCL și adresa!")

    def read(self) -> dict:
        try:
            data = self.i2c.readfrom(self.addr, 2)
            raw = (data[0] << 8) | data[1]
            lux = round(raw / 1.2, 1)
            return {"light_lux": lux, "valid": True}
        except OSError as e:
            print(f"[BH1750] Eroare citire: {e}")
            return {"light_lux": None, "valid": False, "error": str(e)}

    def scan_i2c(self):
        devices = self.i2c.scan()
        print(f"[I2C] Dispozitive găsite: {[hex(d) for d in devices]}")
        return devices
