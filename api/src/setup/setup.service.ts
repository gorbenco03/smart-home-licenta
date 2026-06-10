import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter2 } from '@nestjs/event-emitter';

const execAsync = promisify(exec);

export interface WifiNetwork {
  ssid: string;
  signal: number;   // 0–100
  secured: boolean;
  connected: boolean;
}

export interface SetupStatus {
  mode: 'hotspot' | 'connected' | 'connecting' | 'disconnected';
  ssid?: string;
  ip?: string;
  hotspotSsid?: string;
}

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);
  static readonly HOTSPOT_CON  = 'SmartHome-Hotspot';
  static readonly HOTSPOT_SSID = 'SmartHome-Setup';
  static readonly HOTSPOT_PASS = 'smarthome2026';
  static readonly HOTSPOT_IP   = '192.168.4.1';

  constructor(private eventEmitter: EventEmitter2) {}

  // ── Status curent ──────────────────────────────────────
  async getStatus(): Promise<SetupStatus> {
    try {
      // Verifică dacă hotspot-ul e activ
      const { stdout: hotspotCheck } = await execAsync(
        `sudo nmcli -t -f NAME con show --active | grep -x "${SetupService.HOTSPOT_CON}" || true`
      );
      if (hotspotCheck.trim()) {
        return {
          mode: 'hotspot',
          hotspotSsid: SetupService.HOTSPOT_SSID,
          ip: SetupService.HOTSPOT_IP,
        };
      }

      // Verifică conexiunea WiFi activă
      // ^wlan0: ca să nu prindem și interfața p2p-dev-wlan0
      const { stdout } = await execAsync(
        `sudo nmcli -t -f DEVICE,STATE,CONNECTION dev | grep '^wlan0:' || true`
      );
      const parts = stdout.trim().split(':');
      if (parts[1] === 'connected') {
        const { stdout: ip } = await execAsync(
          `hostname -I | awk '{print $1}'`
        );
        return {
          mode: 'connected',
          ssid: parts[2],
          ip: ip.trim(),
        };
      }

      return { mode: 'disconnected' };
    } catch {
      return { mode: 'disconnected' };
    }
  }

  // ── Scanare rețele WiFi ────────────────────────────────
  async scanNetworks(): Promise<WifiNetwork[]> {
    try {
      // Rescanare forțată
      await execAsync(`sudo nmcli dev wifi rescan ifname wlan0 || true`);
      await new Promise(r => setTimeout(r, 2000));

      const { stdout } = await execAsync(
        `sudo nmcli -t -f SSID,SIGNAL,SECURITY,IN-USE dev wifi list ifname wlan0`
      );

      const seen = new Set<string>();
      const networks: WifiNetwork[] = [];

      for (const line of stdout.trim().split('\n')) {
        const parts = line.split(':');
        const ssid = parts[0]?.trim();
        if (!ssid || ssid === '--' || ssid === SetupService.HOTSPOT_SSID) continue;
        if (seen.has(ssid)) continue;
        seen.add(ssid);

        networks.push({
          ssid,
          signal:    parseInt(parts[1]) || 0,
          secured:   (parts[2] || '').trim() !== '--' && (parts[2] || '').trim() !== '',
          connected: parts[3]?.trim() === '*',
        });
      }

      return networks.sort((a, b) => b.signal - a.signal);
    } catch (e) {
      this.logger.error('Eroare scanare WiFi:', e.message);
      return [];
    }
  }

  // ── Conectare la rețea nouă ────────────────────────────
  async connectToNetwork(ssid: string, password: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`[Setup] Conectare la rețeaua: ${ssid}`);

    try {
      // Trimite credențialele către TOATE nodurile înainte să ne deconectăm
      for (const nodeId of ['esp32_node_a', 'esp32_cam_node']) {
        this.eventEmitter.emit('command.sent', {
          nodeId,
          command: { action: 'wifi_update', ssid, password },
        });
      }

      // Oprește hotspot-ul dacă e activ
      await execAsync(`sudo nmcli con down "${SetupService.HOTSPOT_CON}" || true`);
      await new Promise(r => setTimeout(r, 1000));

      // Conectare la noua rețea
      // Dacă există deja profil pentru acest SSID, îl actualizăm
      await execAsync(`sudo nmcli con delete "${ssid}" || true`);
      await execAsync(
        `sudo nmcli dev wifi connect "${ssid}" password "${password}" ifname wlan0`
      );

      this.logger.log(`[Setup] Conectat la ${ssid}!`);
      return { success: true, message: `Conectat la ${ssid}` };
    } catch (e) {
      this.logger.error(`[Setup] Eroare conectare: ${e.message}`);
      // Repornim hotspot-ul dacă conectarea a eșuat
      await this.startHotspot();
      return { success: false, message: `Nu s-a putut conecta la ${ssid}` };
    }
  }

  // ── Pornire hotspot ────────────────────────────────────
  // Profil identic cu cel creat de gateway/scripts/smarthome-wifi.sh —
  // refolosim profilul existent în loc să-l ștergem și recreăm.
  async startHotspot(): Promise<void> {
    const con = SetupService.HOTSPOT_CON;
    try {
      this.logger.log(`[Setup] Pornire hotspot ${SetupService.HOTSPOT_SSID}...`);

      const { stdout: existing } = await execAsync(
        `sudo nmcli -t -f NAME con show | grep -x "${con}" || true`
      );
      if (!existing.trim()) {
        await execAsync(
          `sudo nmcli con add type wifi ifname wlan0 con-name "${con}" ` +
          `autoconnect no ssid "${SetupService.HOTSPOT_SSID}" ` +
          `802-11-wireless.mode ap ` +
          `802-11-wireless-security.key-mgmt wpa-psk ` +
          `802-11-wireless-security.psk "${SetupService.HOTSPOT_PASS}" ` +
          `ipv4.method shared ` +
          `ipv4.addresses ${SetupService.HOTSPOT_IP}/24`
        );
      }

      await execAsync(`sudo nmcli con up "${con}"`);
      this.logger.log(
        `[Setup] Hotspot activ: ${SetupService.HOTSPOT_SSID} / ${SetupService.HOTSPOT_PASS}`
      );
    } catch (e) {
      this.logger.error('[Setup] Eroare pornire hotspot:', e.message);
    }
  }
}
