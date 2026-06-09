# CAPITOLUL 1 — Introducere

**Autor:** Chiril Gorbenco  
**Facultatea:** Ingineria Sistemelor, Universitatea Politehnica Timișoara  
**An universitar:** 2025–2026  
**Titlul lucrării:** Sistem Smart Home Local-First cu Detecție de Anomalii Comportamentale bazată pe Procesare Edge

---

## 1.1 Contextul și Motivația Proiectului

Internetul Lucrurilor (IoT — *Internet of Things*) reprezintă una dintre cele mai semnificative transformări tehnologice ale ultimului deceniu. Conform rapoartelor Statista și IoT Analytics, numărul dispozitivelor IoT conectate la nivel global a depășit pragul de 15 miliarde în anul 2024, cu o prognoză de creștere spre 30 de miliarde până în 2030. În cadrul acestui ecosistem în expansiune rapidă, segmentul casei inteligente (*smart home*) ocupă o poziție de prim rang, atât din perspectiva adoptării consumatorilor, cât și din cea a volumului de investiții al marilor corporații tehnologice.

Piața globală a sistemelor smart home a fost evaluată la aproximativ 110 miliarde de dolari în 2024 și se estimează că va atinge 240 de miliarde de dolari până în 2030, cu o rată de creștere anuală compusă (CAGR) de aproximativ 13,5%. Această creștere este impulsionată de accesibilizarea dispozitivelor senzoriale, reducerea costurilor microcontrolerelor și creșterea penetrării rețelelor Wi-Fi în gospodăriile moderne. Soluțiile comerciale dominante — precum Google Home, Amazon Alexa și ecosistemul Tuya — au democratizat accesul la automatizarea casei, oferind interfețe intuitive și o gamă largă de dispozitive compatibile.

Cu toate acestea, analiza critică a acestor soluții comerciale relevă o serie de limitări structurale care ridică întrebări fundamentale legate de confidențialitate, fiabilitate și autonomie tehnologică. Marea majoritate a ecosistemelor smart home comerciale sunt construite în jurul unui model arhitectural *cloud-centric*, în care datele colectate de senzorii din locuință sunt transmise și stocate pe servere externe, gestionate de companii terțe. Astfel, un senzor de temperatură amplasat în dormitorul utilizatorului transmite permanent date către infrastructura cloud a producătorului, iar un dispozitiv PIR (Passive Infrared) pentru detectarea mișcării furnizează implicit informații detaliate despre comportamentul și prezența persoanelor în locuință.

Problemele asociate acestui model sunt multiple și de natură diversă. În primul rând, există o dependență critică de disponibilitatea internetului și a serviciilor cloud ale furnizorului. Numeroase cazuri documentate demonstrează că sistemele smart home bazate pe cloud devin complet nefuncționale în momentul în care furnizorul decide să întrerupă suportul pentru produse mai vechi sau când serverele de backend sunt temporar indisponibile. Cazul emblematic al platformei Wink, care a trecut brusc la un model prin abonament în 2020 lăsând utilizatorii fără acces la propriile dispozitive, sau decizia Google de a discontinua suportul pentru Nest Secure, ilustrează fragilitatea acestor dependențe. În al doilea rând, modelul cloud-centric implică transmiterea continuă a datelor personale sensibile — rutine comportamentale, orare de activitate, prezența sau absența persoanelor în locuință — către servere externe, creând profile detaliate ale utilizatorilor cu implicații profunde pentru confidențialitate. Regulamentul General privind Protecția Datelor (GDPR) din Uniunea Europeană a adresat parțial aceste preocupări, însă mecanismele de aplicare rămân limitate în fața unor companii cu infrastructuri globale complexe. În al treilea rând, costurile totale ale soluțiilor comerciale — incluzând abonamentele lunare pentru funcționalitățile avansate, costul dispozitivelor proprietare și riscul de blocaj la un singur furnizor (*vendor lock-in*) — depășesc semnificativ costul echivalent al unei soluții construite pe hardware deschis.

În acest context, se identifică o oportunitate clară pentru proiectarea și implementarea unui sistem smart home alternativ, fundamentat pe principii arhitecturale diferite: localitate completă a datelor, procesare inteligentă la marginea rețelei (*edge computing*) și independență față de orice infrastructură cloud. Progresele recente în domeniul microcontrolerelor de putere redusă — în special familia ESP32 de la Espressif Systems — și disponibilitatea unor platforme de calcul la nivel de placă unică, precum Raspberry Pi, fac posibilă implementarea unui sistem complet funcțional la un cost de hardware semnificativ mai mic decât cel al soluțiilor comerciale echivalente. Adăugarea capabilităților de inteligență artificială, prin algoritmi de machine learning rulați local pe gateway, transformă sistemul dintr-un simplu colector de date într-un sistem inteligent, capabil să identifice anomalii comportamentale fără a expune datele utilizatorului la riscuri externe.

