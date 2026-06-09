# CAPITOLUL 2 — Arhitectura Sistemului

---

## 2.1 Viziunea Arhitecturală

Proiectarea oricărui sistem software complex pornește de la un set de principii fundamentale care ghidează toate deciziile tehnice ulterioare. În cazul sistemului descris în prezenta lucrare, trei principii arhitecturale au constituit pilonii conceptuali ai întregului demers: localitatea datelor (*local-first*), confidențialitatea prin proiectare (*privacy by design*) și inteligența la marginea rețelei (*edge intelligence*). Înțelegerea acestor principii este esențială pentru a aprecia rațiunea din spatele fiecărei decizii tehnologice prezentate în capitolele ulterioare.

### Principiul Local-First

Conceptul de *local-first software*, formalizat în literatura academică de Kleppmann et al. (2019), descrie o paradigmă de proiectare în care datele sunt stocate și procesate în primul rând pe dispozitivele utilizatorului, nu pe servere externe. Aplicat în contextul IoT și al sistemelor smart home, principiul local-first presupune că toate funcționalitățile esențiale ale sistemului — colectarea datelor, stocarea, procesarea și controlul actuatoarelor — trebuie să funcționeze în mod complet și corect în absența oricărei conexiuni la internet.

Din punct de vedere tehnic, implementarea principiului local-first în sistemul de față s-a materializat prin mai multe decizii de proiectare concrete. Broker-ul MQTT Mosquitto rulează pe Raspberry Pi 3B+, eliminând orice intermediar cloud în fluxul de comunicație dintre nodurile senzoriale și backend. Baza de date TimescaleDB este găzduită local, pe același dispozitiv gateway, asigurând că întregul istoric al datelor rămâne sub controlul exclusiv al utilizatorului. Backend-ul NestJS și algoritmul de machine learning rulează de asemenea pe Raspberry Pi, iar aplicația mobilă comunică direct cu adresa IP locală a gateway-ului, fără a tranzita niciun server extern.

Această abordare prezintă avantaje măsurabile față de modelul cloud-centric: latența end-to-end pentru o alertă generată de un senzor până la notificarea pe telefon se reduce la câteva zeci de milisecunde pe rețeaua locală, față de sute de milisecunde sau chiar secunde specifice rutelor prin cloud. Disponibilitatea sistemului devine independentă de furnizori externi sau de calitatea conexiunii la internet, aspect cu implicații practice semnificative în scenarii reale.

### Confidențialitatea prin Proiectare

*Privacy by design* este un principiu formulat de Ann Cavoukian în anii '90 și ulterior adoptat ca cerință explicită de GDPR (Art. 25), care stipulează că protecția datelor personale trebuie integrată în arhitectura sistemelor informatice încă din faza de proiectare, nu adăugată post-factum ca strat separat. Aplicat sistemului smart home, acest principiu are implicații directe și concrete.

Datele colectate de senzorii ambientali — temperaturi, mișcări, niveluri de gaze, imagini video — constituie date personale sensibile, deoarece permit inferirea comportamentului, rutinelor și prezenței persoanelor în locuință. În arhitectura propusă, aceste date nu traversează niciodată rețele publice și nu sunt accesibile unor terțe părți. Toate comunicațiile dintre nodurile ESP32 și gateway sunt protejate prin MQTT over TLS (portul 8883), prevenind interceptarea în cadrul rețelei locale. Autentificarea la nivelul API-ului NestJS se realizează prin token-uri JWT cu durată limitată, împiedicând accesul neautorizat. Aplicația mobilă nu include niciun SDK de analytics, advertising sau telemetrie terță parte.

### Inteligența la Marginea Rețelei față de Inteligența în Cloud

