## Capitolul 3 — Implementarea Hardware

### 3.1 Prezentarea generală a hardware-ului

Arhitectura fizică a sistemului smart home descris în această lucrare este organizată pe două niveluri ierarhice distincte: nivelul de percepție și acțiune, reprezentat de nodurile embedded bazate pe microcontrolere ESP32, și nivelul de procesare și orchestrare, asigurat de un calculator monoplacă Raspberry Pi 3B+.

La nivelul de percepție funcționează doi noduri independente. Primul nod — construit pe microcontroler ESP32 WROOM-32 — are rolul de a colecta date de la senzori de mediu și de a controla actuatorii din camera de zi. Al doilea nod — realizat pe modulul ESP32-CAM AI-Thinker — asigură supravegherea vizuală a intrării și holului, furnizând un flux video continuu accesibil din aplicația mobilă.

La nivelul de procesare, Raspberry Pi 3B+ îndeplinește rolul de gateway local și server de aplicații. Acesta găzduiește broker-ul MQTT, serviciul NestJS cu API REST și WebSocket, baza de date PostgreSQL și motorul de detecție a anomaliilor bazat pe Isolation Forest. Toate comunicațiile între noduri și server se desfășoară exclusiv în rețeaua locală Wi-Fi, în conformitate cu principiul local-first enunțat în capitolul anterior.

Prototipul prezentat în această lucrare este realizat pe breadboard, configurație adecvată fazei de cercetare și validare funcțională. O eventuală trecere în producție ar implica proiectarea și fabricarea unui PCB dedicat, aspect care depășește sfera prezentei lucrări.

---

### 3.2 Microcontrolere utilizate

#### 3.2.1 ESP32 WROOM-32 — Nodul de senzori

ESP32 WROOM-32 este un modul de tip System-on-Module (SoM) produs de Espressif Systems, proiectat pentru aplicații IoT care necesită conectivitate wireless și putere de calcul ridicată la un cost redus. Nucleul modulului este cipul ESP32-D0WDQ6, cu arhitectură dual-core Xtensa LX6, frecvență maximă de operare de 240 MHz și memorie flash internă de 4 MB. Memoria SRAM disponibilă este de 520 KB, suficientă pentru stocarea programului firmware și a structurilor de date asociate senzorilor.

Din punct de vedere al conectivității wireless, modulul integrează Wi-Fi 802.11 b/g/n (2,4 GHz) și Bluetooth 4.2 (clasic și BLE), ambele pe o antenă PCB integrată. Pentru această aplicație se utilizează exclusiv interfața Wi-Fi, prin care nodul publică datele de telemetrie către broker-ul MQTT de pe Raspberry Pi.

Perifericele disponibile sunt deosebit de versatile: 30 de pini GPIO configurabili, un convertor analog-digital (ADC) de 12 biți cu 18 canale, interfețe I2C, SPI, UART și capacitate de generare PWM pe aproape orice pin. Tensiunea de operare este de 3,3 V, însă unii pini tolerează semnale de 5 V ca intrare.

Alegerea acestui microcontroler a fost motivată de mai mulți factori. Documentația extensivă și comunitatea vastă de utilizatori reduc semnificativ efortul de depanare. ADC-ul de 12 biți este necesar pentru citirea valorilor analogice de la senzorul MQ-2 de gaz. Interfața I2C este utilizată pentru comunicarea cu senzorul BH1750 de lumină. Capacitatea PWM pe GPIO18 permite controlul precis al servomotorului SG90. Nu în ultimul rând, prețul accesibil al modulului (aproximativ 5–7 EUR) contribuie la menținerea costului total al sistemului la un nivel rezonabil.

#### 3.2.2 ESP32-CAM AI-Thinker — Nodul cameră

Modulul ESP32-CAM AI-Thinker este o soluție integrată care combină un microcontroler ESP32-S cu un modul de cameră OV2640 de 2 megapixeli, destinată aplicațiilor de supraveghere video cu cost redus. Pe lângă procesorul ESP32-S, modulul dispune de o memorie PSRAM (Pseudo-Static RAM) de 4 MB, necesară pentru stocarea temporară a cadrelor video înainte de transmisie, și un slot microSD pentru înregistrare locală opțională.

