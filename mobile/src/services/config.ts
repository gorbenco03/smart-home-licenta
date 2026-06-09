// ── API Host ─────────────────────────────────────────────
// Prioritate: env var > fallback bazat pe __DEV__
//
// Development (Expo Go):        setează EXPO_PUBLIC_API_HOST în .env
// Build preview (TestFlight):   setat în eas.json → env → preview
// Build production (App Store): setat în eas.json → env → production

export const API_HOST: string =
  process.env.EXPO_PUBLIC_API_HOST ??
  (__DEV__
    ? 'http://192.168.1.64:3000'       // Expo Go — IP fix RPi în rețeaua locală
    : 'http://smarthome.local:3000');  // fallback dacă env var nu e setat

export const API_BASE = `${API_HOST}/api`;
export const WS_HOST  = API_HOST;

// ── Hotspot IP (fix, nu se schimbă niciodată) ─────────────
// Folosit în SetupScreen când telefonul e conectat la SmartHome-Setup
export const HOTSPOT_HOST = 'http://192.168.4.1:3000';
export const HOTSPOT_API = `${HOTSPOT_HOST}/api`;

// ── ESP32-CAM ─────────────────────────────────────────────
// Schimbă după ce ESP32-CAM e conectat la WiFi și îi afli IP-ul
export const CAMERA_HOST         = process.env.EXPO_PUBLIC_CAMERA_HOST ?? 'http://192.168.1.50';
export const CAMERA_STREAM_URL   = `${CAMERA_HOST}/stream`;
export const CAMERA_SNAPSHOT_URL = `${CAMERA_HOST}/capture`;