Dihotomia *edge intelligence* versus *cloud intelligence* reprezintă una dintre dezbaterile centrale ale IoT-ului modern. Abordarea tradițională constă în transmiterea datelor brute de la senzori către platforme cloud (AWS IoT, Google Cloud IoT, Azure IoT Hub) unde sunt procesate de modele ML cu resurse computaționale nelimitate. Abordarea *edge* presupune rularea algoritmilor de ML pe dispozitive cu resurse limitate, amplasate aproape de sursa datelor.

Compromisul fundamental constă în faptul că modelele cloud beneficiază de putere de calcul practic nelimitată, permițând utilizarea unor arhitecturi complexe (rețele neuronale profunde, modele de mari dimensiuni), în timp ce modelele edge sunt constrânse de resursele hardware disponibile, dar beneficiază de latență redusă, funcționare offline și confidențialitate. Pentru cazul de utilizare specific al sistemului de față — detecția anomaliilor comportamentale pe date multidimensionale de la 4-5 senzori — algoritmul Isolation Forest reprezintă un compromis optim: are complexitate computațională moderată, adecvată pentru Raspberry Pi 3B+, și oferă performanțe excelente pe probleme de detecție a anomaliilor în date cu distribuție necunoscută, fără a necesita date etichetate pentru antrenare.

---

## 2.2 Arhitectura pe Straturi

Sistemul este structurat pe cinci straturi funcționale distincte, fiecare cu responsabilități bine delimitate și interfețe clar definite față de straturile adiacente. Această organizare verticală respectă principiul separării preocupărilor (*separation of concerns*) și facilitează mentenanța, testarea și evoluția independentă a fiecărei componente.

```
┌─────────────────────────────────────────────┐
│  LAYER 5 — Aplicație Mobilă                 │
│  React Native + Expo (iOS/Android)          │
└──────────────────┬──────────────────────────┘
                   │ HTTP REST / WebSocket
┌──────────────────▼──────────────────────────┐
│  LAYER 4 — Backend API                      │
│  NestJS + TypeORM + Socket.io + JWT         │
└──────────────────┬──────────────────────────┘
                   │ intern (același device)
┌──────────────────▼──────────────────────────┐
│  LAYER 3 — Gateway Raspberry Pi 3B+         │
│  Mosquitto MQTT │ TimescaleDB │ ML Engine   │
└──────────────────┬──────────────────────────┘
                   │ MQTT over TLS (port 8883)
┌──────────────────▼──────────────────────────┐
│  LAYER 2 — Noduri ESP32                     │
│  ESP32 WROOM-32 (senzori + servo)           │
│  ESP32-CAM (supraveghere video)             │
└──────────────────┬──────────────────────────┘
                   │ GPIO / I2C / PWM
┌──────────────────▼──────────────────────────┐
│  LAYER 1 — Senzori & Actuatori              │
│  DHT22 │ MQ-2 │ PIR │ BH1750 │ Servo       │
└─────────────────────────────────────────────┘
```

### Stratul 1 — Senzori și Actuatori

Primul strat al arhitecturii cuprinde totalitatea dispozitivelor fizice de intrare și ieșire conectate la nodurile microcontroler. Din perspectiva senzorilor, sistemul integrează patru tipuri distincte de traductoare, acoperind principalele dimensiuni de monitorizare ale unui mediu rezidențial.

Senzorul DHT22 asigură măsurarea temperaturii în intervalul −40°C...+80°C cu o precizie de ±0,5°C și a umidității relative în intervalul 0%...100% cu o precizie de ±2–5%. Comunicația se realizează prin protocolul 1-Wire proprietar pe un singur pin digital. Senzorul MQ-2 este un detector de gaze combustibile și fum, bazat pe un element de oxid metalic semiconductor (SnO₂) al cărui rezistivitate se modifică în prezența gazelor reducătoare (metan, propan, hidrogen, monoxid de carbon, fum). Semnalul de ieșire este analogic, necesitând conversie analog-digitală prin ADC-ul intern al ESP32. Senzorul PIR (Passive Infrared) HC-SR501 detectează mișcarea prin variațiile de radiație infraroșie generate de deplasarea corpurilor calde în câmpul său de vedere (unghi de 120°, rază de 7 m), furnizând un semnal digital binar. Senzorul BH1750 măsoară luminanța ambientală în intervalul 1–65535 lux prin comunicație I²C, oferind date cantitative pentru automatizarea iluminatului.