Senzorul de imagine OV2640 suportă rezoluții de până la UXGA (1600 × 1200 pixeli) și poate transmite fluxuri video compresate în format MJPEG. Pentru aplicația prezentată, rezoluția utilizată în mod curent este VGA (640 × 480), care oferă un echilibru acceptabil între calitatea imaginii și lățimea de bandă consumată în rețeaua locală. Modulul dispune și de un LED flash pe GPIO4, utilizabil pentru iluminarea scenei în condiții de lumină redusă.

O particularitate importantă a acestui modul este absența unui convertor USB-UART integrat pe placă. În consecință, programarea firmware-ului necesită utilizarea unui adaptor extern FTDI (sau similar), procedură detaliată în secțiunea 3.7.

Motivele alegerii ESP32-CAM sunt în principal economice și funcționale: modulul oferă integrare completă cameră + Wi-Fi + microcontroler la un preț de aproximativ 8 EUR, biblioteca de streaming MJPEG este disponibilă nativ în framework-ul Arduino pentru ESP32, iar dimensiunea compactă permite montarea discretă la intrarea locuinței.

---

### 3.3 Senzori utilizați

#### 3.3.1 DHT22 — Temperatură și umiditate

Senzorul DHT22 (cunoscut și sub denumirea AM2302) este un senzor digital de temperatură și umiditate relativă. Domeniul de măsurare a temperaturii este cuprins între −40 °C și +80 °C, cu o precizie de ±0,5 °C, iar umiditatea relativă poate fi citită în intervalul 0–100% cu o precizie de ±2–5%.

Comunicarea cu microcontrolerul se realizează printr-un protocol proprietar one-wire pe un singur pin de date. Linia DATA necesită o rezistență pull-up de 10 kΩ la tensiunea de alimentare (3,3 V) pentru funcționare corectă. Intervalul minim între două citiri succesive este de 2 secunde, limitat de procesul intern de conversie a senzorului. Senzorul este conectat la GPIO4 al ESP32 WROOM-32 și alimentat de la pinul 3,3 V al microcontrolerului.

#### 3.3.2 MQ-2 — Gaz și fum

Senzorul MQ-2 este un detector electrochimic capabil să detecteze o gamă largă de gaze inflamabile și vapori: GLP (gaz lichefiat petrolier), butan, propan, metan, hidrogen, fum și monoxid de carbon (CO). Modulul furnizează atât un semnal analogic (0–3,3 V, corespunzând unui interval ADC de 0–1023 unități) cât și un semnal digital de prag, reglabil prin potențiometrul integrat pe modul.

Senzorul necesită alimentare la 5 V (curentul de consum al elementului sensibil depășind capacitatea regulatorului de 3,3 V al ESP32) și un timp de preîncălzire de aproximativ 20 de secunde după pornire, înainte ca valorile citite să fie stabile și reprezentative. Pragul de alertă utilizat în firmware este de 350 de unități ADC, valoare determinată empiric în condiții normale de ambient. Semnalul analogic este citit de pe GPIO34 (canalul ADC1_CH6), iar semnalul digital de prag de pe GPIO35 — ambii pini configurați exclusiv ca intrări.

#### 3.3.3 HC-SR501 — Mișcare PIR

Senzorul de mișcare HC-SR501 funcționează pe principiul detecției infraroșului pasiv (PIR — Passive InfraRed). Elementul sensibil detectează variațiile de radiație infraroșie termică emise de corpuri umane în mișcare, fără a emite nicio radiație proprie. Raza de detecție este de până la 7 metri, cu un unghi de acoperire de 120°.

Modulul se alimentează la 5 V și furnizează un semnal digital de ieșire de 3,3 V (compatibil direct cu intrările ESP32), activ HIGH pe durata detecției de mișcare. Sensibilitatea detectivă și durata menținerii semnalului HIGH după detecție sunt reglabile prin intermediul a doi potențiometre aflați pe spatele modulului. Senzorul este conectat la GPIO27 al ESP32.

