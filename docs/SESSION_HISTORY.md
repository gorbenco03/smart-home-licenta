# Istoric Sesiuni — Smart Home Licenta

> **Repo:** `https://github.com/gorbenco03/smart-home-licenta`
> **Local:** `/Users/kirill/Desktop/Licenta pt fata`
> **Ultima actualizare:** 2026-06-09

---

## Stare curentă a sistemului (tot ce funcționează acum)

| Componentă | Status | Note |
|------------|--------|------|
| PostgreSQL pe RPi | ✅ Rulează | Port 5432, user `smarthome`, db `smarthome_db` |
| Mosquitto MQTT pe RPi | ✅ Rulează | Port 1883, user `smarthome`/`smarthome123` |
| NestJS API pe RPi | ✅ Rulează via PM2 | Port 3000, process name `smart-home-api` |
| ESP32 cu DHT11 | ✅ Flashat | Date reale trimise: 28.5°C, 42% umiditate |
| Mobile app (Expo Go) | ✅ Funcționează | Afișează date reale de la senzor |
| WiFi provisioning | ✅ Implementat | Flux complet RPi hotspot → setup telefon |
| EAS Build (iOS) | 🔄 În progres | SDK 54 curățat, build urmează |

---

## Stack Tehnic Final

```
[ESP32 + DHT11]  ──MQTT──►  [Raspberry Pi 3B+]  ──HTTP/WS──►  [iPhone App]
                              ├── Mosquitto (1883)
                              ├── PostgreSQL (5432)
                              └── NestJS API (3000)
```

### Hardware
- **Raspberry Pi 3B+** — gateway central, IP fix în rețea (192.168.1.64)
- **ESP32 WROOM-32** — nod senzori, DHT11 pe GPIO4
- **iPhone** — aplicație mobilă React Native/Expo

### Software — RPi
- OS: Raspberry Pi OS Lite
- Mosquitto 2.x: `/etc/mosquitto/conf.d/smarthome.conf`
- PostgreSQL 14+
- NestJS via PM2: `pm2 start dist/main.js --name smart-home-api`

### Software — Mobile
- Expo SDK 54 (React 19 + RN 0.81.5)
- React Navigation v6
- TanStack Query v5
- Socket.IO client v4
- Zustand v4

---

## Fișiere importante din repo

### API (`api/`)
```
api/src/
├── app.module.ts               — importă SetupModule
├── mqtt/
│   └── mqtt.service.ts         — topic: smarthome/+/sensors, suportă JSON flat ESP32
├── sensors/
│   └── sensors.module.ts       — JwtModule.registerAsync() (NU register()!)
└── setup/
    ├── setup.controller.ts     — GET /setup/status, /networks; POST /setup/connect, /hotspot
    ├── setup.service.ts        — nmcli cu sudo, autoHotspot() la boot
    └── setup.module.ts         — onModuleInit → autoHotspot()
```

### Mobile (`mobile/src/`)
```
mobile/src/
├── services/config.ts          — API_HOST, API_BASE, WS_HOST, HOTSPOT_API
├── screens/
│   ├── DashboardScreen.tsx     — buton logout (⏻), buton setup WiFi (⊕), refetch 5s
│   └── SetupScreen.tsx         — wizard WiFi provisioning, axios la 192.168.4.1:3000/api
└── navigation/index.tsx        — SetupScreen în Stack.Group
```

### Firmware (`firmware/`)
```
firmware/esp32_dht11/
└── esp32_dht11.ino             — DHT11 + MQTT, Preferences NVS, SmartHome-Setup default
```

### Config files
```
mobile/app.json                 — bundle ID: com.gorbenco.smarthome, ATS exceptions
mobile/eas.json                 — preview profile, macos-sonoma-14.6-xcode-16.1
mobile/.env                     — EXPO_PUBLIC_API_HOST=http://192.168.1.64:3000 (nu e în git)
```

---

## Configurații critice

### Mosquitto (`/etc/mosquitto/conf.d/smarthome.conf`)
```
listener 1883                    # obligatoriu pentru acces din rețea (nu doar localhost)
allow_anonymous false
password_file /etc/mosquitto/passwd

# Permisii fișier passwd:
# sudo chown mosquitto:mosquitto /etc/mosquitto/passwd
# sudo chmod 640 /etc/mosquitto/passwd
```

### PM2 — pornire backend
```bash
cd /home/smarthome/smart-home-licenta/api
pm2 start dist/main.js --name smart-home-api
pm2 save
pm2 startup   # pentru autostart la reboot
```

### Sudoers RPi (`/etc/sudoers.d/smarthome-nmcli`)
```
smarthome ALL=(ALL) NOPASSWD: /usr/bin/nmcli
```

### MQTT Topic ESP32 → RPi
- **Publish:** `smarthome/{nodeId}/sensors`
- **Subscribe backend:** `smarthome/+/sensors`
- **Format JSON:** `{ "nodeId": "esp32_node_a", "temperature": 28.5, "humidity": 42.0 }`

