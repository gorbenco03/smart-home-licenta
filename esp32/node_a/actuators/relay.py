import machine
import time


class RelayModule:
    def __init__(self, pins: list, active_low: bool = True):
        self.active_low = active_low
        self.relays = []
        self._state = {}

        for i, pin_num in enumerate(pins):
            pin = machine.Pin(pin_num, machine.Pin.OUT)
            pin.value(0 if not active_low else 1)
            self.relays.append(pin)
            self._state[i] = False

        print(f"[Relay] {len(pins)} relee initializate (active_low={active_low})")

    def on(self, relay_index: int):
        if relay_index >= len(self.relays):
            print(f"[Relay] Index invalid: {relay_index}")
            return
        self.relays[relay_index].value(0 if self.active_low else 1)
        self._state[relay_index] = True
        print(f"[Relay] Releu {relay_index + 1} PORNIT")

    def off(self, relay_index: int):
        if relay_index >= len(self.relays):
            return
        self.relays[relay_index].value(1 if self.active_low else 0)
        self._state[relay_index] = False
        print(f"[Relay] Releu {relay_index + 1} OPRIT")

    def toggle(self, relay_index: int):
        if self._state.get(relay_index):
            self.off(relay_index)
        else:
            self.on(relay_index)

    def pulse(self, relay_index: int, duration_ms: int = 500):
        self.on(relay_index)
        time.sleep_ms(duration_ms)
        self.off(relay_index)

    def all_off(self):
        for i in range(len(self.relays)):
            self.off(i)
        print("[Relay] Toate releele OPRITE")

    def status(self) -> dict:
        return {f"relay_{i+1}": state for i, state in self._state.items()}
