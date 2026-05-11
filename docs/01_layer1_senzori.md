# Layer 1 — Senzori & Actuatori

> **Document:** 01 din 05
> **Prerequisite:** Ai ESP32-C3 DevKit, componentele listate, fire jumper, breadboard
> **Timp estimat setup:** 3-4 ore prima dată

---

## 1. Lista completă componente

| Componentă | Model exact | Cantitate | Preț estimat |
|------------|-------------|-----------|--------------|
| Microcontroller | ESP32-C3 DevKit (38 pini) | 2 | ~15 EUR/buc |
| Senzor temp/umid | DHT22 (AM2302) | 2 | ~4 EUR/buc |
| Senzor gaz/fum | MQ2 | 1-2 | ~3 EUR/buc |
| Senzor mișcare | HC-SR501 PIR | 2 | ~2 EUR/buc |
| Senzor lumină | BH1750 (modul cu I2C) | 1-2 | ~2 EUR/buc |
| Modul relay | 4-channel 5V relay module | 1 | ~5 EUR |
| Buzzer | Buzzer activ 5V | 1 | ~1 EUR |
| Rezistori | 4.7kΩ, 10kΩ (set) | câțiva | ~1 EUR |
| Sursă alimentare | 5V 3A adaptor + terminal | 1 | ~8 EUR |
| Breadboard | 830 puncte | 2 | ~3 EUR/buc |
| Fire jumper | Set M-M, M-F, F-F | 1 set | ~5 EUR |
| Cablu micro-USB | pentru programare ESP32 | 1 | ai deja |

**Total estimat Layer 1:** ~80-100 EUR pentru ambele noduri complete

---

## 2. Pinout ESP32-C3 DevKit — referință rapidă

```
ESP32-C3 DevKit (vedere de sus)

    3V3  [ 1] [2 ] GND
    3V3  [ 3] [4 ] GND
    RST  [ 5] [6 ] IO0   ← Boot button
    IO4  [ 7] [8 ] IO1
    IO5  [ 9] [10] IO2
    IO6  [11] [12] IO3
    IO7  [13] [14] IO10
    IO8  [15] [16] IO19  ← USB D-
    IO9  [17] [18] IO18  ← USB D+
    GND  [19] [20] IO20  ← TX
    5V   [21] [22] IO21  ← RX

Pini I2C:  SDA = IO8,  SCL = IO9  (default, configurabil)
Pini UART: TX  = IO20, RX  = IO21
ADC:       IO0-IO5 (ADC1), evită IO0 la boot
```

> **Atenție:** ESP32-C3 are doar ADC1 (6 canale). ADC2 nu există pe C3.
> **Atenție:** GPIO18/19 sunt folosiți pentru USB — nu îi folosi pentru senzori dacă programezi prin USB.

---

## 3. Senzor DHT22 — Temperatură & Umiditate

### 3.1 Specificații

- Temperatură: -40°C până la +80°C, precizie ±0.5°C
- Umiditate: 0-100% RH, precizie ±2-5%
- Protocol: one-wire proprietar (nu I2C, nu SPI)
- Tensiune alimentare: 3.3V sau 5V
- Interval minim între citiri: **2 secunde**

### 3.2 Schema de conectare

```
DHT22 (4 pini, stânga spre dreapta când privești față)

  PIN 1 (VCC)  ──────────────── 3V3 (ESP32)
  PIN 2 (DATA) ──┬───────────── IO4 (ESP32)
                 │
               [4.7kΩ]          ← rezistor pull-up OBLIGATORIU
                 │
  PIN 1 (VCC)  ──┘  (pull-up la VCC)
  PIN 3        ──── nu se conectează (NC)
  PIN 4 (GND)  ──────────────── GND (ESP32)
```

> **De ce pull-up?** Protocolul one-wire al DHT22 necesită linia DATA menținută HIGH în repaus. Fără rezistor pull-up vei primi erori de citire aleatorii.