#### 3.3.4 BH1750 — Lumină ambientală

BH1750 este un senzor digital de iluminanță (luminos ambientală) cu rezoluție de 16 biți, capabil să măsoare niveluri de lumină în intervalul 1–65535 lux. Comunicarea cu microcontrolerul se realizează prin interfața I2C, la adresa 0x23 atunci când pinul ADDR este conectat la GND (adresa alternativă 0x5C se obține prin conectarea ADDR la VCC).

Senzorul se alimentează la 3,3 V, ceea ce îl face compatibil direct cu pinii ESP32. Pinii I2C utilizați sunt GPIO21 (SDA) și GPIO22 (SCL), care reprezintă pinii I2C impliciti ai ESP32. Datele de iluminanță sunt utilizate atât pentru logica de automatizare a iluminatului (control releu și servo perdele) cât și ca feature în algoritmul de detecție a anomaliilor comportamentale.

---

### 3.4 Actuatori utilizați

#### 3.4.1 Modulul relay 4 canale

Modulul de releu cu 4 canale este un circuit de comandă care permite controlul sarcinilor electrice de tensiune și curent ridicate (230 VAC, 50 Hz în rețeaua electrică de uz casnic) prin intermediul semnalelor logice de joasă tensiune furnizate de microcontroler. Fiecare canal este izolat optic prin optocuplori, protejând astfel microcontrolerul de eventualele perturbații electrice generate de sarcinile comutate.

Releele sunt de tip activ LOW: starea activată (contact normal-deschis închis) corespunde unui semnal LOW (0 V) pe pinul de intrare. Acest comportament trebuie luat în considerare la inițializarea firmware-ului pentru a evita activarea accidentală a releelor la pornire. Bobina fiecărui releu necesită 5 V și aproximativ 70–80 mA, motiv pentru care modulul este alimentat dintr-o sursă externă și nu direct din pinii GPIO ale ESP32. Capacitatea maximă de comutare este de 10 A la 250 VAC sau 10 A la 30 VDC per canal. Pinii de control sunt GPIO26, GPIO25, GPIO33 și GPIO32.

#### 3.4.2 Buzzer activ

Buzzer-ul activ este un transductor electroacustic cu oscilator intern integrat, care produce un semnal sonor continuu atunci când i se aplică tensiune de alimentare (5 V), fără a necesita un semnal PWM extern. Simplitatea de control — activare/dezactivare prin nivel logic pe GPIO5 — îl face adecvat pentru alerte locale de urgență, în special în scenariile de detecție a gazului sau tentativă de efracție.

#### 3.4.3 Servomotorul SG90 — Control perdele

SG90 este un micro-servomotor cu angrenaje din plastic, utilizat pe scară largă în aplicații robotice și de automatizare la scară mică. Oferă un cuplu de 1,8 kg·cm la 5 V și poate efectua rotații în intervalul 0°–180°. Controlul poziției se realizează prin semnal PWM la frecvența de 50 Hz: lățimea impulsului variază de la 0,5 ms (corespunzând poziției de 0°) la 2,5 ms (corespunzând poziției de 180°).

În cadrul sistemului, servomotorul este utilizat pentru acționarea unui mecanism simplu de deschidere/închidere a perdelelor, cu trei poziții predefinite: 0° (perdele complet închise), 90° (perdele la jumătate) și 180° (perdele complet deschise). Aceasta permite automatizarea iluminatului natural în funcție de nivelul de lumină ambientală măsurat de senzorul BH1750.

Alimentarea servomotorului trebuie realizată obligatoriu dintr-o sursă externă de 5 V, și nu din pinii de alimentare ai ESP32. Un servomotor SG90 poate consuma curenți de vârf de 500–600 mA în condiții de sarcină, valoare ce depășește cu mult capacitatea de furnizare de curent a regulatorului intern al ESP32 (maxim 40 mA per pin GPIO, respectiv câteva sute de mA pe pinul 3V3). Semnalul PWM este generat pe GPIO18, pin cu capacitate PWM nativă.