Prezenta lucrare de licență își propune să demonstreze viabilitatea tehnică și practică a unui astfel de sistem, aducând o contribuție concretă în domeniul IoT local-first și al procesării edge inteligente.

---

## 1.2 Obiectivele Lucrării

Pornind de la analiza contextului și a problemelor identificate în secțiunea anterioară, prezenta lucrare urmărește realizarea unui set coerent de obiective, structurate pe mai multe planuri ale proiectării și implementării sistemului.

**Primul obiectiv major** constă în proiectarea și implementarea unui sistem smart home complet funcțional, bazat exclusiv pe infrastructură locală, fără nicio dependență de servicii externe sau conectivitate la internet pentru funcționarea de bază. Sistemul trebuie să asigure monitorizarea în timp real a parametrilor de mediu (temperatură, umiditate, concentrație de gaze, nivelul luminii, detectarea mișcării), controlul actuatoarelor (releu de putere, motor servo, buzzer de alertă) și gestionarea unui nod de supraveghere video, toate acestea operând exclusiv în cadrul rețelei locale a utilizatorului.

**Al doilea obiectiv** vizează integrarea unui mecanism de detecție a anomaliilor comportamentale bazat pe tehnici de machine learning, rulat în întregime pe dispozitivul gateway (Raspberry Pi 3B+). Spre deosebire de sistemele clasice de alertă bazate pe praguri fixe (*threshold-based*), abordarea propusă utilizează algoritmul Isolation Forest pentru a învăța tiparele normale de comportament ale utilizatorului și pentru a detecta deviațiile semnificative de la aceste tipare. Această capacitate conferă sistemului un grad de inteligență adaptivă, reducând rata de alerte fals-pozitive caracteristice sistemelor bazate pe reguli rigide.

**Al treilea obiectiv** se referă la realizarea unei aplicații mobile moderne, disponibile pe platformele iOS și Android, care să ofere utilizatorului o interfață intuitivă pentru monitorizarea stării sistemului, vizualizarea istoricului datelor, gestionarea alertelor și controlul de la distanță al actuatoarelor. Aplicația trebuie să beneficieze de actualizări în timp real prin intermediul protocoluluiWebSocket, eliminând necesitatea interogării periodice (*polling*) a serverului și asigurând o experiență de utilizare fluidă și reactivă.

**Al patrulea obiectiv** constă în demonstrarea că un sistem IoT de nivel competitiv poate fi construit integral fără dependență de cloud, utilizând exclusiv tehnologii open-source și hardware comercial accesibil. Această demonstrație are valoare atât din perspectiva practică — arătând utilizatorilor că există alternative viabile la ecosistemele comerciale — cât și din perspectiva academică, contribuind la literatura de specialitate în domeniul arhitecturilor IoT locale și al procesării edge.

**Al cincilea obiectiv**, cu caracter pragmatic, stabilește un buget maxim de hardware de 150 EUR pentru întreaga infrastructură fizică a sistemului, incluzând microcontrolerele ESP32, senzorii, actuatorii, cablajul și placa Raspberry Pi. Respectarea acestei constrângeri de cost demonstrează accesibilitatea soluției pentru publicul larg și competitivitatea sa față de ecosistemele comerciale cu costuri lunare recurente.

---

## 1.3 Contribuția Proprie

Lucrarea de față reprezintă o contribuție originală pe mai multe planuri tehnice interconectate, autorul proiectând și implementând toate componentele sistemului de la zero, fără utilizarea de soluții preconstruite sau platforme *no-code*.

**Firmware-ul pentru nodurile ESP32** a fost dezvoltat în MicroPython, oferind o soluție echilibrată între performanță și productivitate pentru gestionarea senzorilor și actuatoarelor. Firmware-ul implementează conectivitatea MQTT cu autentificare și reconectare automată, rutine de citire pentru senzorii DHT22 (temperatură/umiditate), MQ-2 (gaze combustibile), PIR (mișcare) și BH1750 (luminanță), precum și controlul actuatoarelor (releu, servo motor, buzzer). Contribuția constă în integrarea coerentă a acestor componente heterogene într-un firmware unificat, cu gestionare robustă a erorilor și reconectare automată la rețea și broker.