Din perspectiva actuatoarelor, sistemul include un releu de putere pentru controlul echipamentelor electrice de curent alternativ (până la 10A/250VAC), un servo motor pentru aplicații de control mecanic (închidere/deschidere ușă, reglare unghiuri), și un buzzer piezoelectric pentru alertare acustică locală.

### Stratul 2 — Noduri ESP32

Al doilea strat este constituit din microcontrolerele ESP32, care joacă rolul de interfețe inteligente între lumea fizică a senzorilor și rețeaua locală. Modulul ESP32 WROOM-32, produs de Espressif Systems, integrează un procesor dual-core Xtensa LX6 la 240 MHz, 4 MB de memorie flash, 520 KB SRAM, conectivitate Wi-Fi 802.11 b/g/n și Bluetooth 4.2/BLE. Aceste specificații tehnice îl poziționează semnificativ deasupra microcontrolerelor clasice de tip Arduino, oferind resurse computaționale suficiente pentru rularea unui stivă de protocoale complete (TCP/IP, TLS, MQTT) și pentru preprocesarea datelor la nivel local.

Firmware-ul rulat pe nodurile ESP32 WROOM-32 este responsabil pentru: inițializarea și calibrarea senzorilor la pornire, citirea periodică a valorilor (la interval configurabil, implicit 30 de secunde), validarea și filtrarea datelor aberante, serializarea valorilor în format JSON și publicarea acestora pe topicurile MQTT corespunzătoare, precum și pentru abonarea la topicurile de comandă și executarea acțiunilor solicitate (activare releu, poziționare servo).

Nodul ESP32-CAM reprezintă o variantă specializată a familiei ESP32, echipată suplimentar cu un modul cameră OV2640 (2 MP, până la 1600×1200 pixeli) și un slot microSD pentru stocarea locală a imaginilor. Acesta operează independent față de nodul senzorial principal, gestionând captarea de imagini la cerere sau la detectarea mișcării, comprimarea JPEG și transmiterea către gateway prin MQTT sau prin streaming MJPEG direct.

### Stratul 3 — Gateway Raspberry Pi 3B+

Raspberry Pi 3B+ constituie nucleul arhitectural al întregului sistem, concentrând patru subsisteme funcționale critice pe un singur dispozitiv cu consum energetic redus (5V/2,5A, aproximativ 5–7W în funcționare normală).

**Broker-ul MQTT Mosquitto** gestionează întreaga comunicație publish-subscribe între nodurile ESP32 și backend-ul NestJS. Mosquitto este un broker open-source de înaltă performanță, implementând standardul MQTT 3.1.1 și 5.0, capabil să gestioneze mii de conexiuni simultane pe hardware modest. Configurarea cu TLS mutual asigură criptarea end-to-end a tuturor mesajelor IoT. Topicurile MQTT sunt organizate ierarhic după schema `home/{room}/{sensor_type}` pentru date și `home/{room}/cmd/{actuator}` pentru comenzi.

**TimescaleDB** este extensia PostgreSQL optimizată pentru date de tip serie temporală, selectată pentru stocarea istoricului complet al citirilor senzorilor. TimescaleDB introduce conceptul de *hypertable* — o tabelă particionată automat pe dimensiunea temporală — care menține performanțe constante de inserare și interogare chiar și pe seturi de date cu milioane de înregistrări. Funcțiile de *continuous aggregation* permit calculul eficient al statisticilor agregate (medii orare, zilnice, săptămânale) fără a reciti datele brute, reducând semnificativ consumul de resurse.

