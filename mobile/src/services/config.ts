// Schimbă API_HOST dacă folosești dispozitiv fizic (nu emulator):
// → ipconfig getifaddr en0  (Mac)
// → ipconfig  (Windows)
// și setează IP-ul mașinii tale, ex: 'http://192.168.1.50:3000'

export const API_HOST = __DEV__
  ? 'http://localhost:3000'   // funcționează pe emulator iOS/Android
  : 'http://192.168.1.100:3000'; // IP Raspberry Pi în producție

export const API_BASE = `${API_HOST}/api`;
export const WS_HOST  = API_HOST;

// ESP32-CAM — schimbă IP-ul după ce îl conectezi la Wi-Fi
// Găsești IP-ul în Serial Monitor din Arduino IDE după boot
export const CAMERA_HOST        = 'http://192.168.1.50';   // ← înlocuiește cu IP-ul real
export const CAMERA_STREAM_URL  = `${CAMERA_HOST}/stream`;  // MJPEG live
export const CAMERA_SNAPSHOT_URL = `${CAMERA_HOST}/capture`; // JPEG snapshot