### 3.3 Cod MicroPython — DHT22

```python
# sensors/dht22.py

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
        """
        Citește temperatura și umiditatea.
        Returnează ultimele valori valide dacă intervalul de 2s nu a trecut.
        """
        now = time.ticks_ms()
        
        # DHT22 necesită minim 2 secunde între citiri
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
                "temperature": self._last_temp,  # returnează ultima valoare validă
                "humidity": self._last_hum,
                "valid": False,
                "error": str(e)
            }


# Test rapid — rulează direct pe ESP32
if __name__ == "__main__":
    sensor = DHT22Sensor(pin_number=4)  # IO4
    
    while True:
        data = sensor.read()
        if data["valid"]:
            print(f"Temp: {data['temperature']}°C | Umid: {data['humidity']}%")
        else:
            print("Citire esuata, incerc din nou...")
        time.sleep(3)
```

---

## 4. Senzor MQ2 — Gaz & Fum

### 4.1 Specificații

- Detectează: LPG, butan, propan, metan, alcool, hidrogen, fum
- Ieșiri: **DO** (digital, HIGH/LOW față de prag) și **AO** (analogic, 0-5V)
- Tensiune alimentare: **5V** (modulul are regulator intern)
- Timp de preîncălzire: **20-30 minute** la prima pornire, ~1 minut ulterior
- Sensibilitate reglabilă prin potențiometrul de pe modul

### 4.2 Schema de conectare

```
MQ2 Modul (4 pini)

  VCC  ──────────────── 5V  (ESP32 pin 5V sau sursă externă)
  GND  ──────────────── GND
  DO   ──────────────── IO5 (ESP32) ← alertă digitală (HIGH = gaz detectat)
  AO   ──┬─────────────── IO0 (ESP32 ADC) ← nivel analogic
         │
       [10kΩ]             ← divizor de tensiune OBLIGATORIU
         │                   AO dă 0-5V, ESP32 ADC suportă max 3.3V!
        GND
```

> **ATENȚIE CRITICĂ:** Ieșirea AO a MQ2 merge până la 5V. ESP32 are ADC pe 3.3V. Fără divizor de tensiune **arzi pinul ADC**. Folosește divizor 10kΩ / 10kΩ pentru a înjumătăți tensiunea (5V → 2.5V).

**Divizor de tensiune:**
```
AO (MQ2) ──── [10kΩ] ──┬──── IO0 (ESP32 ADC)
                        │
                      [10kΩ]
                        │
                       GND
```

### 4.3 Calibrare MQ2

MQ2 nu dă direct PPM. Dă o valoare ADC brută (0-4095 pe 12 biți). Trebuie calibrat în aer curat:

```python
# La prima pornire, în aer curat, citește ~100-300 (depinde de exemplar)
# Aceasta e valoarea de "baseline" (R0)
# Gaz detectat = valoare semnificativ mai mare decât baseline
# De obicei: valoare > 400-500 = alertă
```

### 4.4 Cod MicroPython — MQ2