**Backend-ul NestJS** constituie stratul de orchestrare al întregului sistem, expunând un API REST securizat cu autentificare JWT și un gateway WebSocket pentru transmiterea evenimentelor în timp real către aplicația mobilă. Arhitectura modulară a aplicației NestJS — cu module separate pentru autentificare, gestionarea senzorilor, controlul actuatoarelor și alertare — permite extensibilitatea și mentenabilitatea codului. Integrarea cu TimescaleDB prin TypeORM și cu broker-ul MQTT prin biblioteca *mqtt.js* reprezintă o contribuție tehnică semnificativă, realizând bridging-ul între protocoalele de comunicație IoT și interfețele REST/WebSocket moderne.

**Pipeline-ul de detecție a anomaliilor** reprezintă componenta de machine learning a sistemului, implementată în Python pe Raspberry Pi 3B+. Algoritmul Isolation Forest, implementat prin biblioteca *scikit-learn*, este antrenat pe date istorice de comportament ale utilizatorului și rulat periodic pentru a evalua normalitatea citirilor curente ale senzorilor. Contribuția proprie include proiectarea schemei de antrenare incremental, normalizarea datelor multi-dimensionale și integrarea rezultatelor algoritmului cu sistemul de alertare prin MQTT.

**Aplicația mobilă React Native/Expo** oferă o interfață utilizator modernă, cu o temă vizuală caldă bazată pe paleta de culori stone (gri-bej) și amber (chihlimbar), adaptată pentru utilizare nocturnă. Aplicația implementează autentificare JWT cu persistență locală, vizualizare în timp real a datelor senzorilor prin WebSocket, grafice de evoluție temporală și un sistem de notificări pentru alertele detectate de algoritmul ML.

**Infrastructura locală completă** — incluzând broker-ul Mosquitto MQTT configurat cu TLS, baza de date TimescaleDB cu hypertable-uri optimizate pentru serii temporale și configurarea rețelei locale — constituie în ansamblu o soluție integrată care demonstrează fezabilitatea paradigmei local-first pentru aplicații IoT de producție.

---

## 1.4 Structura Lucrării

Lucrarea este organizată în șase capitole principale, fiecare abordând un aspect distinct al proiectului, de la fundamentele teoretice la detaliile de implementare și rezultatele experimentale.

**Capitolul 2 — Arhitectura Sistemului** prezintă viziunea arhitecturală de ansamblu a proiectului, detaliind principiile local-first și privacy-by-design care au ghidat toate deciziile de proiectare. Sunt descrise în detaliu cele cinci straturi ale arhitecturii — de la senzorii fizici până la aplicația mobilă — împreună cu fluxurile de date și justificările pentru alegerea fiecărei tehnologii componente. De asemenea, sunt analizate considerentele de securitate ale sistemului.

**Capitolul 3 — Implementarea Hardware** acoperă în detaliu componentele fizice ale sistemului: microcontrolerele ESP32 WROOM-32 și ESP32-CAM, senzorii utilizați (DHT22, MQ-2, PIR, BH1750) și actuatoarii (releu, servo motor, buzzer). Sunt prezentate schemele de conexiuni, considerentele de alimentare electrică și configurarea rețelei fizice de noduri senzoriale.

**Capitolul 4 — Implementarea Software** descrie în detaliu toate componentele software ale sistemului: firmware-ul MicroPython pentru ESP32, configurarea broker-ului Mosquitto și a bazei de date TimescaleDB pe Raspberry Pi, arhitectura backend-ului NestJS și implementarea aplicației mobile React Native/Expo. Sunt incluse fragmente de cod reprezentative și explicații tehnice detaliate.

**Capitolul 5 — Detecția de Anomalii prin Machine Learning** este dedicat componentei de inteligență artificială a sistemului. Sunt prezentate fundamentele teoretice ale algoritmului Isolation Forest, procesul de colectare și preprocesare a datelor de antrenare, rezultatele antrenării și evaluarea performanțelor algoritmului pe date reale colectate de sistemul implementat.

**Capitolul 6 — Testare și Evaluare** prezintă metodologia de testare aplicată sistemului, rezultatele testelor funcționale și de performanță, analiza consumului de resurse pe Raspberry Pi și o evaluare comparativă față de soluțiile comerciale existente. Sunt discutate limitările sistemului și direcțiile de dezvoltare ulterioară.

---

*Capitolul următor prezintă arhitectura detaliată a sistemului, fundamentând din punct de vedere tehnic deciziile de proiectare enunțate în prezenta introducere.*