**ML Engine-ul** reprezintă componenta de inteligență artificială a sistemului, implementată ca un serviciu Python care rulează Isolation Forest din biblioteca scikit-learn. Serviciul consumă datele stocate în TimescaleDB pentru antrenare, evaluează periodic normalitatea citirilor curente și publică rezultatele evaluării (scor de anomalie, clasificare normal/anormal) pe topicul MQTT dedicat alertelor, de unde sunt preluate de backend-ul NestJS.

**Rule Engine-ul** este un subsistem de reguli configurabile, implementat în cadrul backend-ului NestJS, care permite definirea de condiții simple (de exemplu, activarea buzzer-ului dacă concentrația de gaze depășește un prag absolut de siguranță, indiferent de contextul ML). Acest motor de reguli coexistă cu ML Engine-ul, adresând scenariile de urgență imediată care nu pot aștepta evaluarea ML.

### Stratul 4 — Backend API NestJS

Backend-ul NestJS reprezintă stratul de orchestrare și abstractizare al sistemului, expunând interfețe standardizate consumabile de aplicația mobilă. Ales pentru arhitectura sa modulară și orientată pe decoratori (similară cu Angular), NestJS organizează funcționalitățile în module independente: modulul de autentificare (JWT, bcrypt pentru hashing parole), modulul de senzori (CRUD pentru configurații și citiri), modulul de actuatori (comenzi și stare), modulul de alerte (stocare, marcare ca citit, filtrare) și gateway-ul WebSocket (Socket.io, broadcast selectiv per client autentificat).

Comunicarea cu broker-ul MQTT se realizează intern, în cadrul aceluiași dispozitiv Raspberry Pi, prin biblioteca `mqtt.js`, eliminând latența de rețea pentru acest flux critic. Comunicarea cu TimescaleDB se realizează prin TypeORM, cu entitități mapate pe structura hypertable-urilor.

### Stratul 5 — Aplicația Mobilă React Native/Expo

Stratul de prezentare al sistemului este reprezentat de o aplicație mobilă cross-platform, dezvoltată cu React Native și Expo, compatibilă cu platformele iOS și Android. Aplicația adoptă o arhitectură bazată pe Redux pentru managementul stării globale și React Navigation pentru navigarea între ecrane. Comunicarea cu backend-ul utilizează axios pentru cererile HTTP REST și Socket.io-client pentru conexiunea WebSocket persistentă, prin care sunt primite actualizările în timp real ale datelor senzorilor și notificările de alertă. Interfața vizuală adoptă o temă întunecată caldă (*warm dark*), construită pe paleta de culori stone și amber, optimizată pentru utilizare în condiții de luminozitate redusă.

---

## 2.3 Fluxul de Date (End-to-End)

Înțelegerea completă a arhitecturii necesită urmărirea datelor prin toate straturile sistemului, atât pe calea de monitorizare (de la senzori la ecranul utilizatorului), cât și pe calea de comandă (de la interfața mobilă la actuatori) și pe calea de alertare (de la detectarea anomaliei la notificarea utilizatorului).

### Fluxul de Monitorizare (Senzori → Mobil)

Ciclul de monitorizare începe cu citirea periodică a valorilor senzorilor de către firmware-ul ESP32, la intervalele configurate. Valorile sunt validate local (eliminarea citirilor ieșite din domeniu sau a erorilor de comunicație), serializate în format JSON și publicate pe topicul MQTT corespunzător (de exemplu, `home/living/temperature`). Broker-ul Mosquitto, rulând pe Raspberry Pi, recepționează mesajul și îl livrează tuturor abonaților activi — în cazul de față, serviciul NestJS. Backend-ul NestJS procesează mesajul MQTT primit prin handlerul dedicat: persistează înregistrarea în TimescaleDB cu timestamp-ul UTC curent, actualizează cache-ul intern cu ultima valoare pentru senzorul respectiv și emite un eveniment WebSocket pe canalul `sensor-update` către toți clienții mobili autentificați și conectați. Aplicația mobilă, menținând o conexiune WebSocket persistentă, recepționează evenimentul și actualizează starea Redux, declanșând re-randarea componentelor UI afectate. Întregul flux se desfășoară, în condiții normale de rețea locală, în mai puțin de 100 de milisecunde de la momentul citirii senzorului.