```python
# sensors/mq2.py

import machine
import time

class MQ2Sensor:
    # Prag alertă — ajustează după calibrare în aer curat
    DEFAULT_ALERT_THRESHOLD = 400
    # Timp preîncălzire în secunde
    WARMUP_TIME = 60

    def __init__(self, digital_pin: int, analog_pin: int, alert_threshold: int = None):
        self.do_pin = machine.Pin(digital_pin, machine.Pin.IN)
        self.adc = machine.ADC(machine.Pin(analog_pin))
        self.adc.atten(machine.ADC.ATTN_11DB)   # range 0-3.3V
        self.adc.width(machine.ADC.WIDTH_12BIT)  # 0-4095
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
        """
        Citește nivelul de gaz.
        digital_alert: True dacă potențiometrul modulului a detectat depășire prag
        analog_level:  valoare brută ADC 0-4095 (mai precisă)
        alert:         True dacă nivelul analogic depășește threshold-ul nostru
        """
        raw_adc = self.adc.read()
        digital_alert = self.do_pin.value() == 1  # HIGH = gaz detectat pe DO

        # Pe unele module DO e activ LOW — testează și inversează dacă e cazul
        alert = raw_adc > self.alert_threshold or digital_alert

        return {
            "gas_level": raw_adc,
            "gas_alert": alert,
            "digital_alert": digital_alert,
            "warmed_up": self.is_warmed_up(),
            "valid": self.is_warmed_up()
        }

    def calibrate_baseline(self, samples: int = 50) -> int:
        """
        Apelează în aer curat pentru a determina valoarea de baseline.
        Folosește media a N citiri.
        """
        print(f"[MQ2] Calibrare baseline ({samples} citiri)...")
        total = 0
        for i in range(samples):
            total += self.adc.read()
            time.sleep_ms(100)
        baseline = total // samples
        print(f"[MQ2] Baseline: {baseline} — salvează în config.py")
        return baseline


# Test rapid
if __name__ == "__main__":
    sensor = MQ2Sensor(digital_pin=5, analog_pin=0)
    
    print("Asteptam preincalzire MQ2 (60s)...")
    while not sensor.is_warmed_up():
        time.sleep(5)
        print(".", end="")
    
    while True:
        data = sensor.read()
        status = "⚠️  ALERTA GAZ!" if data["gas_alert"] else "OK"
        print(f"Nivel gaz: {data['gas_level']} | {status}")
        time.sleep(2)
```

---

## 5. Senzor HC-SR501 PIR — Mișcare

### 5.1 Specificații

- Detectează: radiație infraroșie de la corpul uman (temperatura ~37°C)
- Rază detecție: până la 7 metri, unghi ~120°
- Ieșire: GPIO digital — HIGH când detectează, LOW altfel
- Tensiune alimentare: **5V** (are regulator intern, ieșirea e totuși 3.3V safe)
- Potențiometre: sensibilitate (S) și timp de menținere semnal HIGH (T)
- Moduri jumper: H (retriggerable) sau L (single trigger)

### 5.2 Schema de conectare

```
HC-SR501 (3 pini, de la stânga la dreapta)

  VCC  ──────────────── 5V  (ESP32 sau sursă externă)
  OUT  ──────────────── IO6 (ESP32) ← semnal digital 3.3V safe
  GND  ──────────────── GND
```

> **Simplu!** PIR nu necesită rezistori sau divizori. Ieșirea OUT e direct compatibilă cu ESP32.

### 5.3 Reglare potențiometre PIR

```
Privind modulul cu lentila spre tine:

  Potențiometru STÂNGA (Sx):  sensibilitate
    → rotire dreapta = mai sensibil (distanță mai mare)
    → pentru interior: poziție medie

  Potențiometru DREAPTA (Tx): timp menținere semnal HIGH
    → rotire dreapta = timp mai lung (3s până ~5 minute)
    → pentru sistem smart home: ~5-10 secunde (pozitie spre stanga)

  Jumper:
    → H (retriggerable):  dacă tot detectează mișcare, menține HIGH
    → L (single trigger): HIGH pentru timpul setat, apoi LOW indiferent
    → Recomand: H (retriggerable) pentru smart home
```

### 5.4 Cod MicroPython — PIR

```python
# sensors/pir.py

import machine
import time

class PIRSensor:
    def __init__(self, pin_number: int, callback=None):
        self.pin = machine.Pin(pin_number, machine.Pin.IN)
        self._motion_detected = False
        self._last_trigger = 0
        self._motion_count = 0  # nr detecții în sesiunea curentă

        # Opțional: interrupt pentru reacție imediată (nu polling)
        if callback:
            self.pin.irq(trigger=machine.Pin.IRQ_RISING, handler=callback)

    def read(self) -> dict:
        current = self.pin.value() == 1

        if current and not self._motion_detected:
            # Rising edge — nouă detecție
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


# Exemplu cu interrupt pentru alertă imediată (fără polling)
def on_motion_detected(pin):
    print("[PIR] MISCARE DETECTATA!")
    # Aici poți porni buzzer local imediat, fără să aștepți loop-ul principal


# Test rapid
if __name__ == "__main__":
    pir = PIRSensor(pin_number=6)
    print("PIR activ. Misca-te in fata senzorului...")

    while True:
        data = pir.read()
        if data["motion"]:
            print(f"MISCARE! Total detectii: {data['motion_count_session']}")
        time.sleep_ms(200)
```

