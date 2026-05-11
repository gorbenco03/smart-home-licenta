import machine
import time


class PIRSensor:
    def __init__(self, pin_number: int, callback=None):
        self.pin = machine.Pin(pin_number, machine.Pin.IN)
        self._motion_detected = False
        self._last_trigger = 0
        self._motion_count = 0

        if callback:
            self.pin.irq(trigger=machine.Pin.IRQ_RISING, handler=callback)

    def read(self) -> dict:
        current = self.pin.value() == 1

        if current and not self._motion_detected:
            self._last_trigger = time.time()
            self._motion_count += 1

        self._motion_detected = current

        return {
            "motion": current,
            "last_trigger": self._last_trigger,
            "motion_count_session": self._motion_count
        }

    def reset_count(self):
        self._motion_count = 0
