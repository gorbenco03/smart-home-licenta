import machine
import time


class MQ2Sensor:
    DEFAULT_ALERT_THRESHOLD = 400
    WARMUP_TIME = 60

    def __init__(self, digital_pin: int, analog_pin: int, alert_threshold: int = None):
        self.do_pin = machine.Pin(digital_pin, machine.Pin.IN)
        self.adc = machine.ADC(machine.Pin(analog_pin))
        self.adc.atten(machine.ADC.ATTN_11DB)
        self.adc.width(machine.ADC.WIDTH_12BIT)
        self.alert_threshold = alert_threshold or self.DEFAULT_ALERT_THRESHOLD
        self._warmed_up = False
        self._start_time = time.time()

    def is_warmed_up(self) -> bool:
        if self._warmed_up:
            return True
        if time.time() - self._start_time >= self.WARMUP_TIME:
            self._warmed_up = True
            print("[MQ2] Senzor preincalzit, citiri valide acum.")
        return self._warmed_up

    def read(self) -> dict:
        raw_adc = self.adc.read()
        digital_alert = self.do_pin.value() == 1
        alert = raw_adc > self.alert_threshold or digital_alert

        return {
            "gas_level": raw_adc,
            "gas_alert": alert,
            "digital_alert": digital_alert,
            "warmed_up": self.is_warmed_up(),
            "valid": self.is_warmed_up()
        }

    def calibrate_baseline(self, samples: int = 50) -> int:
        print(f"[MQ2] Calibrare baseline ({samples} citiri)...")
        total = 0
        for i in range(samples):
            total += self.adc.read()
            time.sleep_ms(100)
        baseline = total // samples
        print(f"[MQ2] Baseline: {baseline} — salvează în config.py")
        return baseline
