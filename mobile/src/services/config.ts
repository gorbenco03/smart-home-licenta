// Adresa RPi:
//  - Pe hotspot (setup inițial): 192.168.4.1
//  - Pe rețeaua casei (după configurare): smarthome.local
//
// Schimbă doar dacă ai nevoie de IP fix pentru debug:
export const API_HOST = __DEV__
  ? 'http://192.168.1.64:3000'      // debug local cu IP fix
  : 'http://smarthome.local:3000';  // producție — mDNS

// IP hotspot pentru setup wizard (mereu fix)
export const HOTSPOT_HOST = 'http://192.168.4.1:3000';

export const API_BASE = `${API_HOST}/api`;
export const WS_HOST  = API_HOST;

// ESP32-CAM — schimbă IP-ul după ce îl conectezi la Wi-Fi
// Găsești IP-ul în Serial Monitor din Arduino IDE după boot
export const CAMERA_HOST        = 'http://192.168.1.50';   // ← înlocuiește cu IP-ul real
export const CAMERA_STREAM_URL  = `${CAMERA_HOST}/stream`;  // MJPEG live
export const CAMERA_SNAPSHOT_URL = `${CAMERA_HOST}/capture`; // JPEG snapshot