### IP-uri importante
| Dispozitiv | IP |
|-----------|-----|
| Raspberry Pi (rețea acasă) | 192.168.1.64 |
| RPi hotspot (setup) | 192.168.4.1 |
| ESP32 (când e pe hotspot) | 192.168.4.x |

---

## Probleme rezolvate (referință rapidă)

| Problemă | Cauza | Fix |
|---------|-------|-----|
| Mosquitto `status=13` | passwd owned de root | `chown mosquitto:mosquitto /etc/mosquitto/passwd && chmod 640` |
| Mosquitto nu ascultă în rețea | lipsea `listener 1883` | Adaugă în conf.d |
| PM2 `Missing script: start:prod` | pornit cu npm, nu cu `dist/main.js` | `pm2 start dist/main.js --name smart-home-api` |
| WebSocket JWT loop (connect-disconnect) | `JwtModule.register()` citea env înainte de .env | Schimbat la `JwtModule.registerAsync()` + ConfigService |
| ESP32 upload "Wrong boot mode" | bootloader mode incorect | Ține BOOT + apasă+eliberează EN + eliberează BOOT |
| Telefon afișa date greșite | topic `home/+/sensors` (greșit) + JSON mapping nested | Fix în mqtt.service.ts: `smarthome/+/sensors` + câmpuri flat |
| nmcli `Insufficient privileges` | lipsea `sudo` în setup.service.ts | Adăugat `sudo` + entry în sudoers |
| EAS CLI version error | upper bound `< 15.0.0` respingea v20+ | Eliminat upper bound: `>= 10.0.0` |
| CocoaPods `privacy_file_aggregation_enabled` | CocoaPods vechi pe imagine | `expo-build-properties` + imagine `macos-sonoma-14.6-xcode-16.1` |
| node_modules corupt după upgrade eșuat | partial SDK 56 install | `rm -rf node_modules package-lock.json && npm install --legacy-peer-deps` |
| `expo-doctor` fail: lipsă worklets | reanimated 4.x cere peer dep nou | `npx expo install react-native-worklets` |

---

## Arhitectura WiFi fallback (decisă 2026-06-10)

**O singură sursă de adevăr pentru hotspot la boot = systemd**, nu API-ul:
- `gateway/scripts/smarthome-wifi.sh` → instalat în `/usr/local/bin/` — așteaptă NM + autoconnect 45s; dacă wlan0 nu e conectat, pornește profilul AP `SmartHome-Hotspot` (SSID `SmartHome-Setup`, psk `smarthome2026`, `mode ap`, `ipv4.method shared`, `192.168.4.1/24`)
- `gateway/systemd/smarthome-wifi.service` → instalat în `/etc/systemd/system/`, enabled
- NestJS: `autoHotspot()` **eliminat** din `onModuleInit` (PM2 repornește API-ul la crash → pornea hotspotul peste WiFi valid). `startHotspot()` rămâne doar ca fallback la `connectToNetwork()` eșuat și pentru `POST /setup/hotspot`; refolosește profilul existent (nu mai delete+create)
- Numele conexiunii NM e mereu `SmartHome-Hotspot`; `getStatus()` face match exact pe el
- **Atenție:** profilul vechi `SmartHome-Setup` creat manual pe RPi era *client* (fără `mode ap`) — de șters: `sudo nmcli con delete "SmartHome-Setup"`

**Instalare pe RPi curat:**
```bash
sudo cp gateway/scripts/smarthome-wifi.sh /usr/local/bin/ && sudo chmod +x /usr/local/bin/smarthome-wifi.sh
sudo cp gateway/systemd/smarthome-wifi.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable smarthome-wifi.service
sudo apt install -y avahi-daemon && sudo hostnamectl set-hostname smarthome   # → smarthome.local
```

**Recuperare acces când hotspotul e activ:** conectează laptopul la `SmartHome-Setup` → `ssh smarthome@192.168.4.1`. Revenire pe WiFi (supraviețuiește căderii SSH):
```bash
sudo systemd-run sh -c 'nmcli con down SmartHome-Hotspot; nmcli con up "<HomeWiFi>"'
```

**Firmware ESP32:** rezolvă `smarthome.local` prin ESPmDNS înainte de MQTT; retry MQTT limitat la 10 → restart (fără ștergerea credențialelor — mutarea e tratată de fallback-ul WiFi).

---

## Flux WiFi Provisioning (cum funcționează)

```
1. RPi pornește → smarthome-wifi.service → fără WiFi cunoscut în 45s → hotspot "SmartHome-Setup" (192.168.4.1)
2. ESP32 pornește → se conectează la "SmartHome-Setup" din NVS (default)
3. Utilizator deschide app → apasă butonul ⊕ → SetupScreen
4. Telefon se conectează manual la "SmartHome-Setup"
5. App trimite cerere la 192.168.4.1:3000/api/setup/networks → lista WiFi disponibile
6. Utilizator alege rețeaua de acasă + introduce parola
7. App POST 192.168.4.1:3000/api/setup/connect → RPi se conectează la WiFi casă
8. RPi obține IP (ex: 192.168.1.64) → rămâne accesibil la smarthome.local:3000
9. Telefon se reconectează la WiFi casă → app funcționează normal
10. ESP32: primește comandă wifi_update prin MQTT → salvează în NVS → restart
```