---

## 6. Senzor BH1750 — Lumină Ambientală

### 6.1 Specificații

- Măsoară: lux (lumina ambientală)
- Protocol: **I2C** (SDA + SCL)
- Range: 1 - 65535 lux
- Adresă I2C: 0x23 (ADDR pin la GND) sau 0x5C (ADDR pin la VCC)
- Tensiune: 3.3V sau 5V (modulul are regulator)
- Precizie: ±20%

### 6.2 Schema de conectare

```
BH1750 Modul (5 pini)

  VCC   ──────────────── 3V3 (ESP32)
  GND   ──────────────── GND
  SCL   ──────────────── IO9 (ESP32 I2C SCL)
  SDA   ──────────────── IO8 (ESP32 I2C SDA)
  ADDR  ──────────────── GND (adresă 0x23)
                         sau VCC (adresă 0x5C, dacă ai 2 senzori pe același bus)
```

> **I2C pull-up:** Modulele BH1750 au deja rezistori pull-up pe SDA/SCL. Nu mai adaugi altii.

### 6.3 Cod MicroPython — BH1750

```python
# sensors/bh1750.py

import machine
import time

class BH1750Sensor:
    # Moduri de măsurare
    CONTINUOUS_HIGH_RES  = 0x10  # 1 lux rezoluție, ~120ms
    CONTINUOUS_HIGH_RES2 = 0x11  # 0.5 lux rezoluție, ~120ms
    CONTINUOUS_LOW_RES   = 0x13  # 4 lux rezoluție, ~16ms
    ONE_TIME_HIGH_RES    = 0x20  # o singură măsurare, intră în sleep după

    ADDR_LOW  = 0x23  # ADDR pin la GND
    ADDR_HIGH = 0x5C  # ADDR pin la VCC

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
            # Power on
            self.i2c.writeto(self.addr, bytes([0x01]))
            time.sleep_ms(10)
            # Setează mod continuous high resolution
            self.i2c.writeto(self.addr, bytes([self.CONTINUOUS_HIGH_RES]))
            time.sleep_ms(180)  # așteaptă prima măsurare
            print(f"[BH1750] Inițializat la adresa 0x{self.addr:02X}")
        except OSError as e:
            print(f"[BH1750] Eroare inițializare: {e}")
            print("[BH1750] Verifică conexiunile SDA/SCL și adresa!")

    def read(self) -> dict:
        try:
            data = self.i2c.readfrom(self.addr, 2)
            # Conversie: (byte_high << 8 | byte_low) / 1.2
            raw = (data[0] << 8) | data[1]
            lux = round(raw / 1.2, 1)

            return {
                "light_lux": lux,
                "valid": True
            }
        except OSError as e:
            print(f"[BH1750] Eroare citire: {e}")
            return {
                "light_lux": None,
                "valid": False,
                "error": str(e)
            }

    def scan_i2c(self):
        """Utilitar debug — listează toate dispozitivele I2C găsite"""
        devices = self.i2c.scan()
        print(f"[I2C] Dispozitive găsite: {[hex(d) for d in devices]}")
        return devices


# Test rapid
if __name__ == "__main__":
    sensor = BH1750Sensor(sda_pin=8, scl_pin=9)
    sensor.scan_i2c()

    while True:
        data = sensor.read()
        if data["valid"]:
            lux = data["light_lux"]
            if lux < 10:
                desc = "întuneric"
            elif lux < 100:
                desc = "lumină slabă"
            elif lux < 500:
                desc = "interior normal"
            else:
                desc = "luminos / exterior"
            print(f"Lumina: {lux} lux ({desc})")
        time.sleep(2)
```

