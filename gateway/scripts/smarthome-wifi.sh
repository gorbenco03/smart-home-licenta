#!/bin/bash
# smarthome-wifi.sh — la boot: conecteaza RPi la o retea cunoscuta; daca nu, hotspot.
#
# Rulat de smarthome-wifi.service. Logica:
#   1. Asteapta NetworkManager (max 20s)
#   2. Rescaneaza si incearca retelele cunoscute, in ordinea preferintei
#      (hotspot telefon "Deny", apoi "Orange-...") — daca una e in raza, se conecteaza.
#      Asa, ESP-urile (care au aceleasi retele ca fallback) ajung pe aceeasi retea.
#   3. Daca nicio retea cunoscuta nu e gasita -> porneste hotspotul SmartHome-Setup
#      (2.4GHz / canal 6 / WPA2-CCMP / PMF off -> compatibil ESP32), IP 192.168.4.1
#
# Profilele retelelor client (Deny, Orange) trebuie create o data (au parola salvata).

set -u

IFACE="wlan0"
CON_NAME="SmartHome-Hotspot"
SSID="SmartHome-Setup"
PSK="smarthome2026"
HOTSPOT_IP="192.168.4.1"

# Retele client preferate, in ordine (trebuie sa existe profilul cu parola salvata)
KNOWN=("Deny" "Orange-ADXPcy-2G")

log() { echo "[smarthome-wifi] $*"; }

# ── 1. Asteapta NetworkManager ────────────────────────────
for i in $(seq 1 20); do
  nmcli general status &>/dev/null && break
  sleep 1
done
if ! nmcli general status &>/dev/null; then
  log "EROARE: NetworkManager nu raspunde dupa 20s"; exit 1
fi

nmcli radio wifi on &>/dev/null || true

# Daca deja suntem conectati la o retea client (nu hotspot), gata.
ACTIVE=$(nmcli -t -f NAME,TYPE con show --active 2>/dev/null | grep ':802-11-wireless' | cut -d: -f1)
if [ -n "$ACTIVE" ] && [ "$ACTIVE" != "$CON_NAME" ]; then
  log "Deja conectat la WiFi: ${ACTIVE} — gata."; exit 0
fi

# ── 2. Rescaneaza si incearca retelele cunoscute, in ordine ──
log "Scanez retele..."
nmcli dev wifi rescan &>/dev/null || true
sleep 6

VISIBLE=$(nmcli -t -f SSID dev wifi list 2>/dev/null)
for ssid in "${KNOWN[@]}"; do
  if echo "$VISIBLE" | grep -Fxq "$ssid"; then
    log "Gasit \"${ssid}\" in raza — ma conectez..."
    if nmcli con up "$ssid" &>/dev/null; then
      log "Conectat la ${ssid}."; exit 0
    fi
    log "Profilul \"${ssid}\" lipseste sau parola gresita — incerc urmatoarea."
  fi
done

# ── 3. Nicio retea cunoscuta -> hotspot (compatibil ESP32) ──
log "Nicio retea cunoscuta gasita — pornesc hotspotul ${SSID}"

if ! nmcli -t -f NAME con show | grep -qx "$CON_NAME"; then
  log "Creez profilul ${CON_NAME}..."
  nmcli con add type wifi ifname "$IFACE" con-name "$CON_NAME" \
    autoconnect no ssid "$SSID" \
    802-11-wireless.mode ap \
    802-11-wireless.band bg \
    802-11-wireless.channel 6 \
    802-11-wireless-security.key-mgmt wpa-psk \
    802-11-wireless-security.proto rsn \
    802-11-wireless-security.pairwise ccmp \
    802-11-wireless-security.group ccmp \
    802-11-wireless-security.pmf 1 \
    802-11-wireless-security.psk "$PSK" \
    ipv4.method shared \
    ipv4.addresses "${HOTSPOT_IP}/24"
else
  # Asigura setarile compatibile ESP32 chiar daca profilul exista deja
  nmcli con modify "$CON_NAME" \
    802-11-wireless.band bg \
    802-11-wireless.channel 6 \
    802-11-wireless-security.proto rsn \
    802-11-wireless-security.pairwise ccmp \
    802-11-wireless-security.group ccmp \
    802-11-wireless-security.pmf 1 &>/dev/null || true
fi

if nmcli con up "$CON_NAME"; then
  log "Hotspot activ: ${SSID} / ${PSK} -> http://${HOTSPOT_IP}:3000"
else
  log "EROARE: nu am putut porni hotspotul"; exit 1
fi
