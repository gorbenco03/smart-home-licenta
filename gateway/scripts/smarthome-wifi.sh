#!/bin/bash
# smarthome-wifi.sh — fallback WiFi → hotspot la boot
#
# Rulat de smarthome-wifi.service. Logica:
#   1. Așteaptă NetworkManager să fie gata (max 20s)
#   2. Așteaptă autoconnect la un WiFi cunoscut (max 45s)
#   3. Dacă wlan0 tot nu e conectat → pornește hotspot SmartHome-Hotspot
#      (SSID: SmartHome-Setup, parola: smarthome2026, IP: 192.168.4.1)
#
# NU pornește hotspotul dacă există deja o conexiune WiFi activă.
# Profilul AP e identic cu cel creat de NestJS setup.service.ts (startHotspot).

set -u

CON_NAME="SmartHome-Hotspot"
SSID="SmartHome-Setup"
PSK="smarthome2026"
HOTSPOT_IP="192.168.4.1"
IFACE="wlan0"

log() { echo "[smarthome-wifi] $*"; }

# ── 1. Așteaptă NetworkManager ────────────────────────────
for i in $(seq 1 20); do
  if nmcli general status &>/dev/null; then
    break
  fi
  sleep 1
done

if ! nmcli general status &>/dev/null; then
  log "EROARE: NetworkManager nu răspunde după 20s"
  exit 1
fi

# ── 2. Așteaptă autoconnect la WiFi cunoscut (max 45s) ────
log "Aștept conexiune WiFi pe ${IFACE}..."
for i in $(seq 1 45); do
  STATE=$(nmcli -t -f DEVICE,STATE dev | grep "^${IFACE}:" | cut -d: -f2)
  if [ "$STATE" = "connected" ]; then
    ACTIVE=$(nmcli -t -f NAME,DEVICE con show --active | grep ":${IFACE}$" | cut -d: -f1)
    # Dacă e deja pe hotspot (rămas de la o rulare anterioară), nu e "conectat la WiFi"
    if [ "$ACTIVE" != "$CON_NAME" ]; then
      log "Conectat la WiFi: ${ACTIVE} — hotspot inactiv, ieșire."
      exit 0
    fi
    log "Hotspotul e deja activ — ieșire."
    exit 0
  fi
  sleep 1
done

# ── 3. Niciun WiFi cunoscut → pornește hotspotul ──────────
log "Niciun WiFi cunoscut găsit în 45s — pornesc hotspotul ${SSID}"

if ! nmcli -t -f NAME con show | grep -qx "$CON_NAME"; then
  log "Creez profilul ${CON_NAME}..."
  nmcli con add type wifi ifname "$IFACE" con-name "$CON_NAME" \
    autoconnect no ssid "$SSID" \
    802-11-wireless.mode ap \
    802-11-wireless-security.key-mgmt wpa-psk \
    802-11-wireless-security.psk "$PSK" \
    ipv4.method shared \
    ipv4.addresses "${HOTSPOT_IP}/24"
fi

if nmcli con up "$CON_NAME"; then
  log "Hotspot activ: ${SSID} / ${PSK} → http://${HOTSPOT_IP}:3000"
else
  log "EROARE: nu am putut porni hotspotul"
  exit 1
fi