### Fluxul de Comandă (Mobil → Actuator)

Calea de comandă funcționează în sens invers față de fluxul de monitorizare. Utilizatorul interacționează cu un control din aplicația mobilă (de exemplu, un comutator pentru releul de putere). Aplicația emite o cerere HTTP POST către endpoint-ul REST corespunzător al backend-ului NestJS, cu payload-ul comenzii și token-ul JWT de autentificare în header-ul Authorization. Backend-ul validează token-ul, verifică drepturile utilizatorului, persistă comanda în baza de date și publică un mesaj MQTT pe topicul de comandă al actuatorului (`home/living/cmd/relay`). Nodul ESP32, abonat la acest topic, recepționează comanda și execută acțiunea fizică corespunzătoare (activarea sau dezactivarea releului). Starea actuatorului este publicată înapoi pe un topic de confirmare, închizând bucla de feedback.

### Fluxul de Alertare (Anomalie ML → Notificare)

Calea de alertare este declanșată de ML Engine-ul care rulează periodic pe Raspberry Pi. La fiecare ciclu de evaluare, serviciul Python extrage ultimele citiri ale senzorilor din TimescaleDB și le supune scoringului Isolation Forest. Dacă scorul de anomalie depășește pragul calibrat, ML Engine-ul publică un mesaj MQTT pe topicul `home/alerts/anomaly`, cu detalii despre tipul anomaliei, valorile implicate și scorul de încredere. Backend-ul NestJS, abonat la acest topic, persistează alerta în tabela dedicată din baza de date și emite imediat un eveniment WebSocket de tipul `alert-new` către toți clienții mobili conectați. Aplicația mobilă afișează o notificare locală (prin biblioteca Expo Notifications) și actualizează ecranul de alerte cu noua înregistrare. Dacă este activat, Rule Engine-ul poate suplimentar activa buzzer-ul local prin MQTT, pentru alertare acustică în locuință.

---

## 2.4 Alegerea Tehnologiilor

Fiecare decizie tehnologică din cadrul proiectului a fost fundamentată pe o analiză comparativă a alternativelor disponibile, luând în considerare criteriile specifice ale unui sistem local-first pentru IoT rezidențial.

### NestJS față de alternativele backend

Alternativele evaluate pentru stratul de backend au inclus Flask și Django (Python), Express.js (Node.js minimal) și Spring Boot (Java). NestJS a fost ales din mai multe motive convergente. Arhitectura sa modulară și sistemul de injecție de dependențe reduc semnificativ complexitatea accidentală a proiectului comparativ cu Express.js, unde aceste pattern-uri trebuie implementate manual. Utilizarea TypeScript ca limbaj nativ oferă siguranță de tip (*type safety*) end-to-end, reducând clasa de erori runtime și facilitând refactorizarea. Suportul nativ pentru WebSocket prin decoratori și gateway-uri Socket.io elimină necesitatea configurării manuale a unui server WebSocket separat. Nu în ultimul rând, utilizarea aceluiași limbaj (TypeScript/JavaScript) atât în backend cât și în frontend simplifică partajarea tipurilor și reduce costul cognitiv al comutării între componente. Față de soluțiile Python (Django/Flask), NestJS oferă performanțe superioare la gestionarea conexiunilor WebSocket concurente, aspect critic pentru un sistem cu actualizări frecvente în timp real.

### React Native față de Flutter

