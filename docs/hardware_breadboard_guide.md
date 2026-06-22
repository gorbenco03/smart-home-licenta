# Ghid Conexiuni Breadboard — Smart Home ESP32

> **Versiune breadboard** — pentru prototip și testare. Conexiunile sunt identice cu cele din schema finală, doar că se folosesc fire dupont și breadboard în loc de PCB.

---

## Cuprins

**PARTEA I — HARDWARE & CONEXIUNI**
1. [Lista componentelor](#1-lista-componentelor)
2. [Alimentarea sistemului](#2-alimentarea-sistemului)
3. [Nodul interior — ESP32 WROOM-32](#3-nodul-interior--esp32-wroom-32)
   - 3.1 [DHT11 #1 și #2 — temperatură și umiditate](#31-dht11-1-și-2--temperatură-și-umiditate)
   - 3.2 [MQ-2 — senzor gaz/fum](#32-mq-2--senzor-gazfum)
   - 3.3 [LDR #1 și #2 — senzori lumină](#33-ldr-1-și-2--senzori-lumină)
   - 3.4 [Buzzer activ](#34-buzzer-activ)
   - 3.5 [Servomotor SG90 — control perdele](#35-servomotor-sg90--control-perdele)
   - 3.6 [LED-uri #1, #2, #3](#36-led-uri-1-2-3)
   - 3.7 [Ventilator 5V — prin tranzistor/releu](#37-ventilator-5v--prin-tranzistorreleu)
4. [ESP32-CAM AI-Thinker — Nodul cameră (exterior/curte)](#4-esp32-cam-ai-thinker--nodul-cameră-exteriorcurte)
   - 4.1 [Programare firmware (mod flash)](#41-programare-firmware-mod-flash)
   - 4.2 [Funcționare normală](#42-funcționare-normală)
5. [Schema de alimentare completă](#5-schema-de-alimentare-completă)
6. [Tabel complet conexiuni — Nodul interior](#6-tabel-complet-conexiuni--nodul-interior)
7. [Tabel pini ESP32-CAM](#7-tabel-pini-esp32-cam)
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
| 1 | ESP32 WROOM-32 DevKitC (30 pini) | 1 | Nod interior (senzori + actuatori) |
| 2 | ESP32-CAM AI-Thinker | 1 | Nod cameră MJPEG (exterior/curte) + PIR |
| 3 | DHT11 | 2 | Temperatură + umiditate (living și dormitor) |
| 4 | MQ-2 | 1 | Gaz / fum / vapori |
| 5 | LDR (fotorezistor) | 2 | Senzori lumină ambientală |
| 6 | Buzzer activ 5V | 1 | Alertă sonoră locală |
| 7 | Servomotor SG90 | 1 | Control perdele |
| 8 | LED 5mm (roșu/verde/albastru) | 3 | Indicatori vizuali controlabili |
| 9 | Ventilator 5V (mini) | 1 | Ventilație comandată prin releu/tranzistor |
| 10 | Tranzistor NPN (2N2222 sau BC337) | 1 | Driver ventilator (GPIO33 nu poate 5V direct) |
| 11 | Rezistență 10 kΩ | 4 | Pull-up DHT11 (x2) + divizor LDR (x2) |
| 12 | Rezistență 220 Ω | 3 | Limitare curent LED |
| 13 | Rezistență 1 kΩ | 1 | Bază tranzistor ventilator |
| 14 | PIR HC-SR501 | 1 | Detecție mișcare exterior (montat pe ESP32-CAM) |
| 15 | Breadboard 830 puncte | 2 | Prototipare |
| 16 | Fire dupont M-M, M-F, F-F | ~60 | Conexiuni |
| 17 | Adaptor FTDI (USB-Serial, 3.3V/5V) | 1 | Programare ESP32-CAM |
| 18 | Sursă 5V / 2A | 2 | Alimentare noduri |
| 19 | Cablu micro-USB / USB-C | 1 | Alimentare + programare ESP32 WROOM |

---

## 2. Alimentarea sistemului

### Principiu esențial

```
[USB 5V / 2A]
      │
      ├─── ESP32 VIN (pin 5V) ──→ ESP32 furnizează 3.3V intern
      │
      ├─── Linia 5V pe breadboard ──→ MQ-2, Ventilator (prin tranzistor)
      │
      ├─── Servo VCC (DIRECT din 5V extern, NU prin ESP32!)
      │
      └─── ESP32 3.3V OUT ──→ DHT11 x2, LDR x2 (divizor)
```

> **ATENTIE CRITICA**: Servomotorul SG90 consumă până la 500 mA la rotire.
> Dacă îl conectezi la 3.3V sau 5V al ESP32, microcontrolerul se poate reseta.
> **Alimentează servo DIRECT din sursa 5V externă** (aceeași sursă, GND comun cu ESP32).

> **Ventilatorul 5V NU se conectează direct la GPIO33** — GPIOul ESP32 furnizează
> maxim 12 mA. Folosește un tranzistor NPN (ex. 2N2222): baza la GPIO33 printr-o
> rezistență de 1 kΩ, colectorul la ventilatorul de 5V, emitorul la GND.
> Alternativ, folosește un modul releu.

### Rail-uri breadboard recomandate

| Rail | Tensiune | Conectat la |
|------|----------|-------------|
| Roșu (+) sus | 5V | VIN ESP32, MQ-2, Ventilator, Servo |
| Albastru (-) sus | GND | GND ESP32, GND toate componentele |
| Roșu (+) jos | 3.3V | DHT11 x2 VCC, LDR x2 (un capăt al divizorului) |
| Albastru (-) jos | GND | (idem, GND comun) |

---

## 3. Nodul interior — ESP32 WROOM-32

> Un singur ESP32 WROOM-32 acoperă întreg interiorul casei.
> PIR-ul NU mai este pe acest nod — rămâne EXCLUSIV pe ESP32-CAM (GPIO13).
> BH1750 (I2C) a fost eliminat — lumina se măsoară prin LDR pe ADC1.

### 3.1 DHT11 #1 și #2 — temperatură și umiditate

**Pinout DHT11 (față spre tine, 3 pini utili din 4):**
```
[1: VCC] [2: DATA] [3: N/C] [4: GND]
```

**DHT11 #1 — living (GPIO4):**

| Pin DHT11 | Culoare fir | Pin ESP32 | Observație |
|-----------|-------------|-----------|------------|
| 1 — VCC | Roșu | 3.3V | NU 5V! |
| 2 — DATA | Galben | **GPIO4** | + rezistenta pull-up 10 kΩ la 3.3V |
| 4 — GND | Negru | GND | |

**DHT11 #2 — dormitor (GPIO23):**

| Pin DHT11 | Culoare fir | Pin ESP32 | Observație |
|-----------|-------------|-----------|------------|
| 1 — VCC | Roșu | 3.3V | |
| 2 — DATA | Galben | **GPIO23** | + rezistenta pull-up 10 kΩ la 3.3V |
| 4 — GND | Negru | GND | |

**Rezistenta pull-up pentru fiecare DHT11:**
```
3.3V ──┤10 kΩ├── GPIO4  ──── DHT11 #1 pin DATA
3.3V ──┤10 kΩ├── GPIO23 ──── DHT11 #2 pin DATA
```
Fără pull-up, citirile sunt instabile sau returnează NaN.

---

### 3.2 MQ-2 — senzor gaz/fum

> MQ-2 are nevoie de **preîncălzire 30–60 secunde** după alimentare pentru citiri stabile.
> Se folosește DOAR iesirea analogica A0 (GPIO34). Ieșirea D0 nu este conectată.

| Pin MQ-2 | Culoare fir | Pin ESP32 | Observație |
|----------|-------------|-----------|------------|
| VCC | Roșu | **5V** | Necesita 5V (heater intern) |
| GND | Negru | GND | |
| A0 (analog) | Verde | **GPIO34** | ADC1, input-only, 0–1023 |
| D0 | — | — | Neconectat |

> GPIO34 este **input-only** pe ESP32 — nu poate fi configurat ca OUTPUT.
> Face parte din ADC1 care funcționează corect cu WiFi activ (spre deosebire de ADC2).

---

### 3.3 LDR #1 și #2 — senzori lumină

> LDR (fotorezistenta) se conecteaza ca **divizor de tensiune** cu o rezistenta fixa de 10 kΩ.
> Valoarea ADC creste când lumina creste (LDR scade rezistenta).
> Ambii pini sunt ADC1 — funcționează corect cu WiFi activ.

**Schema divizor de tensiune pentru fiecare LDR:**
```
3.3V
  │
 LDR (variabil, ex. 1–100 kΩ)
  │
  ├────→ GPIO35 sau GPIO36  (pin ADC — citire 0–1023)
  │
 10 kΩ (rezistenta fixa)
  │
 GND
```

**LDR #1 — GPIO35:**

| Componentă | Conectat la |
|-----------|-------------|
| Un capăt LDR | 3.3V |
| Alt capăt LDR + rezistenta 10 kΩ (sus) | **GPIO35** (ADC1, input-only) |
| Alt capăt rezistenta 10 kΩ (jos) | GND |

**LDR #2 — GPIO36 (VP):**

| Componentă | Conectat la |
|-----------|-------------|
| Un capăt LDR | 3.3V |
| Alt capăt LDR + rezistenta 10 kΩ (sus) | **GPIO36** (ADC1 VP, input-only) |
| Alt capăt rezistenta 10 kΩ (jos) | GND |

> GPIO35 și GPIO36 sunt **input-only** pe ESP32 — nu pot fi configurate ca OUTPUT.

---

### 3.4 Buzzer activ

> Buzzer **activ** = are oscilator intern, scoate sunet la simpla aplicare de tensiune (HIGH pe GPIO).

| Pin Buzzer | Culoare fir | Pin ESP32 | Observație |
|------------|-------------|-----------|------------|
| + (VCC) | Roșu | **GPIO5** | Controlat direct din GPIO |
| − (GND) | Negru | GND | |

---

### 3.5 Servomotor SG90 — control perdele

> SG90 are 3 fire: roșu (VCC), negru/maro (GND), galben/portocaliu (PWM semnal).

| Fir servo | Culoare | Conectat la | Observație |
|-----------|---------|-------------|------------|
| VCC | Roșu | **5V extern** | NU la pinul 3.3V sau 5V al ESP32! |
| GND | Negru/Maro | GND (comun cu ESP32) | |
| PWM | Galben/Portocaliu | **GPIO18** | Semnal PWM 50 Hz |

**Parametri PWM pentru SG90:**
| Unghi | Latime puls | Pozitie perdea |
|-------|-------------|----------------|
| 0° | 0.5 ms | Deschis complet |
| 90° | 1.5 ms | Jumatate |
| 180° | 2.5 ms | Inchis complet |

**Alimentare separata — detaliu breadboard:**
```
[Sursa 5V externa]
    │
    ├── (+) → Rail 5V breadboard → Servo fir rosu
    └── (−) → Rail GND breadboard → Servo fir negru/maro
                                  → GND ESP32 (GND comun!)
```

---

### 3.6 LED-uri #1, #2, #3

> Fiecare LED necesita o rezistenta serie de 220 Ω pentru limitarea curentului.
> La HIGH pe GPIO → LED aprins; la LOW → LED stins.

| LED | Pin ESP32 | Rezistenta serie | Observatie |
|-----|-----------|-----------------|------------|
| LED #0 | **GPIO25** | 220 Ω spre GND | |
| LED #1 | **GPIO26** | 220 Ω spre GND | |
| LED #2 | **GPIO27** | 220 Ω spre GND | |

**Schema pentru un LED:**
```
GPIO25 ──┤220 Ω├── Anod (+) LED ── Catod (−) LED ── GND
```

---

### 3.7 Ventilator 5V — prin tranzistor/releu

> **GPIO33 NU poate alimenta direct un ventilator de 5V.**
> Un GPIO ESP32 furnizează maxim 12 mA la 3.3V — insuficient pentru un motor.
> Foloseste un tranzistor NPN ca switch sau un modul releu.

**Varianta 1 — Tranzistor NPN (2N2222 sau BC337):**

```
ESP32 GPIO33 ──┤1 kΩ├── Baza (B) tranzistor
                         Colector (C) tranzistor ── (+) Ventilator 5V ── 5V
                         Emitor (E) tranzistor ──── GND
                                                    (−) Ventilator ──── GND
```

| Conexiune | Detaliu |
|-----------|---------|
| GPIO33 → baza tranzistor | Prin rezistenta de 1 kΩ |
| Colector tranzistor → terminal (−) ventilator | Ventilatorul e legat la 5V și colector |
| (+) ventilator → 5V | Din sursa externa |
| Emitor tranzistor → GND | GND comun cu ESP32 |

**Varianta 2 — Modul releu 1 canal:**
Conecteaza IN la GPIO33, VCC la 5V, GND la GND. Ventilatorul se conecteaza pe NO/COM al releului.

> HIGH pe GPIO33 → tranzistor conduce → ventilator pornit.
> LOW pe GPIO33 → tranzistor blocat → ventilator oprit.

---

## 4. ESP32-CAM AI-Thinker — Nodul cameră (exterior/curte)

> ESP32-CAM gazduieste camera MJPEG și PIR-ul de exterior.
> PIR-ul este pe **GPIO13** — singura sursa de detectie miscare din sistem.
> ESP32-CAM **nu are port USB** nativ. Programarea se face prin FTDI USB-Serial.

### 4.1 Programare firmware (mod flash)

> In modul flash, **GPIO0 trebuie conectat la GND** (pull-down hardware).

**Conexiuni FTDI → ESP32-CAM:**

| Pin FTDI | Culoare fir | Pin ESP32-CAM | Observatie |
|----------|-------------|---------------|------------|
| GND | Negru | GND | |
| VCC (5V) | Rosu | 5V | FTDI trebuie setat pe 5V, nu 3.3V! |
| TX | Verde | **U0RXD** (GPIO3) | TX FTDI → RX ESP32 |
| RX | Galben | **U0TXD** (GPIO1) | RX FTDI → TX ESP32 |
| — | Negru scurt | **IO0 → GND** | Punte pentru activare mod flash |

**Pasi programare:**
```
1. Conecteaza FTDI la ESP32-CAM conform tabelului de mai sus
2. Conecteaza IO0 la GND cu un fir scurt (punte pe breadboard)
3. Conecteaza FTDI la calculator prin USB
4. Deschide Arduino IDE:
   - Board: "AI Thinker ESP32-CAM"
   - Port: portul COM/tty al FTDI
   - Upload Speed: 115200
5. Apasa RESET pe ESP32-CAM
6. Click "Upload" in Arduino IDE
7. Asteapta "Done uploading"
8. SCOATE puntea IO0-GND
9. Apasa din nou RESET → ESP32-CAM porneste normal
```

### 4.2 Funcționare normală

**PIR și LED exterior pe ESP32-CAM:**

| Componenta | Pin ESP32-CAM | Observatie |
|-----------|---------------|------------|
| PIR HC-SR501 OUT | **GPIO13** | Singura sursa de miscare din sistem |
| PIR VCC | 5V ESP32-CAM | |
| PIR GND | GND | |
| LED exterior | **GPIO12** | Se aprinde 30s la miscare; GPIO12 trebuie LOW la boot |

> GPIO12 este un strapping pin — la boot trebuie sa fie LOW. Un LED/tranzistor
> tras la GND satisface aceasta conditie in mod natural.

**URL-uri cameră:**
| Functie | URL |
|---------|-----|
| Stream MJPEG live | `http://<IP>/stream` sau `http://smarthome-cam.local/stream` |
| Snapshot JPEG | `http://<IP>/capture` |

---

## 5. Schema de alimentare completă

```
[Sursa 5V / 2A]
      │
      ├─── ESP32 WROOM-32 VIN ──→ ESP32 furnizeaza 3.3V intern
      │         │
      │    ESP32 3.3V OUT ──→ DHT11 #1 VCC, DHT11 #2 VCC,
      │                        LDR #1 (sus divisor), LDR #2 (sus divisor)
      │
      ├─── Rail 5V breadboard ──→ MQ-2 VCC, Tranzistor colector (ventilator)
      │
      ├─── Servo VCC (DIRECT, NU prin ESP32!)
      │
      └─── GND comun (ESP32 GND, MQ-2 GND, Servo GND, Tranzistor emitor,
                      LDR divizor jos, DHT11 GND, LED-uri GND)
```

---

## 6. Tabel complet conexiuni — Nodul interior

> Referinta rapida pentru asamblare. Foloseste-l ca checklist.

| # | Componenta | Pin componenta | Pin ESP32 | Observatie |
|---|-----------|----------------|-----------|------------|
| 1 | DHT11 #1 (living) | VCC | 3.3V | |
| 2 | DHT11 #1 (living) | GND | GND | |
| 3 | DHT11 #1 (living) | DATA | **GPIO4** | + pull-up 10 kΩ la 3.3V |
| 4 | Pull-up 10 kΩ | (intre 3.3V si GPIO4) | — | |
| 5 | DHT11 #2 (dormitor) | VCC | 3.3V | |
| 6 | DHT11 #2 (dormitor) | GND | GND | |
| 7 | DHT11 #2 (dormitor) | DATA | **GPIO23** | + pull-up 10 kΩ la 3.3V |
| 8 | Pull-up 10 kΩ | (intre 3.3V si GPIO23) | — | |
| 9 | MQ-2 | VCC | 5V | |
| 10 | MQ-2 | GND | GND | |
| 11 | MQ-2 | A0 | **GPIO34** | ADC1, input-only |
| 12 | LDR #1 | Un capăt | 3.3V | Divizor de tensiune |
| 13 | LDR #1 | Alt capăt + R 10 kΩ (sus) | **GPIO35** | ADC1, input-only |
| 14 | R 10 kΩ LDR #1 (jos) | — | GND | |
| 15 | LDR #2 | Un capăt | 3.3V | Divizor de tensiune |
| 16 | LDR #2 | Alt capăt + R 10 kΩ (sus) | **GPIO36** | ADC1 VP, input-only |
| 17 | R 10 kΩ LDR #2 (jos) | — | GND | |
| 18 | Buzzer activ | + | **GPIO5** | |
| 19 | Buzzer activ | − | GND | |
| 20 | Servo SG90 | VCC (rosu) | 5V EXTERN | NU pinul ESP32! |
| 21 | Servo SG90 | GND (negru/maro) | GND | GND comun |
| 22 | Servo SG90 | PWM (galben) | **GPIO18** | PWM 50 Hz |
| 23 | LED #0 + R 220 Ω | Anod | **GPIO25** | Rezistenta spre GND |
| 24 | LED #1 + R 220 Ω | Anod | **GPIO26** | Rezistenta spre GND |
| 25 | LED #2 + R 220 Ω | Anod | **GPIO27** | Rezistenta spre GND |
| 26 | Tranzistor NPN baza | Via R 1 kΩ | **GPIO33** | Driver ventilator |
| 27 | Tranzistor NPN colector | — | (−) Ventilator 5V | |
| 28 | (+) Ventilator | — | 5V extern | |
| 29 | Tranzistor NPN emitor | — | GND | |

---

## 7. Tabel pini ESP32-CAM

> Referinta pentru nodul de camera. PIR-ul este singura sursa de miscare din sistem.

| GPIO | Utilizare | Directie | Observatie |
|------|-----------|----------|------------|
| GPIO13 | PIR HC-SR501 OUT | INPUT | Singura sursa de detectie miscare |
| GPIO12 | LED exterior (proiector) | OUTPUT | Trebuie LOW la boot (strapping pin) |
| GPIO0 | Mod flash | — | NU folosi in runtime! |
| GPIO1 | UART TX | — | Serial debug |
| GPIO3 | UART RX | — | Serial debug |
| GPIO32 | Camera PWDN | — | Gestionat de driver camera |
| GPIO26 | Camera SIOD | — | Gestionat de driver camera |
| GPIO27 | Camera SIOC | — | Gestionat de driver camera |
| GPIO25 | Camera VSYNC | — | Gestionat de driver camera |
| GPIO23 | Camera HREF | — | Gestionat de driver camera |
| GPIO22 | Camera PCLK | — | Gestionat de driver camera |
| GPIO5,18,19,21 | Camera date | — | Gestionat de driver camera |
| GPIO34,35,36,39 | Camera date | — | Gestionat de driver camera |

---

## 8. Note practice și troubleshooting

### DHT11 returnează NaN
- Verifica rezistenta pull-up de 10 kΩ intre DATA si 3.3V.
- Verifica ca VCC este 3.3V, nu 5V.
- Firmware-ul publicăi payload chiar dacă un singur DHT functioneaza (câmpurile celui defect sunt omise).

### MQ-2 da valori mari în aer curat
- Normal la primele 30–60 secunde (preîncalzire heater intern).
- Dacă valorile raman mari dupa 1 minut, verifica alimentarea la 5V.
- Nu monta MQ-2 langa surse electromagnetice (relee, motoare).

### LDR da valori neasteptate
- Verifica schema divizorului: LDR intre 3.3V si pinul ADC, rezistenta 10 kΩ intre pinul ADC si GND.
- Valoarea creste cu lumina (LDR scade rezistenta, tensiunea pe R fix creste).
- GPIO35 si GPIO36 sunt input-only — nu seta pinMode OUTPUT pe ele.

### Ventilatorul nu porneste
- Verifica tranzistorul: emitor la GND, colector la terminalul (−) al ventilatorului.
- Verifica rezistenta de baza de 1 kΩ intre GPIO33 si baza tranzistorului.
- (+) ventilatorul trebuie conectat la 5V extern, nu la ESP32.
- Testeaza cu `digitalWrite(33, HIGH)` din Serial Monitor sau comanda MQTT `fan_on`.

### ESP32 se reseteaza cand servo se misca
- Servo nu este alimentat extern — muta VCC servo direct la sursa 5V.
- Verifica ca GND servo si GND ESP32 sunt la acelasi punct.

### ESP32-CAM nu apare in retea
- Verifica credentialele WiFi in firmware (SSID si parola).
- ESP32-CAM suporta doar WiFi 2.4 GHz, nu 5 GHz.
- Antena PCB integrata are raza scurta — plaseaza modulul aproape de router.

### PIR da false pozitive
- Orienteaza PIR-ul departe de lumina directa a soarelui.
- Mareste timpul de trigger (potentiometrul Tx de pe HC-SR501).
- La boot, PIR-ul are nevoie de ~30s calibrare — ignora alerte in primele 30s.

---

## Rezumat pinout ESP32 WROOM-32 — Nodul interior (quick reference)

```
Senzori:
  GPIO4  → DHT11 #1 DATA (living)    GPIO23 → DHT11 #2 DATA (dormitor)
  GPIO34 → MQ-2 A0 (ADC1, input)     GPIO35 → LDR #1 (ADC1, input)
  GPIO36 → LDR #2 (ADC1 VP, input)

Actuatori:
  GPIO5  → Buzzer                     GPIO18 → Servo SG90 PWM
  GPIO25 → LED #0                     GPIO26 → LED #1
  GPIO27 → LED #2                     GPIO33 → Ventilator (via tranzistor)
```

## Rezumat pinout ESP32-CAM — Nodul camera (quick reference)

```
  GPIO13 → PIR HC-SR501 OUT (miscare)
  GPIO12 → LED exterior (proiector 30s)
  [restul pinilor ocupati de camera OV2640]
```

---

*Ghid creat pentru proiectul de licenta Smart Home Local-First — Universitatea Politehnica Timisoara, 2026.*

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

### 9.4 Instalare și configurare PostgreSQL

> ℹ️ **Notă:** TimescaleDB nu are pachete ARM64 compatibile cu Raspberry Pi OS Bookworm.
> Folosim **PostgreSQL standard** — codul NestJS funcționează identic, fără nicio modificare.

```bash
# Dacă ai încercat deja să instalezi TimescaleDB și ai erori, curăță mai întâi:
sudo rm -f /etc/apt/sources.list.d/timescaledb.list
sudo rm -f /etc/apt/trusted.gpg.d/timescaledb.gpg
sudo apt update

# Instalare PostgreSQL
sudo apt install -y postgresql postgresql-client

# Pornire și activare automată la boot
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Verificare
sudo systemctl status postgresql   # trebuie să afișeze: Active: active (running)
```

**Creare bază de date și utilizator:**

```bash
# Intră în PostgreSQL ca admin
sudo -u postgres psql

# În consola PostgreSQL (copiază toate liniile de jos, una câte una):
CREATE USER smarthome WITH PASSWORD 'smarthome_pass_2026';
CREATE DATABASE smarthome_db OWNER smarthome;
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

Tools → **Manage Libraries** → cauta si instaleaza fiecare:

| Librarie | Autor | Rol |
|----------|-------|-----|
| `DHT sensor library` | Adafruit | Citire DHT11 (x2) |
| `Adafruit Unified Sensor` | Adafruit | Dependinta DHT |
| `ESP32Servo` | Kevin Harrington | Control servo SG90 |
| `PubSubClient` | Nick O'Leary | Client MQTT |
| `ArduinoJson` | Benoit Blanchon | Serializare JSON (versiunea 6+) |

> **BH1750 NU mai este necesara** — a fost inlocuita cu LDR pe ADC1.
> Nu folosi libraria `Servo.h` standard — nu e compatibila cu ESP32. Foloseste **ESP32Servo**.

### 10.3 Configurare și upload firmware senzori

**Selectare placă:**
- Tools → **Board → ESP32 Arduino → `ESP32 Dev Module`**
- Tools → **Port** → selectează portul COM/tty al ESP32
  - Windows: `COM3`, `COM4` etc. (verifică în Device Manager)
  - Mac: `/dev/cu.usbserial-...` sau `/dev/cu.SLAB_USBtoUART`

**Firmware complet:** foloseste fisierul `firmware/esp32_node/esp32_node.ino` din repo.
Acesta contine logica completa cu WiFi provisioning, NVS, mDNS, Last Will MQTT si toate comenzile.

**Upload:**
1. Deschide `firmware/esp32_node/esp32_node.ino` in Arduino IDE
2. Verifica sectiunea CONFIG NOD din fisier (NODE_ID, credentiale implicite)
3. Conecteaza ESP32 WROOM-32 la calculator prin micro-USB
4. Selecteaza Board: `ESP32 Dev Module`, Port: portul tau
5. Apasa **Upload** in Arduino IDE
6. Deschide **Serial Monitor** (baud 115200)
7. Ar trebui sa vezi:
```
[Boot] Smart Home — esp32_node_a (interior)
[Config] WiFi: SmartHome-Setup | MQTT: 192.168.4.1
[WiFi] Conectare la SmartHome-Setup...
[WiFi] Conectat! IP: 192.168.4.XX
[MQTT] Conectare... OK
[Boot] Gata!
[Senzori] DHT1=22.5°C/55%  DHT2=21.8°C/58%  Gaz=145  LDR1=410  LDR2=120
```

Dupa primul boot cu WiFi-ul de setup, trimite comanda MQTT `wifi_update` cu noile credentiale
sau seteaza direct in firmware valorile DEFAULT_WIFI_SSID / DEFAULT_MQTT_HOST.

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

## Rezumat pinout ESP32 WROOM-32 — Nodul interior (quick reference)

```
Senzori:
  GPIO4  → DHT11 #1 DATA (living)    GPIO23 → DHT11 #2 DATA (dormitor)
  GPIO34 → MQ-2 A0 (ADC1, input)     GPIO35 → LDR #1 (ADC1, input)
  GPIO36 → LDR #2 (ADC1 VP, input)

Actuatori:
  GPIO5  → Buzzer                     GPIO18 → Servo SG90 PWM
  GPIO25 → LED #0                     GPIO26 → LED #1
  GPIO27 → LED #2                     GPIO33 → Ventilator (via tranzistor)
```

---

*Ghid creat pentru proiectul de licenta Smart Home Local-First — Universitatea Politehnica Timisoara, 2026.*
