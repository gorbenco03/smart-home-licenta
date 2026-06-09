# Ghid Conexiuni Breadboard — Smart Home ESP32

> **Versiune breadboard** — pentru prototip și testare. Conexiunile sunt identice cu cele din schema finală, doar că se folosesc fire dupont și breadboard în loc de PCB.

---

## Cuprins

**PARTEA I — HARDWARE & CONEXIUNI**
1. [Lista componentelor](#1-lista-componentelor)
2. [Alimentarea sistemului](#2-alimentarea-sistemului)
3. [Nodul A — ESP32 WROOM-32 (Living)](#3-nodul-a--esp32-wroom-32-living)
   - 3.1 [DHT22 — temperatură și umiditate](#31-dht22--temperatură-și-umiditate)
   - 3.2 [MQ-2 — senzor gaz/fum](#32-mq-2--senzor-gazfum)
   - 3.3 [PIR HC-SR501 — detecție mișcare](#33-pir-hc-sr501--detecție-mișcare)
   - 3.4 [BH1750 — senzor lumină (I²C)](#34-bh1750--senzor-lumină-i2c)
   - 3.5 [Modul releu 4 canale](#35-modul-releu-4-canale)
   - 3.6 [Buzzer activ](#36-buzzer-activ)
   - 3.7 [Servomotor SG90 — control perdele](#37-servomotor-sg90--control-perdele)
4. [Nodul B — ESP32 WROOM-32 (Dormitor)](#4-nodul-b--esp32-wroom-32-dormitor)
5. [ESP32-CAM AI-Thinker — Nodul cameră (Hol)](#5-esp32-cam-ai-thinker--nodul-cameră-hol)
   - 5.1 [Programare firmware (mod flash)](#51-programare-firmware-mod-flash)
   - 5.2 [Funcționare normală](#52-funcționare-normală)
6. [Schema de alimentare completă](#6-schema-de-alimentare-completă)
7. [Tabel complet conexiuni — Nodul A](#7-tabel-complet-conexiuni--nodul-a)
8. [Note practice și troubleshooting](#8-note-practice-și-troubleshooting)

**PARTEA II — SETUP SOFTWARE**
9. [Setup Raspberry Pi — de la zero](#9-setup-raspberry-pi--de-la-zero)
   - 9.1 [Flashuire card SD](#91-flashuire-card-sd)
   - 9.2 [Primul boot și configurare SSH](#92-primul-boot-și-configurare-ssh)
   - 9.3 [Instalare dependențe sistem](#93-instalare-dependențe-sistem)
   - 9.4 [Instalare și configurare PostgreSQL + TimescaleDB](#94-instalare-și-configurare-postgresql--timescaledb)
   - 9.5 [Instalare și configurare Mosquitto MQTT](#95-instalare-și-configurare-mosquitto-mqtt)
   - 9.6 [Pornire backend NestJS](#96-pornire-backend-nestjs)
   - 9.7 [Verificare sistem complet](#97-verificare-sistem-complet)
10. [Flashuire firmware ESP32 WROOM-32](#10-flashuire-firmware-esp32-wroom-32)
    - 10.1 [Instalare Arduino IDE + suport ESP32](#101-instalare-arduino-ide--suport-esp32)
    - 10.2 [Instalare librării necesare](#102-instalare-librării-necesare)
    - 10.3 [Configurare și upload firmware senzori](#103-configurare-și-upload-firmware-senzori)
11. [Flashuire firmware ESP32-CAM](#11-flashuire-firmware-esp32-cam)
12. [Configurare aplicație mobilă](#12-configurare-aplicație-mobilă)

---

## 1. Lista componentelor

| # | Componentă | Cantitate | Rol |
|---|-----------|-----------|-----|
| 1 | ESP32 WROOM-32 DevKitC (30 pini) | 2 | Noduri senzori (A = living, B = dormitor) |
| 2 | ESP32-CAM AI-Thinker | 1 | Nod cameră MJPEG (hol) |
| 3 | DHT22 (AM2302) | 2 | Temperatură + umiditate |
| 4 | MQ-2 | 2 | Gaz / fum / vapori |
| 5 | PIR HC-SR501 | 2 | Detecție mișcare |
| 6 | BH1750 (GY-302) | 2 | Iluminanță (lux), I²C |
| 7 | Modul releu 4 canale (5V, active LOW) | 2 | Control dispozitive 220V |
| 8 | Buzzer activ 5V | 2 | Alertă sonoră locală |
| 9 | Servomotor SG90 (sau MG996R) | 1 | Control perdele (Nodul A) |
| 10 | Rezistență 10 kΩ | 2 | Pull-up DHT22 |
| 11 | Breadboard 830 puncte | 3 | Prototipare |
| 12 | Fire dupont M-M, M-F, F-F | ~50 | Conexiuni |
| 13 | Adaptor FTDI (USB-Serial, 3.3V/5V) | 1 | Programare ESP32-CAM |
| 14 | Sursă 5V / 3A (USB sau adaptoare) | 3 | Alimentare noduri |
| 15 | Cablu micro-USB / USB-C | 2 | Alimentare + programare ESP32 standard |

---

## 2. Alimentarea sistemului

### Principiu esențial

```
[USB 5V / 3A]
      │
      ├─── ESP32 VIN (pin 5V) ──→ ESP32 furnizează 3.3V intern
      │
      ├─── Linia 5V pe breadboard ──→ PIR, MQ-2, Relay VCC
      │
      ├─── Servo VCC (DIRECT, nu prin ESP32!) ──→ SG90 roșu
      │
      └─── ESP32 3.3V OUT ──→ DHT22, BH1750 VCC
```

> ⚠️ **ATENȚIE CRITICĂ**: Servomotorul SG90 consumă până la 500 mA la rotire.
> Dacă îl conectezi la pinul 3.3V sau 5V al ESP32, microcontrolerul se va reseta!
> **Alimentează servo DIRECT din sursa 5V externă** (aceeași sursă, GND comun cu ESP32).

### Rail-uri breadboard recomandate

| Rail | Tensiune | Conectat la |
|------|----------|-------------|
| Roșu (+) sus | 5V | VIN ESP32, PIR, MQ-2, Relay, Servo |
| Albastru (-) sus | GND | GND ESP32, GND toate componentele |
| Roșu (+) jos | 3.3V | DHT22 VCC, BH1750 VCC |
| Albastru (-) jos | GND | (idem) |

---

## 3. Nodul A — ESP32 WROOM-32 (Living)

> Nodul A este tipul `hybrid`: are toți senzorii + releu + **servomotor** (control perdele).

### 3.1 DHT22 — temperatură și umiditate

**Pinout DHT22 (față spre tine, 4 pini de la stânga la dreapta):**
```
[1: VCC] [2: DATA] [3: N/C] [4: GND]
```

| Pin DHT22 | Culoare fir | Pin ESP32 | Observație |
|-----------|------------|-----------|-----------|
| 1 — VCC | Roșu | 3.3V | NU 5V! |
| 2 — DATA | Galben | **GPIO4** | + rezistență pull-up 10kΩ la 3.3V |
| 3 — N/C | — | — | Neconectat |
| 4 — GND | Negru | GND | |

**Rezistență pull-up:**
```
3.3V ──┤10kΩ├── GPIO4 ──── DHT22 pin DATA
```
Fixează rezistența de 10kΩ pe breadboard între firul de 3.3V și GPIO4.
Fără ea, citirile sunt instabile sau returnează -999.

---

### 3.2 MQ-2 — senzor gaz/fum

> MQ-2 are nevoie de **preîncălzire 30–60 secunde** după alimentare pentru citiri stabile.

| Pin MQ-2 | Culoare fir | Pin ESP32 | Observație |
|----------|------------|-----------|-----------|
| VCC | Roșu | **5V** | Necesită 5V (heater intern) |
| GND | Negru | GND | |
| A0 (analog) | Verde | **GPIO34** | Valoare continuă 0–4095 |
| D0 (digital) | Albastru | **GPIO35** | Prag reglabil din potențiometrul MQ-2 |

> GPIO34 și GPIO35 sunt **input-only** pe ESP32 — perfect pentru ADC și semnale digitale externe.
> NU pot fi configurate ca OUTPUT.

**Calibrare prag D0:**
Rotește potențiometrul de pe modulul MQ-2 până LED-ul D0 se aprinde la concentrația dorită de gaz.

---

### 3.3 PIR HC-SR501 — detecție mișcare

**Pinout HC-SR501 (3 pini, etichetați pe modul):**

| Pin PIR | Culoare fir | Pin ESP32 | Observație |
|---------|------------|-----------|-----------|
| VCC | Roșu | **5V** | Necesită 5V |
| OUT | Galben | **GPIO27** | HIGH = mișcare detectată |
| GND | Negru | GND | |

**Reglaje pe HC-SR501:**
- **Potențiometru stânga (Sx):** sensibilitate (raza de detecție 3–7 m)
- **Potențiometru dreapta (Tx):** timp de menținere semnal HIGH (3s–5min)
- **Jumper mod:**
  - Poziția L (single trigger): un singur puls HIGH
  - Poziția H (repeat trigger): menține HIGH cât timp detectează mișcare ✅ (recomandat)

---

### 3.4 BH1750 — senzor lumină (I²C)

> BH1750 (modul GY-302) comunică prin I²C. Magistrala I²C pe ESP32: SDA=GPIO21, SCL=GPIO22.

| Pin BH1750 | Culoare fir | Pin ESP32 | Observație |
|------------|------------|-----------|-----------|
| VCC | Roșu | 3.3V | |
| GND | Negru | GND | |
| SCL | Verde | **GPIO22** | I²C clock |
| SDA | Albastru | **GPIO21** | I²C date |
| ADDR | Negru | GND | Adresă I²C = **0x23** |

> Dacă ADDR este conectat la 3.3V, adresa devine 0x5C.
> Lasă ADDR la GND → adresă 0x23 (valoarea din firmware).

**Verificare I²C (în codul Arduino):**
```cpp
Wire.begin(21, 22);
// BH1750 va răspunde la adresa 0x23
```

---

### 3.5 Modul releu 4 canale

> Modulul releu este **active LOW**: IN=LOW (0V) → releu activat; IN=HIGH (3.3V) → releu dezactivat.
> ESP32 poate controla direct releele (semnalul de 3.3V este suficient pentru logica modulului).

| Pin Relay | Culoare fir | Pin ESP32 | Releu controlat |
|-----------|------------|-----------|----------------|
| VCC | Roșu | **5V** | Alimentare optocuploare |
| GND | Negru | GND | |
| IN1 | Portocaliu | **GPIO26** | Releu 1 (ex. lumini living) |
| IN2 | Galben | **GPIO25** | Releu 2 (ex. ventilator) |
| IN3 | Verde | **GPIO33** | Releu 3 (ex. priză comandată) |
| IN4 | Albastru | **GPIO32** | Releu 4 (ex. rezervă) |

> ⚠️ **Atenție 220V**: Terminalele NO/COM/NC ale releului sunt pentru circuitele de 220V.
> Lucrează cu atenție, izolează conexiunile cu bandă izolatoare sau carcasă.
> La prototip pe breadboard, lasă terminalele de 220V deconectate și testează doar logica.

**Cod firmware — active LOW:**
```cpp
pinMode(26, OUTPUT);
digitalWrite(26, LOW);   // Activează releu 1
digitalWrite(26, HIGH);  // Dezactivează releu 1
```

---

### 3.6 Buzzer activ

> Buzzer **activ** = are oscilator intern, scoate sunet la simplă aplicare de tensiune.
> (Buzzer pasiv necesită semnal PWM — nu îl folosi dacă nu e specificat „activ".)

| Pin Buzzer | Culoare fir | Pin ESP32 | Observație |
|------------|------------|-----------|-----------|
| + (VCC) | Roșu | **GPIO5** | Controlat direct din GPIO |
| − (GND) | Negru | GND | |

**Cod firmware:**
```cpp
pinMode(5, OUTPUT);
digitalWrite(5, HIGH);  // Buzzer ON
delay(500);
digitalWrite(5, LOW);   // Buzzer OFF
```

---

### 3.7 Servomotor SG90 — control perdele

> SG90 are 3 fire: roșu (VCC), negru/maro (GND), galben/portocaliu (PWM semnal).

| Fir servo | Culoare | Conectat la | Observație |
|-----------|---------|------------|-----------|
| VCC | Roșu | **5V extern** | NU la pinul ESP32! |
| GND | Negru/Maro | GND (comun cu ESP32) | |
| PWM | Galben/Portocaliu | **GPIO18** | Semnal PWM 50Hz |

**Parametri PWM pentru SG90:**
| Unghi | Lățime puls | Poziție perdea |
|-------|------------|----------------|
| 0° | 0.5 ms | Deschis complet |
| 90° | 1.5 ms | Jumătate |
| 180° | 2.5 ms | Închis complet |

**Frecvență PWM:** 50 Hz (perioadă 20ms)

**Cod firmware (Arduino/ESP32):**
```cpp
#include <ESP32Servo.h>

Servo perdeaServo;
perdeaServo.attach(18);   // GPIO18
perdeaServo.write(0);     // Deschis
perdeaServo.write(90);    // Jumătate
perdeaServo.write(180);   // Închis
```

> Instalează librăria `ESP32Servo` din Arduino Library Manager (nu folosi `Servo.h` standard — nu e compatibilă cu ESP32).

**Alimentare separată — detaliu breadboard:**
```
[Sursă 5V externă]
    │
    ├── (+) → Rail 5V breadboard → Servo fir roșu
    └── (−) → Rail GND breadboard → Servo fir negru/maro
                                  → GND ESP32 (GND comun!)
```

---

## 4. Nodul B — ESP32 WROOM-32 (Dormitor)

> Nodul B este tipul `sensor`: senzori + releu, **fără servomotor**.
> Conexiunile sunt identice cu Nodul A, cu excepția că GPIO18 rămâne liber.

| Componentă | Pini ESP32 |
|-----------|-----------|
| DHT22 | GPIO4 (+ pull-up 10kΩ la 3.3V) |
| MQ-2 | GPIO34 (A0), GPIO35 (D0) |
| PIR | GPIO27 |
| BH1750 | GPIO21 (SDA), GPIO22 (SCL) |
| Relay IN1-IN4 | GPIO26, GPIO25, GPIO33, GPIO32 |
| Buzzer | GPIO5 |

Consultă secțiunile 3.1–3.6 de mai sus pentru detaliile fiecărei componente.

---

## 5. ESP32-CAM AI-Thinker — Nodul cameră (Hol)

> ESP32-CAM **nu are port USB** nativ. Programarea se face prin FTDI USB-Serial.
> **Sunt două faze distincte: modul FLASH și modul RUNTIME.**

### 5.1 Programare firmware (mod flash)

> ⚠️ În modul flash, **GPIO0 trebuie conectat la GND** (pull-down hardware).

**Materiale necesare:**
- Adaptor FTDI USB-Serial (FT232RL sau CH340) setat pe **5V**
- 4 fire dupont F-F
- Breadboard mic sau fire directe

**Conexiuni FTDI → ESP32-CAM:**

| Pin FTDI | Culoare fir | Pin ESP32-CAM | Observație |
|----------|------------|---------------|-----------|
| GND | Negru | GND | |
| VCC (5V) | Roșu | 5V | FTDI trebuie setat pe 5V, nu 3.3V! |
| TX | Verde | **U0RXD** (GPIO3) | TX FTDI → RX ESP32 |
| RX | Galben | **U0TXD** (GPIO1) | RX FTDI → TX ESP32 |
| — | Negru scurt | **IO0 → GND** | **PUNTE pentru activare mod flash** |

**Localizare pini pe ESP32-CAM AI-Thinker:**
```
     ┌──────────────────┐
     │   [Cameră OV2640]│
     │                  │
 5V ─┤ 5V          GND ├─ GND
GND ─┤ GND          IO0├─── ← punte la GND pentru flash
     │ ...          ... │
U0TXD┤ GPIO1      GPIO3├─ U0RXD
     └──────────────────┘
```

**Pași programare:**

```
1. Conectează FTDI la ESP32-CAM conform tabelului de mai sus
2. Conectează IO0 la GND cu un fir scurt (punte pe breadboard)
3. Conectează FTDI la calculator prin USB
4. Deschide Arduino IDE:
   - Board: "AI Thinker ESP32-CAM"
   - Port: portul COM/tty al FTDI
   - Upload Speed: 115200
5. Apasă butonul RESET de pe ESP32-CAM
   (sau deconectează și reconectează 5V)
6. Click "Upload" în Arduino IDE
7. Așteptă "Connecting..." → dacă durează mult, resetează din nou
8. Așteaptă "Done uploading"
9. SCOATE puntea IO0-GND
10. Apasă din nou RESET → ESP32-CAM pornește în mod normal
```

> **Eroarea "Failed to connect"?**
> - Verifică că FTDI e pe 5V (nu 3.3V)
> - Verifică că TX→RXD și RX→TXD (nu invers)
> - Asigură-te că IO0 este conectat la GND ÎNAINTE de RESET
> - Încearcă viteză mai mică: Upload Speed 115200 sau chiar 57600

---

### 5.2 Funcționare normală

> După flash, scoate puntea IO0-GND și resetează. ESP32-CAM pornește și se conectează la Wi-Fi.

**Aflarea IP-ului:**
1. Deschide Serial Monitor (baud rate: 115200)
2. Apasă RESET pe ESP32-CAM
3. Vei vedea ceva similar:
```
WiFi connected
Camera Ready! Use 'http://192.168.1.XX' to connect
```
4. Notează IP-ul și actualizează `config.ts` în aplicația mobilă:
```typescript
export const CAMERA_HOST = 'http://192.168.1.XX';  // ← IP-ul tău real
```

**URL-uri cameră:**
| Funcție | URL |
|---------|-----|
| Stream MJPEG live | `http://<IP>/stream` |
| Snapshot JPEG | `http://<IP>/capture` |
| Pagină web control | `http://<IP>` |

**Pini disponibili pe ESP32-CAM după cameră:**
| GPIO | Status | Utilizare posibilă |
|------|--------|-------------------|
| GPIO4 | Ocupat parțial | Flash LED built-in (poate fi reutilizat) |
| GPIO2 | Liber | LED indicator status WiFi |
| GPIO12-15 | Ocupați | Card SD microSD |
| GPIO0 | ⚠️ Rezervat | Nu folosi în runtime! |
| GPIO16 | Ocupat | PSRAM CS |

> ESP32-CAM se **încălzește** în funcționare normală — este normal.
> Dacă temperatura depășește 70°C, adaugă un radiator mic de aluminiu.

---

## 6. Schema de alimentare completă

```
                    ┌─────────────────────────────────┐
                    │       SURSĂ 5V / 3A              │
                    │    (adaptor USB sau DC 5V)        │
                    └───────────────┬─────────────────┘
                                    │
              ┌─────────────────────┼──────────────────────┐
              │                     │                      │
         ESP32 VIN             Rail 5V BRD           Servo VCC
              │                     │
         ESP32 3.3V OUT         ┌───┴──────────────┐
              │                 │                  │
    ┌─────────┴──────┐      PIR VCC           Relay VCC
    │                │      MQ-2 VCC          Buzzer (via GPIO)
  DHT22 VCC      BH1750 VCC

              └──────── GND COMUN (toate componentele) ────┘
```

---

## 7. Tabel complet conexiuni — Nodul A

> Referință rapidă pentru asamblare. Folosește-l ca checklist (bifează fiecare fir).

| # | Componentă | Pin componentă | Pin ESP32 | Culoare fir recomandat |
|---|-----------|---------------|-----------|------------------------|
| 1 | DHT22 | VCC | 3.3V | 🔴 Roșu |
| 2 | DHT22 | GND | GND | ⚫ Negru |
| 3 | DHT22 | DATA | GPIO4 | 🟡 Galben |
| 4 | Pull-up 10kΩ | (între 3.3V și GPIO4) | — | — |
| 5 | MQ-2 | VCC | 5V | 🔴 Roșu |
| 6 | MQ-2 | GND | GND | ⚫ Negru |
| 7 | MQ-2 | A0 | GPIO34 | 🟢 Verde |
| 8 | MQ-2 | D0 | GPIO35 | 🔵 Albastru |
| 9 | PIR HC-SR501 | VCC | 5V | 🔴 Roșu |
| 10 | PIR HC-SR501 | GND | GND | ⚫ Negru |
| 11 | PIR HC-SR501 | OUT | GPIO27 | 🟡 Galben |
| 12 | BH1750 | VCC | 3.3V | 🔴 Roșu |
| 13 | BH1750 | GND | GND | ⚫ Negru |
| 14 | BH1750 | SDA | GPIO21 | 🔵 Albastru |
| 15 | BH1750 | SCL | GPIO22 | 🟢 Verde |
| 16 | BH1750 | ADDR | GND | ⚫ Negru |
| 17 | Relay 4ch | VCC | 5V | 🔴 Roșu |
| 18 | Relay 4ch | GND | GND | ⚫ Negru |
| 19 | Relay 4ch | IN1 | GPIO26 | 🟠 Portocaliu |
| 20 | Relay 4ch | IN2 | GPIO25 | 🟡 Galben |
| 21 | Relay 4ch | IN3 | GPIO33 | 🟢 Verde |
| 22 | Relay 4ch | IN4 | GPIO32 | 🔵 Albastru |
| 23 | Buzzer | + | GPIO5 | 🟠 Portocaliu |
| 24 | Buzzer | − | GND | ⚫ Negru |
| 25 | Servo SG90 | VCC (roșu) | 5V **EXTERN** | 🔴 Roșu |
| 26 | Servo SG90 | GND (negru/maro) | GND | ⚫ Negru |
| 27 | Servo SG90 | PWM (galben) | GPIO18 | 🟡 Galben |

---

## 8. Note practice și troubleshooting

### DHT22 returnează -999 sau NaN
→ Verifică rezistența pull-up de 10kΩ între DATA și 3.3V.
→ Verifică că VCC este 3.3V, nu 5V.
→ Distanța fir DATA > 20 cm? Folosește un condensator 100nF între VCC și GND lângă senzor.

### MQ-2 dă valori mari chiar și în aer curat
→ Normal la primele 30–60 secunde! Senzorul trebuie să se preîncălzească.
→ Dacă valorile rămân mari după 1 minut, reglează potențiometrul D0.
→ Nu monta MQ-2 lângă releu — câmpul electromagnetic poate crea interferențe ADC.

### ESP32 se resetează când servo se mișcă
→ Servo nu este alimentat extern — mută VCC servo direct la sursa 5V.
→ Verifică că GND servo și GND ESP32 sunt conectate la același punct.

### ESP32-CAM nu apare în rețea Wi-Fi
→ Verifică credențialele Wi-Fi în firmware (SSID și parolă).
→ ESP32-CAM suportă doar Wi-Fi 2.4 GHz, nu 5 GHz.
→ Antena PCB integrată are rază scurtă — plasează modulul aproape de router.

### Releul se activează la pornire (flic inițial)
→ Normal! La boot, GPIO-urile sunt HIGH → releele active LOW se activează momentan.
→ Soluție: adaugă `digitalWrite(pin, HIGH)` înainte de `pinMode(pin, OUTPUT)` în `setup()`.

### BH1750 nu răspunde (eroare I2C)
→ Verifică ADDR este la GND (adresă 0x23).
→ Verifică că SDA și SCL nu sunt inversate.
→ Rulează un scanner I2C pentru confirmare adresă.

### Interferențe între senzori
→ Ține DHT22 departe de surse de căldură (releu, MQ-2 care se încălzește).
→ PIR poate da false pozitive dacă este expus la lumina directă a soarelui — orientează-l spre interior.

---

## Rezumat pinout ESP32 WROOM-32 — Nodul A (quick reference)

```
GPIO4  → DHT22 DATA         GPIO21 → BH1750 SDA
GPIO5  → BUZZER             GPIO22 → BH1750 SCL
GPIO18 → SERVO PWM          GPIO25 → RELAY IN2
GPIO26 → RELAY IN1          GPIO27 → PIR OUT
GPIO32 → RELAY IN4          GPIO33 → RELAY IN3
GPIO34 → MQ-2 A0 (input)    GPIO35 → MQ-2 D0 (input)
```

---

*Ghid creat pentru proiectul de licență Smart Home Local-First — Universitatea Politehnica Timișoara, 2026.*

---

---

# PARTEA II — SETUP SOFTWARE

---

## 9. Setup Raspberry Pi — de la zero

> Timp estimat: ~45 minute prima dată.
> Vei avea nevoie de: Raspberry Pi 3B+, card microSD ≥16GB (recomandat 32GB), cablu micro-USB 5V/3A, router Wi-Fi, calculator.

### 9.1 Flashuire card SD

**Pe calculatorul tău (Windows / Mac / Linux):**

1. Descarcă **Raspberry Pi Imager** de la `https://www.raspberrypi.com/software/`
2. Instalează și deschide Raspberry Pi Imager
3. Click **"Choose OS"** → `Raspberry Pi OS (other)` → **`Raspberry Pi OS Lite (64-bit)`**
   > Lite = fără interfață grafică, mai rapid și mai stabil pentru server
4. Click **"Choose Storage"** → selectează cardul tău microSD
5. Click pe **iconița roată** (Advanced settings) înainte de a scrie:
   - ✅ **Set hostname:** `smarthome`
   - ✅ **Enable SSH** → Use password authentication
   - ✅ **Set username and password:**
     - Username: `pi`
     - Password: `smarthome123` (sau altceva, notează-l!)
   - ✅ **Configure wireless LAN:**
     - SSID: numele rețelei tale Wi-Fi
     - Password: parola Wi-Fi
     - Wireless LAN country: `RO`
   - ✅ **Set locale settings:** Timezone `Europe/Bucharest`
6. Click **Save** → Click **Write** → Confirmă
7. Așteaptă ~5 minute să se scrie cardul

### 9.2 Primul boot și configurare SSH

**Introdu cardul în Raspberry Pi și alimentează-l (micro-USB 5V/3A).**

Așteptă ~90 secunde pentru primul boot (LED-ul verde clipește activ).

**Găsește IP-ul Raspberry Pi:**
- Opțiunea 1: Intră în router (de obicei `192.168.1.1`) → Connected Devices → caută `smarthome`
- Opțiunea 2: Pe Windows, deschide Command Prompt și rulează:
  ```
  ping smarthome.local
  ```
- Opțiunea 3: Instalează aplicația **Fing** pe telefon → scanează rețeaua

**Conectează-te prin SSH:**

```bash
# Mac / Linux — din Terminal:
ssh pi@smarthome.local
# sau cu IP direct:
ssh pi@192.168.1.XX

# Windows — folosește PuTTY sau Terminal (Win 11):
ssh pi@smarthome.local
```

Când apare `Are you sure you want to continue?` → scrie `yes` → Enter → introdu parola.

Ar trebui să vezi promptul:
```
pi@smarthome:~ $
```

**Actualizează sistemul (obligatoriu):**
```bash
sudo apt update && sudo apt upgrade -y
sudo reboot
```

Reconectează-te după ~30 secunde.

### 9.3 Instalare dependențe sistem

```bash
# Node.js 20 LTS (pentru backend NestJS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificare:
node --version    # trebuie să afișeze v20.x.x
npm --version     # trebuie să afișeze 10.x.x

# Git (pentru a descărca codul)
sudo apt install -y git

# Python 3 + pip (pentru ML — Isolation Forest)
sudo apt install -y python3 python3-pip python3-venv

# Instrumente utile
sudo apt install -y curl wget htop nano unzip
```

### 9.4 Instalare și configurare PostgreSQL + TimescaleDB

```bash
# PostgreSQL
sudo apt install -y postgresql postgresql-client

# Pornire și activare automată la boot
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Instalare TimescaleDB
sudo apt install -y gnupg
curl -fsSL https://packagecloud.io/timescale/timescaledb/gpgkey | \
  sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/timescaledb.gpg

echo "deb https://packagecloud.io/timescale/timescaledb/debian/ $(lsb_release -c -s) main" | \
  sudo tee /etc/apt/sources.list.d/timescaledb.list

sudo apt update
sudo apt install -y timescaledb-2-postgresql-15

# Activare TimescaleDB
sudo timescaledb-tune --quiet --yes
sudo systemctl restart postgresql
```

**Creare bază de date și utilizator:**

```bash
# Intră în PostgreSQL ca admin
sudo -u postgres psql

# În consola PostgreSQL (toate liniile de jos):
CREATE USER smarthome WITH PASSWORD 'smarthome_pass_2026';
CREATE DATABASE smarthome_db OWNER smarthome;
\c smarthome_db
CREATE EXTENSION IF NOT EXISTS timescaledb;
\q
```

**Testare conexiune:**
```bash
psql -U smarthome -h localhost -d smarthome_db
# Introdu parola: smarthome_pass_2026
# Ar trebui să apară: smarthome_db=>
\q
```

### 9.5 Instalare și configurare Mosquitto MQTT

```bash
# Instalare
sudo apt install -y mosquitto mosquitto-clients

# Pornire și activare automată
sudo systemctl enable mosquitto
sudo systemctl start mosquitto
```

**Configurare broker (autentificare + port standard):**

```bash
# Creare fișier parole MQTT
sudo mosquitto_passwd -c /etc/mosquitto/passwd smarthome
# Introdu parola: smarthome_mqtt_2026 (de două ori)

# Configurare Mosquitto
sudo nano /etc/mosquitto/conf.d/smarthome.conf
```

Scrie în fișier (CTRL+X, Y, Enter pentru salvare):
```
listener 1883
allow_anonymous false
password_file /etc/mosquitto/passwd
```

```bash
# Repornire
sudo systemctl restart mosquitto

# Test: publică un mesaj de test
mosquitto_pub -h localhost -u smarthome -P smarthome_mqtt_2026 \
  -t "test/ping" -m "hello"

# Test: ascultă mesaje (într-un alt terminal)
mosquitto_sub -h localhost -u smarthome -P smarthome_mqtt_2026 \
  -t "test/#" -v
```

### 9.6 Pornire backend NestJS

```bash
# Clonare cod sursă (înlocuiește cu URL-ul tău real)
cd ~
git clone https://github.com/USER/smart-home-api.git api
cd api

# Creare fișier .env
nano .env
```

Conținut `.env` (înlocuiește cu valorile tale):
```env
# Baza de date
DB_HOST=localhost
DB_PORT=5432
DB_NAME=smarthome_db
DB_USER=smarthome
DB_PASS=smarthome_pass_2026

# MQTT
MQTT_URL=mqtt://localhost:1883
MQTT_USER=smarthome
MQTT_PASS=smarthome_mqtt_2026

# JWT
JWT_SECRET=schimba_asta_cu_un_sir_lung_random_minim_32_caractere
JWT_EXPIRES=7d

# Simulator (true = generează date false automat)
SIMULATE=true
SIMULATE_INTERVAL_MS=5000

# Utilizator implicit creat la pornire
DEFAULT_USER=admin
DEFAULT_PASS=admin123
```

```bash
# Instalare dependențe
npm install

# Build producție
npm run build

# Pornire (test)
npm run start:prod
```

Ar trebui să vezi în terminal:
```
[Nest] LOG [NestApplication] Nest application successfully started
[Simulator] Pornit — interval 5000ms
[Simulator] Noduri verificate: esp32_node_a, esp32_node_b, esp32_cam_node
```

**Pornire automată cu PM2 (recomandat pentru producție):**
```bash
# Instalare PM2 (process manager)
sudo npm install -g pm2

# Pornire API cu PM2
pm2 start npm --name "smarthome-api" -- run start:prod

# Salvare configurație (pornire automată după reboot)
pm2 save
pm2 startup
# Copiază și rulează comanda afișată de pm2 startup
```

### 9.7 Verificare sistem complet

```bash
# Verifică că toate serviciile rulează:
sudo systemctl status postgresql   # Active: running ✅
sudo systemctl status mosquitto    # Active: running ✅
pm2 status                         # smarthome-api: online ✅

# Testează API-ul (de pe Raspberry Pi)
curl http://localhost:3000/api/sensors/nodes
# Ar trebui să returneze JSON cu nodurile

# Află IP-ul Raspberry Pi (notează-l pentru aplicație)
hostname -I
# Ex: 192.168.1.100
```

> ✅ **Raspberry Pi este gata!** Notează IP-ul — îl vei folosi în aplicația mobilă.

---

## 10. Flashuire firmware ESP32 WROOM-32

> Timp estimat: ~20 minute (prima dată, cu instalare Arduino IDE).

### 10.1 Instalare Arduino IDE + suport ESP32

**Pe calculatorul tău:**

1. Descarcă **Arduino IDE 2.x** de la `https://www.arduino.cc/en/software`
2. Instalează și deschide Arduino IDE
3. Adaugă suport ESP32:
   - File → Preferences → **Additional boards manager URLs:**
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
   - Click OK
4. Tools → **Board → Boards Manager**
   - Caută: `esp32`
   - Instalează: **esp32 by Espressif Systems** (versiunea 2.x sau 3.x)
   - Așteptă ~5 minute

### 10.2 Instalare librării necesare

Tools → **Manage Libraries** → caută și instalează fiecare:

| Librărie | Autor | Rol |
|----------|-------|-----|
| `DHT sensor library` | Adafruit | Citire DHT22 |
| `Adafruit Unified Sensor` | Adafruit | Dependință DHT |
| `BH1750` | Christopher Laws | Citire senzor lumină |
| `PubSubClient` | Nick O'Leary | Client MQTT |
| `ESP32Servo` | Kevin Harrington | Control servo |
| `ArduinoJson` | Benoit Blanchon | Serializare JSON |

> ⚠️ Nu folosi librăria `Servo.h` standard — nu e compatibilă cu ESP32. Folosește **ESP32Servo**.

### 10.3 Configurare și upload firmware senzori

**Selectare placă:**
- Tools → **Board → ESP32 Arduino → `ESP32 Dev Module`**
- Tools → **Port** → selectează portul COM/tty al ESP32
  - Windows: `COM3`, `COM4` etc. (verifică în Device Manager)
  - Mac: `/dev/cu.usbserial-...` sau `/dev/cu.SLAB_USBtoUART`

**Cod firmware minimal** (creează un fișier nou `smarthome_node_a.ino`):

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <BH1750.h>
#include <Wire.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>

// ===== CONFIGURARE — modifică aici =====
const char* WIFI_SSID     = "NumeleReteleiTale";
const char* WIFI_PASSWORD = "ParolaWiFi";
const char* MQTT_SERVER   = "192.168.1.100";   // IP-ul Raspberry Pi
const int   MQTT_PORT     = 1883;
const char* MQTT_USER     = "smarthome";
const char* MQTT_PASS     = "smarthome_mqtt_2026";
const char* NODE_ID       = "esp32_node_a";
const char* LOCATION      = "living";
// =======================================

// Pini
#define DHT_PIN     4
#define MQ2_PIN     34
#define PIR_PIN     27
#define BUZZER_PIN  5
#define SERVO_PIN   18
#define RELAY1_PIN  26
#define RELAY2_PIN  25
#define RELAY3_PIN  33
#define RELAY4_PIN  32

DHT dht(DHT_PIN, DHT22);
BH1750 lightMeter;
Servo perdeaServo;
WiFiClient espClient;
PubSubClient mqtt(espClient);

// Topic-uri MQTT
String topicData    = "home/" + String(NODE_ID) + "/data";
String topicCmd     = "home/" + String(NODE_ID) + "/commands";
String topicStatus  = "home/" + String(NODE_ID) + "/status";

void connectWiFi() {
  Serial.print("Conectare WiFi: ");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
  }
  Serial.println("\nWiFi conectat! IP: " + WiFi.localIP().toString());
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (int i = 0; i < length; i++) msg += (char)payload[i];

  JsonDocument doc;
  deserializeJson(doc, msg);

  String action = doc["action"].as<String>();

  if (action == "relay_on") {
    int relay = doc["relay"] | 1;
    int pins[] = {RELAY1_PIN, RELAY2_PIN, RELAY3_PIN, RELAY4_PIN};
    if (relay >= 1 && relay <= 4) digitalWrite(pins[relay-1], LOW);  // active LOW
  }
  else if (action == "relay_off") {
    int relay = doc["relay"] | 1;
    int pins[] = {RELAY1_PIN, RELAY2_PIN, RELAY3_PIN, RELAY4_PIN};
    if (relay >= 1 && relay <= 4) digitalWrite(pins[relay-1], HIGH);
  }
  else if (action == "servo_move") {
    int angle = doc["servoAngle"] | 0;
    perdeaServo.write(angle);
    Serial.println("Servo → " + String(angle) + "°");
  }
  else if (action == "buzzer_beep") {
    int count = doc["count"] | 1;
    for (int i = 0; i < count; i++) {
      digitalWrite(BUZZER_PIN, HIGH); delay(300);
      digitalWrite(BUZZER_PIN, LOW);  delay(200);
    }
  }
  else if (action == "all_off") {
    digitalWrite(RELAY1_PIN, HIGH);
    digitalWrite(RELAY2_PIN, HIGH);
    digitalWrite(RELAY3_PIN, HIGH);
    digitalWrite(RELAY4_PIN, HIGH);
    digitalWrite(BUZZER_PIN, LOW);
    perdeaServo.write(0);
  }
}

void connectMQTT() {
  while (!mqtt.connected()) {
    Serial.print("Conectare MQTT...");
    String clientId = "esp32-" + String(NODE_ID);
    if (mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
      Serial.println(" conectat!");
      mqtt.subscribe(topicCmd.c_str());
      mqtt.publish(topicStatus.c_str(), "online", true);
    } else {
      Serial.println(" eroare, retry în 3s");
      delay(3000);
    }
  }
}

void setup() {
  Serial.begin(115200);

  // Inițializare pini
  pinMode(PIR_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(RELAY1_PIN, OUTPUT); digitalWrite(RELAY1_PIN, HIGH);  // HIGH = dezactivat
  pinMode(RELAY2_PIN, OUTPUT); digitalWrite(RELAY2_PIN, HIGH);
  pinMode(RELAY3_PIN, OUTPUT); digitalWrite(RELAY3_PIN, HIGH);
  pinMode(RELAY4_PIN, OUTPUT); digitalWrite(RELAY4_PIN, HIGH);

  // Servo
  perdeaServo.attach(SERVO_PIN);
  perdeaServo.write(0);

  // Senzori
  dht.begin();
  Wire.begin(21, 22);
  lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);

  // Rețea
  connectWiFi();
  mqtt.setServer(MQTT_SERVER, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
  connectMQTT();

  // Pauză preîncălzire MQ-2
  Serial.println("Preîncălzire MQ-2 (20s)...");
  delay(20000);
  Serial.println("Sistem pornit!");
}

void loop() {
  if (!mqtt.connected()) connectMQTT();
  mqtt.loop();

  // Citire senzori la fiecare 10 secunde
  static unsigned long lastRead = 0;
  if (millis() - lastRead > 10000) {
    lastRead = millis();

    float temp = dht.readTemperature();
    float hum  = dht.readHumidity();
    int   gas  = analogRead(MQ2_PIN);
    bool  pir  = digitalRead(PIR_PIN);
    float lux  = lightMeter.readLightLevel();

    if (isnan(temp) || isnan(hum)) {
      Serial.println("DHT22 eroare citire!");
      return;
    }

    JsonDocument doc;
    doc["nodeId"]      = NODE_ID;
    doc["location"]    = LOCATION;
    doc["temperature"] = temp;
    doc["humidity"]    = hum;
    doc["gasLevel"]    = gas;
    doc["gasAlert"]    = (gas > 350);
    doc["motion"]      = pir;
    doc["lightLux"]    = lux;

    char buf[256];
    serializeJson(doc, buf);
    mqtt.publish(topicData.c_str(), buf);

    Serial.printf("T=%.1f°C H=%.1f%% Gas=%d PIR=%d Lux=%.0f\n",
                  temp, hum, gas, pir, lux);
  }
}
```

**Upload:**
1. Modifică `WIFI_SSID`, `WIFI_PASSWORD`, `MQTT_SERVER` (IP-ul Raspberry Pi)
2. Conectează ESP32 la calculator prin micro-USB
3. Apasă **Upload** (→) în Arduino IDE
4. Deschide **Serial Monitor** (Tools → Serial Monitor, baud 115200)
5. Ar trebui să vezi:
```
Conectare WiFi: ....
WiFi conectat! IP: 192.168.1.XXX
Conectare MQTT... conectat!
Preîncălzire MQ-2 (20s)...
Sistem pornit!
T=22.3°C H=55.1% Gas=145 PIR=0 Lux=234.0
```

> **Nodul B (Dormitor):** copiază același cod, schimbă `NODE_ID = "esp32_node_b"` și `LOCATION = "dormitor"`. Nu are servo, dar restul e identic.

---

## 11. Flashuire firmware ESP32-CAM

### Conexiuni FTDI pentru flash (recapitulare)

| FTDI | ESP32-CAM | Culoare fir |
|------|-----------|-------------|
| GND | GND | Negru |
| VCC **5V** | 5V | Roșu |
| TX | U0RXD (GPIO3) | Verde |
| RX | U0TXD (GPIO1) | Galben |
| — | **IO0 → GND** (punte!) | — |

### Pași setup Arduino IDE pentru ESP32-CAM

1. Tools → Board → **AI Thinker ESP32-CAM**
   > Dacă nu apare, caută `AI Thinker` în Boards Manager
2. Tools → Port → portul FTDI-ului (COM3/COM4 pe Windows, `/dev/cu.usbserial-...` pe Mac)
3. Tools → Upload Speed → **115200**
4. Tools → Partition Scheme → **Huge APP (3MB No OTA)**

### Cod firmware cameră

File → Examples → ESP32 → Camera → **`CameraWebServer`**

Sau creează `esp32cam_stream.ino`:

```cpp
#include "esp_camera.h"
#include <WiFi.h>
#include "esp_http_server.h"

// ===== CONFIGURARE =====
const char* WIFI_SSID     = "NumeleReteleiTale";
const char* WIFI_PASSWORD = "ParolaWiFi";
// =======================

// Pinout AI-Thinker ESP32-CAM
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

void startCameraServer();   // definit în CameraWebServer.ino

void setup() {
  Serial.begin(115200);

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size   = FRAMESIZE_VGA;   // 640x480
  config.jpeg_quality = 12;
  config.fb_count     = 2;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x\n", err);
    return;
  }

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Conectare WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
  }
  Serial.println("\nConectat! IP: " + WiFi.localIP().toString());

  startCameraServer();

  Serial.println("Camera Ready!");
  Serial.println("Stream URL:    http://" + WiFi.localIP().toString() + "/stream");
  Serial.println("Snapshot URL:  http://" + WiFi.localIP().toString() + "/capture");
}

void loop() {
  delay(10000);
}
```

> 💡 **Cel mai simplu:** folosește direct exemplul `CameraWebServer` din Arduino IDE (File → Examples → ESP32 → Camera → CameraWebServer). Modifică doar `WIFI_SSID` și `WIFI_PASS` la începutul fișierului.

**Procedura de upload:**

```
1. Conectează FTDI la ESP32-CAM (conform tabel de mai sus)
2. Pune puntea IO0 → GND
3. Apasă RESET pe ESP32-CAM
4. Click Upload în Arduino IDE
5. Așteptă "Connecting........_____" → "Done uploading"
6. Scoate puntea IO0-GND
7. Apasă RESET
8. Deschide Serial Monitor (115200 baud)
9. Notează IP-ul afișat
```

**Actualizează IP-ul în aplicație (`mobile/src/services/config.ts`):**
```typescript
export const CAMERA_HOST = 'http://192.168.1.XXX';  // ← IP-ul ESP32-CAM
```

---

## 12. Configurare aplicație mobilă

### Cerințe

- Node.js 18+ instalat pe calculator
- Expo Go instalat pe telefon (App Store / Google Play)
- Telefonul și calculatorul pe **aceeași rețea Wi-Fi** ca Raspberry Pi

### Setup

```bash
# Clonare repo (din directorul de pe calculator)
git clone https://github.com/USER/smart-home-mobile.git mobile
cd mobile

# Instalare dependențe
npm install

# Configurare IP Raspberry Pi
nano src/services/config.ts
```

Setează IP-ul Raspberry Pi:
```typescript
export const API_HOST = 'http://192.168.1.100:3000';  // ← IP-ul tău RPi
export const CAMERA_HOST = 'http://192.168.1.XXX';    // ← IP-ul ESP32-CAM
```

```bash
# Pornire aplicație
npx expo start
```

Se deschide o pagină cu un **cod QR**:
- **iPhone:** deschide camera și scanează codul QR → se deschide în Expo Go
- **Android:** deschide Expo Go → "Scan QR code" → scanează

### Autentificare

La primul login:
- Username: `admin`
- Password: `admin123`

(configurate prin `DEFAULT_USER` și `DEFAULT_PASS` din `.env` pe Raspberry Pi)

---

## Rezumat pinout ESP32 WROOM-32 — Nodul A (quick reference)

```
GPIO4  → DHT22 DATA         GPIO21 → BH1750 SDA
GPIO5  → BUZZER             GPIO22 → BH1750 SCL
GPIO18 → SERVO PWM          GPIO25 → RELAY IN2
GPIO26 → RELAY IN1          GPIO27 → PIR OUT
GPIO32 → RELAY IN4          GPIO33 → RELAY IN3
GPIO34 → MQ-2 A0 (input)    GPIO35 → MQ-2 D0 (input)
```

---

*Ghid creat pentru proiectul de licență Smart Home Local-First — Universitatea Politehnica Timișoara, 2026.*