---

### 3.5 Schema de conexiuni — breadboard

Tabelul următor prezintă complet conexiunile dintre componentele hardware și pinii corespunzători ai ESP32 WROOM-32, împreună cu observațiile relevante pentru asamblare corectă.

| Componentă | Pin componentă | Pin ESP32 WROOM-32 | Obs. |
|---|---|---|---|
| DHT22 | VCC | 3.3V | — |
| DHT22 | GND | GND | — |
| DHT22 | DATA | GPIO4 | + 10 kΩ pull-up la 3,3 V |
| MQ-2 | VCC | 5V (extern) | Nu din ESP32! |
| MQ-2 | GND | GND | — |
| MQ-2 | A0 | GPIO34 | ADC1_CH6 |
| MQ-2 | D0 | GPIO35 | Input-only |
| PIR HC-SR501 | VCC | 5V (extern) | — |
| PIR HC-SR501 | GND | GND | — |
| PIR HC-SR501 | OUT | GPIO27 | — |
| BH1750 | VCC | 3.3V | — |
| BH1750 | GND | GND | — |
| BH1750 | SDA | GPIO21 | I2C default |
| BH1750 | SCL | GPIO22 | I2C default |
| BH1750 | ADDR | GND | Adresă 0x23 |
| Relay 4ch | VCC | 5V (extern) | — |
| Relay 4ch | GND | GND | — |
| Relay 4ch | IN1 | GPIO26 | Active LOW |
| Relay 4ch | IN2 | GPIO25 | Active LOW |
| Relay 4ch | IN3 | GPIO33 | Active LOW |
| Relay 4ch | IN4 | GPIO32 | Active LOW |
| Buzzer | + | GPIO5 | — |
| Buzzer | − | GND | — |
| Servo SG90 | VCC (roșu) | 5V (extern!) | Nu din ESP32! |
| Servo SG90 | GND (maro) | GND | — |
| Servo SG90 | PWM (galben) | GPIO18 | 50 Hz PWM |

*Tabelul 3.1 — Conexiunile componentelor pe nodul ESP32 WROOM-32*

---

### 3.6 Alimentarea sistemului

Diversitatea componentelor și cerințele lor electrice diferite impun o strategie atentă de alimentare. Modulul de releu, senzorul MQ-2, senzorul PIR HC-SR501 și servomotorul SG90 necesită toți tensiunea de 5 V și pot solicita curenți cumulativi de ordinul amperilor în condiții de operare simultană. Aceste valori depășesc capacitatea de furnizare a regulatorului intern al ESP32 sau a unui port USB standard.

Soluția adoptată este utilizarea unei surse externe de 5 V cu curentul de ieșire de 3 A, conectată direct la șinele de alimentare ale breadboard-ului. Microcontrolerul ESP32 WROOM-32 este alimentat fie prin conectorul USB propriu, fie prin pinul VIN (care acceptă 5 V direct), extras din aceeași șină de 5 V a breadboard-ului. Regulatorul LDO integrat pe modulul ESP32 generează apoi tensiunea internă de 3,3 V, disponibilă pe pinul 3V3 și utilizată pentru alimentarea senzorilor DHT22 și BH1750, care au consum redus (sub 5 mA fiecare).

Este esențial ca masa (GND) surselor de 5 V externe și masa ESP32 să fie conectate în comun pe breadboard, altfel referințele de tensiune diferă și semnalele logice devin nesigure.

Principiul fundamental care trebuie respectat este că servo-ul și releele nu trebuie alimentate niciodată direct din pinii GPIO sau de pe pinul 3V3 al ESP32. O astfel de conexiune riscă distrugerea permanentă a microcontrolerului prin supracurent.

---

### 3.7 Nodul cameră ESP32-CAM — programare și configurare