---

## 7. Modul Relay 4-Channel — Actuator

### 7.1 Specificații

- 4 relee independente, fiecare suportă: 10A/250VAC sau 10A/30VDC
- Bobine activate la 5V, semnal de control **3.3V compatibil** (LOW activ sau HIGH activ)
- LED indicator pentru fiecare releu
- Izolare optică între semnal de control și circuit comutat

### 7.2 Schema de conectare

```
Modul Relay 4-channel

  VCC  ──────────────── 5V (SURSĂ EXTERNĂ — nu de la ESP32!)
  GND  ──────────────── GND comun cu ESP32 și sursa externă
  IN1  ──────────────── IO7  (ESP32) ← releu 1
  IN2  ──────────────── IO10 (ESP32) ← releu 2
  IN3  ──────────────── IO3  (ESP32) ← releu 3
  IN4  ──────────────── IO2  (ESP32) ← releu 4

  ⚠️  GND-ul sursei externe și GND-ul ESP32 trebuie conectate împreună!
      Altfel semnalele IN nu funcționează corect.
```

> **OBLIGATORIU sursă externă:** Un releu consumă ~70-80mA când e activat. 4 relee simultan = ~320mA. Pinii ESP32 pot da max 40mA total pe toate GPIO. Alimentează modulul relay dintr-un adaptor 5V/2A separat.

### 7.3 LOW activ vs HIGH activ

Majoritatea modulelor relay ieftine sunt **LOW activ**:
- `LOW (0V)` pe IN = releu **PORNIT**
- `HIGH (3.3V)` pe IN = releu **OPRIT**

Verifică pe modulul tău — dacă LED-ul e aprins când nu ai nimic conectat la IN, e LOW activ.

### 7.4 Cod MicroPython — Relay

```python
# actuators/relay.py

import machine
import time

class RelayModule:
    """
    Controlează un modul relay multi-channel.
    active_low=True pentru module cu logică inversată (LOW activ).
    """

    def __init__(self, pins: list, active_low: bool = True):
        self.active_low = active_low
        self.relays = []
        self._state = {}

        for i, pin_num in enumerate(pins):
            pin = machine.Pin(pin_num, machine.Pin.OUT)
            # La inițializare: toate releele OPRITE
            pin.value(0 if not active_low else 1)
            self.relays.append(pin)
            self._state[i] = False

        print(f"[Relay] {len(pins)} relee initializate (active_low={active_low})")

    def on(self, relay_index: int):
        """Pornește releul (indexat de la 0)"""
        if relay_index >= len(self.relays):
            print(f"[Relay] Index invalid: {relay_index}")
            return
        self.relays[relay_index].value(0 if self.active_low else 1)
        self._state[relay_index] = True
        print(f"[Relay] Releu {relay_index + 1} PORNIT")

    def off(self, relay_index: int):
        """Oprește releul"""
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
        """Pornește releul pentru un timp scurt, apoi îl oprește"""
        self.on(relay_index)
        time.sleep_ms(duration_ms)
        self.off(relay_index)

    def all_off(self):
        """Oprește toate releele — util la alertă gaz"""
        for i in range(len(self.relays)):
            self.off(i)
        print("[Relay] Toate releele OPRITE")

    def status(self) -> dict:
        return {f"relay_{i+1}": state for i, state in self._state.items()}


# Test rapid
if __name__ == "__main__":
    relay = RelayModule(pins=[7, 10, 3, 2], active_low=True)

    print("Test: pornesc releu 1...")
    relay.on(0)
    time.sleep(2)
    relay.off(0)

    print("Test: pulse releu 2 (500ms)...")
    relay.pulse(1, 500)

    print(f"Status: {relay.status()}")
```