Principalele alternative evaluate pentru aplicația mobilă au fost Flutter (Google, Dart) și React Native (Meta, JavaScript/TypeScript). Alegerea React Native/Expo s-a bazat pe: ecosistemul JavaScript extrem de matur și bogat în librării de componentă, alinierea cu backend-ul TypeScript pentru partajarea de tipuri și logică de validare, instrumentul Expo Go care permite iterarea rapidă fără build nativ la fiecare modificare, și compatibilitatea mai bună a bibliotecilor de grafice (Victory Native, react-native-chart-kit) cu cerințele de vizualizare ale proiectului. Flutter ar fi oferit performanțe de randare superior prin compilarea nativă, însă costul înățării limbajului Dart și ecosistemul mai puțin matur pentru librăriile IoT-specifice au constituit dezavantaje decisive pentru contextul acestui proiect.

### MQTT față de HTTP polling

Alegerea MQTT ca protocol de comunicație IoT a fost facilă față de alternativa HTTP polling. Modelul publish-subscribe al MQTT este natural adaptat pentru scenariile IoT unde mulți producători de date (noduri senzoriale) comunică asincron cu mulți consumatori (backend, aplicații de monitorizare). Latența MQTT este semnificativ mai mică față de HTTP polling, deoarece mesajele sunt livrate imediat la publicare, fără să fie necesară o interogare periodică. Consumul de bandă și de energie este minim, dat fiind că headerele MQTT sunt de ordinul a zeci de bytes. Nivelurile de QoS (Quality of Service) oferite de protocol — QoS 0 (cel mult o dată), QoS 1 (cel puțin o dată), QoS 2 (exact o dată) — permit calibrarea compromisului între fiabilitate și overhead în funcție de tipul datelor. HTTP/2 Server-Sent Events sau WebSocket ar fi constituit alternative viabile pentru unele fluxuri de date, dar MQTT rămâne standardul de facto al industriei IoT pentru comunicația dispozitiv-la-gateway, beneficiind de suport nativ în toate platformele de microcontrolere moderne.

### TimescaleDB față de PostgreSQL simplu

TimescaleDB extinde PostgreSQL cu optimizări specifice datelor de tip serie temporală fără a sacrifica compatibilitatea cu ecosistemul SQL standard. Față de un PostgreSQL simplu, TimescaleDB oferă: partiționarea automată a datelor pe dimensiunea temporală prin hypertable-uri, cu menținerea performanțelor de inserare și interogare la scară; funcții de agregate continue (*continuous aggregations*) care calculează și mențin automat statistici pre-agregate pentru interogări rapide pe intervale de timp; politici de compresie automată a datelor istorice cu rapoarte de compresie de 10–20x față de tabelele necomprimate; și funcții analitice specializate pentru date temporale (interpolare, gap-fill, time_bucket). Față de soluții dedicate de time-series cum ar fi InfluxDB sau Prometheus, TimescaleDB oferă avantajul compatibilității complete SQL și al utilizării ecosistemului PostgreSQL (TypeORM, pg, pgAdmin), reducând complexitatea infrastructurii.

### Isolation Forest față de reguli cu praguri fixe

Sistemele clasice de alertare în smart home utilizează reguli cu praguri fixe: dacă temperatura depășește 35°C, generează alertă; dacă concentrația MQ-2 depășește un prag absolut, generează alertă. Această abordare este simplă și transparentă, dar prezintă limitări fundamentale: pragurile optime variază între locuințe, anotimpuri și obiceiuri ale utilizatorului; nu captează corelațiile dintre multiple dimensiuni (de exemplu, o temperatură de 30°C este normală în august dar anormală în ianuarie, sau normale în combinație cu lumina aprinsă dar anormale la miezul nopții fără activitate PIR); și tind să genereze rate ridicate de fals-pozitive sau fals-negative dacă sunt calibrate incorect.