---

## EAS Build — pași pentru TestFlight

```bash
cd "/Users/kirill/Desktop/Licenta pt fata/mobile"

# Build iOS preview (TestFlight)
eas build --platform ios --profile preview

# După ce build e gata:
eas submit --platform ios --latest   # trimite la TestFlight
```

**Profile `preview` în eas.json:**
- imagine: `macos-sonoma-14.6-xcode-16.1`
- `EXPO_PUBLIC_API_HOST=http://smarthome.local:3000`
- `distribution: internal`

**Variabile env:**
- `.env` local (nu în git): `EXPO_PUBLIC_API_HOST=http://192.168.1.64:3000`
- EAS build preview: `EXPO_PUBLIC_API_HOST=http://smarthome.local:3000`

---

## Pași următori (TO-DO)

- [ ] **EAS Build**: rulează `eas build --platform ios --profile preview` și verifică dacă trece
- [ ] **TestFlight**: distribuie build-ul intern pe iPhone
- [ ] **mDNS**: instalează `avahi-daemon` pe RPi pentru `smarthome.local`
- [ ] **ESP32 firmware update**: flashează firmware-ul nou (SmartHome-Setup ca default WiFi)
- [ ] **Merge PR** `fix/setup-sudo-nmcli` → main pe GitHub (sau verifică dacă e deja mergeat)
- [ ] **Capitole teză**: Capitolul 1 Introducere, Cap 2 Arhitectură, Cap 3 Hardware (plan în `/Users/kirill/.claude/plans/abundant-rolling-star.md`)
- [ ] **Servo + ESP32-CAM**: integrare (conform plan de mai sus)

---

## Comenzi utile RPi (SSH)

```bash
# Status servicii
sudo systemctl status mosquitto
sudo systemctl status postgresql
pm2 status

# Restart servicii
sudo systemctl restart mosquitto
pm2 restart smart-home-api

# Logs backend
pm2 logs smart-home-api --lines 50

# Test MQTT
mosquitto_sub -h localhost -p 1883 -u smarthome -P smarthome123 -t "smarthome/#" -v
mosquitto_pub -h localhost -p 1883 -u smarthome -P smarthome123 -t "smarthome/test/sensors" -m '{"nodeId":"test","temperature":25.0}'

# Date din DB
psql -U smarthome -d smarthome_db -c "SELECT * FROM sensor_readings ORDER BY timestamp DESC LIMIT 5;"

# Hotspot
sudo nmcli connection up SmartHome-Setup
sudo nmcli device wifi list

# Update cod
cd /home/smarthome/smart-home-licenta
git pull
cd api && npm run build
pm2 restart smart-home-api
```

---

## Structura completă a repo-ului

```
/Users/kirill/Desktop/Licenta pt fata/
├── api/                          # NestJS backend
│   └── src/
│       ├── app.module.ts
│       ├── auth/                 # JWT auth
│       ├── commands/             # relay/buzzer/servo control
│       ├── mqtt/                 # MQTT subscriber
│       ├── sensors/              # WebSocket + HTTP endpoints
│       ├── setup/                # WiFi provisioning endpoints
│       └── simulator/            # date simulate pentru dev
├── firmware/
│   └── esp32_dht11/
│       └── esp32_dht11.ino       # cod Arduino ESP32
├── mobile/                       # React Native / Expo
│   ├── app.json
│   ├── eas.json
│   ├── package.json
│   └── src/
│       ├── navigation/
│       ├── screens/
│       │   ├── DashboardScreen.tsx
│       │   ├── SetupScreen.tsx
│       │   ├── ControlScreen.tsx
│       │   ├── AlarmsScreen.tsx
│       │   └── LoginScreen.tsx
│       ├── services/
│       │   ├── api.ts
│       │   ├── config.ts
│       │   └── websocket.ts
│       └── types.ts
├── docs/
│   ├── SESSION_HISTORY.md        # ← acest fișier
│   └── hardware_breadboard_guide.md (de creat)
└── docker-compose.yml
```

---

## Note importante pentru chat-ul următor

1. **SDK 54 = React 19 + RN 0.81.5** — nu React 18! Nu modifica react/react-native.
2. **`npm install --legacy-peer-deps`** — mereu cu acest flag (react-navigation v6 peer deps)
3. **PM2** — pornire: `pm2 start dist/main.js` NU `npm run start:prod`
4. **JwtModule** — folosește `registerAsync()` în sensors.module.ts, NU `register()` (altfel WebSocket JWT fail)
5. **MQTT topic** — `smarthome/+/sensors` (cu `smarthome/`, NU `home/`)
6. **ESP32 flash** — BOOT+EN procedure dacă `Wrong boot mode detected`
7. **RPi IP** — 192.168.1.64 (poate să difere dacă DHCP se schimbă)