Absența unui convertor USB-UART integrat pe modulul ESP32-CAM impune utilizarea unui programator extern pentru încărcarea firmware-ului. Procedura standard folosește un adaptor FTDI (FT232RL sau similar), care realizează conversia USB-Serial necesară comunicării cu portul UART0 al ESP32.

Conexiunile necesare între adaptorul FTDI și modulul ESP32-CAM sunt următoarele: GND (FTDI) → GND (ESP32-CAM), VCC 5V (FTDI) → 5V (ESP32-CAM), TX (FTDI) → U0RXD — GPIO3 (ESP32-CAM), RX (FTDI) → U0TXD — GPIO1 (ESP32-CAM).

Pentru intrarea în modul de programare (flash mode), pinul GPIO0 al ESP32-CAM trebuie conectat la GND înainte de aplicarea tensiunii de alimentare. Această configurare determină boot-loader-ul să aștepte transferul firmware-ului prin UART în loc să execute codul din flash. După finalizarea încărcării, puntea GPIO0-GND se îndepărtează și se apasă butonul RESET pentru pornirea normală cu noul firmware.

Din punct de vedere funcțional, nodul cameră rulează un server MJPEG pe portul 80. Fluxul video continuu este accesibil la adresa `http://[IP_ESP32_CAM]/stream`, iar capturile individuale (snapshot) la `http://[IP_ESP32_CAM]/capture`. Spre deosebire de nodul de senzori, nodul cameră nu publică date prin MQTT și nu participă la logica de automatizare sau detecție a anomaliilor. El este un nod pasiv, accesat direct din aplicația mobilă atunci când utilizatorul dorește să vizualizeze imaginea live a intrării. Această separare simplificatoare reduce sarcina de procesare a nodului și evită congestia broker-ului MQTT cu date video.

---

### 3.8 Considerații practice pentru breadboard

Asamblarea unui prototip funcțional pe breadboard implică o serie de constrângeri practice care, dacă nu sunt respectate, pot genera defecțiuni intermitente dificil de diagnosticat.

Convenția de culori pentru fire este recomandată a fi respectată în mod consistent pe tot parcursul asamblării: roșu pentru VCC (indiferent de tensiune — 3,3 V sau 5 V), negru pentru GND, iar culorile neutre (galben, albastru, verde, portocaliu) pentru liniile de semnal. Această practică reduce semnificativ riscul inversării accidentale a polarității, mai ales în condițiile unui număr mare de conexiuni pe breadboard.

Senzorul MQ-2 necesită un timp de preîncălzire de aproximativ 20 de secunde după pornire înainte ca rezistența elementului sensibil să se stabilizeze și valorile ADC să fie reprezentative. Firmware-ul ignoră primele citiri după pornire pentru a evita alerte false generate de instabilitatea de start-up a senzorului.

Senzorul DHT22 trebuie poziționat fizic la distanță de componentele care generează căldură locală, în special bobinele releelor active. O releul activat generează un câmp magnetic și disipă căldură care poate influența temperatura măsurată de DHT22, introducând erori sistematice în datele de telemetrie.

Servomotorul SG90 prezintă vibrații mecanice în timpul rotației care pot slăbi conexiunile pe breadboard. Se recomandă fixarea firelor servomotorului cu bandă adezivă sau cleme de fixare suplimentare pentru a preveni întreruperea intermitentă a contactelor.

Modulul ESP32-CAM se încălzește notabil în timpul transmisiei video continue, disipând câțiva wați prin carcasa cipului. Este recomandat să se asigure un spațiu liber în jurul modulului pentru convecție naturală a aerului, evitând acoperirea sau izolarea termică accidentală în timpul testelor de lungă durată.

---

*Capitolul 3 a prezentat totalitatea componentelor hardware ale sistemului, cu specificații tehnice, justificarea alegerii fiecărei componente, schema completă de conexiuni și considerațiile practice relevante pentru asamblarea prototipului. Capitolul următor va descrie implementarea firmware-ului pe nodurile ESP32 și a serviciilor software de pe Raspberry Pi.*
