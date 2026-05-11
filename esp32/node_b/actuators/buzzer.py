import machine
import time


class Buzzer:
    def __init__(self, pin_number: int):
        self.pin = machine.Pin(pin_number, machine.Pin.OUT, value=0)

    def on(self):
        self.pin.value(1)

    def off(self):
        self.pin.value(0)

    def beep(self, count: int = 1, on_ms: int = 200, off_ms: int = 200):
        for _ in range(count):
            self.on()
            time.sleep_ms(on_ms)
            self.off()
            time.sleep_ms(off_ms)

    def alert_gas(self):
        self.beep(count=10, on_ms=100, off_ms=100)

    def alert_motion(self):
        self.beep(count=2, on_ms=500, off_ms=300)

    def confirm(self):
        self.beep(count=1, on_ms=100, off_ms=0)
