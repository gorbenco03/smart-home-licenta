import axios from 'axios';
import { API_HOST, HOTSPOT_HOST } from './config';

// ── Descoperire automată a serverului ─────────────────────
// Build-ul nu mai depinde de un singur IP: sondăm în paralel toate
// adresele posibile ale RPi-ului și folosim prima care răspunde.
// Astfel același build merge acasă, pe hotspotul de setup și în
// orice rețea nouă (smarthome.local via avahi/mDNS).

const CANDIDATES: string[] = [
  ...new Set([
    API_HOST,                       // env var / fallback din config
    'http://smarthome.local:3000',  // mDNS — orice rețea
    HOTSPOT_HOST,                   // hotspot RPi — 192.168.4.1
  ]),
];

const PROBE_TIMEOUT_MS = 4000;

let resolvedHost: string | null = null;
let pending: Promise<string> | null = null;

async function probe(host: string): Promise<string> {
  // /api/setup/status e public și răspunde doar de pe RPi
  await axios.get(`${host}/api/setup/status`, { timeout: PROBE_TIMEOUT_MS });
  return host;
}

export async function resolveHost(force = false): Promise<string> {
  if (resolvedHost && !force) return resolvedHost;
  if (pending) return pending;

  pending = Promise.any(CANDIDATES.map(probe))
    .then((host) => {
      console.log(`[Discovery] Server găsit: ${host}`);
      resolvedHost = host;
      return host;
    })
    .catch(() => {
      // Nimeni nu răspunde — lăsăm API_HOST să producă eroarea "normală"
      console.log('[Discovery] Niciun server găsit, folosesc default');
      return API_HOST;
    })
    .finally(() => { pending = null; });

  return pending;
}

// Apelată la erori de rețea: data viitoare redescoperim serverul
// (ex: telefonul s-a mutat de pe hotspot pe WiFi-ul casei).
export function invalidateHost() {
  resolvedHost = null;
}

export function getResolvedHost(): string | null {
  return resolvedHost;
}