Algoritmul Isolation Forest, propus de Liu et al. (2008), abordează diferit problema detecției anomaliilor: în loc să definească normalul și să identifice devierile de la el, izolează explicit punctele anomale prin partiționarea aleatorie recursivă a spațiului de date. Punctele anomale, fiind rare și diferite de masa datelor normale, sunt izolate cu un număr mai mic de partiționări, obținând un scor de anomalie ridicat. Avantajele pentru cazul de față sunt: algoritmul nu necesită date etichetate pentru antrenare (învățare nesupervizată), are complexitate computațională O(n log n) și consum de memorie O(n), adecvat pentru Raspberry Pi; se adaptează automat la tiparele specifice ale utilizatorului pe măsura acumulării datelor de antrenare; și are performanțe robuste documentate pe probleme de detecție a anomaliilor multidimensionale.

---

## 2.5 Considerații de Securitate

Securitatea unui sistem smart home este o preocupare de prim ordin, dat fiind că dispozitivele controlate (releu de putere, actuatori mecanici) pot influența direct siguranța fizică a locuinței. Deși sistemul propus operează exclusiv pe rețeaua locală — eliminând o categorie întreagă de vectori de atac specifici serviciilor cloud — există totuși amenințări relevante care trebuie adresate prin mecanisme tehnice adecvate.

**Autentificarea și autorizarea** la nivelul API-ului NestJS se realizează prin JSON Web Tokens (JWT) cu o durată de expirare de șapte zile. Token-urile sunt semnate cu un secret configurat ca variabilă de mediu, prevenind falsificarea. Parola utilizatorului este stocată exclusiv sub formă de hash bcrypt (factor de cost 12), astfel încât chiar și în cazul unui acces neautorizat la baza de date, parola în clar nu poate fi recuperată în timp util. Toate endpoint-urile API, cu excepția rutei de login, sunt protejate prin middleware-ul de autentificare JWT.

**Criptarea comunicațiilor MQTT** este asigurată prin TLS (Transport Layer Security) pe portul 8883, protocoluul standard recomandat pentru MQTT securizat. Certificatele TLS sunt generate local și stocate pe Raspberry Pi, iar nodurile ESP32 sunt configurate cu certificatul CA corespunzător. Această măsură previne interceptarea sau modificarea mesajelor MQTT de către un potențial atacator cu acces la rețeaua Wi-Fi locală (scenariul rețelei compromise, relevant în cazul utilizării unui router cu firmware vulnerabil).

**Izolarea rețelei** constituie primul și cel mai important strat de securitate al sistemului. Prin design, backend-ul NestJS expune portul API exclusiv pe interfața de rețea locală (LAN), fără port-forwarding sau expunere directă pe internet. Utilizatorul care dorește acces de la distanță trebuie să configureze explicit o soluție de VPN (recomandat WireGuard), menținând controlul complet al suprafeței de atac. Această decizie de proiectare reflectă principiul *least privilege* și reduce fundamental riscurile asociate expunerii directe pe internet.

**Securitatea fizică** a dispozitivelor, deși în afara sferei software, este menționată ca element important al modelului de amenințare: accesul fizic la Raspberry Pi sau la nodurile ESP32 poate compromite cheia secretă JWT sau certificatele TLS. Amplasarea dispozitivelor în locuri sigure și partiționarea corectă a rețelei locale (separarea IoT de rețeaua principală prin VLAN) sunt măsuri complementare recomandate.

Sistemul nu implementează autentificare la nivelul MQTT (autentificare per-client cu username/parolă), aspect identificat ca limitare actuală și direcție de îmbunătățire pentru versiunile viitoare. De asemenea, posibilitatea accesului de la distanță prin VPN, deși menționată, nu face obiectul implementării prezente, focalizată pe scenariul de utilizare locală.

---

*Arhitectura descrisă în prezentul capitol constituie fundamentul tehnic pe baza căruia sunt construite toate componentele detaliate în capitolele următoare. Capitolul 3 va detalia implementarea hardware a nodurilor senzoriale ESP32, pornind de la specificațiile tehnice ale componentelor utilizate și ajungând la schemele electrice complete ale fiecărui nod.*