---

## 8. Buzzer Activ — Alertă Sonoră

### 8.1 Conectare

```
Buzzer activ 5V (2 fire: + și -)

  + (roșu)  ──── IO1 (ESP32) via tranzistor NPN
  - (negru) ──── GND

  Circuit complet cu tranzistor (OBLIGATORIU — curentul buzzerului >40mA):

  IO1 (ESP32) ──[1kΩ]──► Baza NPN (2N2222 sau BC547)
                          Colectorul NPN ──► Buzzer (+)
                          Emitorul NPN  ──► GND
                          Buzzer (-)    ──► 5V (sursă externă)
```

> **De ce tranzistor?** Buzzerul activ de 5V consumă 30-50mA. Prea mult pentru GPIO. Tranzistorul acționează ca switch controlat de ESP32.

### 8.2 Cod MicroPython — Buzzer

```python
# actuators/buzzer.py

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
        """Beep-uri scurte"""
        for _ in range(count):
            self.on()
            time.sleep_ms(on_ms)
            self.off()
            time.sleep_ms(off_ms)

    def alert_gas(self):
        """Pattern specific alertă gaz — 10 beep-uri rapide"""
        self.beep(count=10, on_ms=100, off_ms=100)

    def alert_motion(self):
        """Pattern mișcare nocturnă — 2 beep-uri lungi"""
        self.beep(count=2, on_ms=500, off_ms=300)

    def confirm(self):
        """Confirmare comandă primită — 1 beep scurt"""
        self.beep(count=1, on_ms=100, off_ms=0)
```

---

## 9. Tabel final conexiuni — Node A (living/bucătărie)

| Componentă | Pin componentă | Pin ESP32-C3 | Note |
|------------|----------------|--------------|-------|
| DHT22 | VCC | 3V3 | |
| DHT22 | DATA | IO4 | + rezistor 4.7kΩ pull-up la 3V3 |
| DHT22 | GND | GND | |
| MQ2 | VCC | 5V extern | NU de la ESP32 |
| MQ2 | GND | GND comun | |
| MQ2 | DO | IO5 | alertă digitală |
| MQ2 | AO | IO0 | prin divizor 10kΩ/10kΩ |
| PIR HC-SR501 | VCC | 5V extern | |
| PIR HC-SR501 | OUT | IO6 | direct, 3.3V safe |
| PIR HC-SR501 | GND | GND comun | |
| BH1750 | VCC | 3V3 | |
| BH1750 | GND | GND | |
| BH1750 | SDA | IO8 | I2C |
| BH1750 | SCL | IO9 | I2C |
| BH1750 | ADDR | GND | adresă 0x23 |
| Relay IN1 | IN | IO7 | releu lumină |
| Relay IN2 | IN | IO10 | releu ventilator |
| Relay VCC | VCC | 5V extern | sursă separată |
| Relay GND | GND | GND comun | |
| Buzzer | + | IO1 via NPN | |
| Buzzer | - | GND | |

---

## 10. Verificare înainte să treci la Layer 2

Bifează înainte să continui:

- [ ] DHT22 returnează temperatura și umiditatea fără erori repetate
- [ ] MQ2 s-a preîncălzit 60 secunde și dă valori stabile în aer curat (~150-300)
- [ ] PIR detectează mișcarea și returnează LOW când nu e nimeni
- [ ] BH1750 găsit pe I2C scan la adresa 0x23
- [ ] Relay comută fizic (auzi click-ul și LED-ul de pe modul se aprinde)
- [ ] Buzzer scoate sunet la `buzzer.beep()`
- [ ] Niciun senzor nu e alimentat direct din GPIO (VCC senzori = 3V3 sau sursă externă)
- [ ] GND comun între ESP32, relay module și sursa externă

---

*Următorul document: `02_layer2_esp32.md` — configurarea completă ESP32: Wi-Fi, MQTT over TLS, citire periodică senzori, publicare date, primire comenzi.*
