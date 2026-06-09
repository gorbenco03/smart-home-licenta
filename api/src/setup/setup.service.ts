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
  static readonly HOTSPOT_SSID = 'SmartHome-Setup';
  static readonly HOTSPOT_PASS = 'smarthome2026';
  static readonly HOTSPOT_IP   = '192.168.4.1';

  constructor(private eventEmitter: EventEmitter2) {}

  // ── Status curent ──────────────────────────────────────
  async getStatus(): Promise<SetupStatus> {
    try {
      // Verifică dacă hotspot-ul e activ
      const { stdout: hotspotCheck } = await execAsync(
        `nmcli con show --active | grep -i hotspot || true`
      );
      if (hotspotCheck.trim()) {
        return {
          mode: 'hotspot',
          hotspotSsid: SetupService.HOTSPOT_SSID,
          ip: SetupService.HOTSPOT_IP,
        };
      }

      // Verifică conexiunea WiFi activă
      const { stdout } = await execAsync(
        `nmcli -t -f DEVICE,STATE,CONNECTION dev | grep wlan0 || true`
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
      await execAsync(`nmcli dev wifi rescan ifname wlan0 || true`);
      await new Promise(r => setTimeout(r, 2000));

      const { stdout } = await execAsync(
        `nmcli -t -f SSID,SIGNAL,SECURITY,IN-USE dev wifi list ifname wlan0`
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
      // Trimite credențialele la ESP32 înainte să ne deconectăm
      this.eventEmitter.emit('command.sent', {
        nodeId: 'esp32_node_a',
        command: { action: 'wifi_update', ssid, password },
      });

      // Oprește hotspot-ul dacă e activ
      await execAsync(`nmcli con down "SmartHome-Hotspot" || true`);
      await new Promise(r => setTimeout(r, 1000));

      // Conectare la noua rețea
      // Dacă există deja profil pentru acest SSID, îl actualizăm
      await execAsync(`nmcli con delete "${ssid}" || true`);
      await execAsync(
        `nmcli dev wifi connect "${ssid}" password "${password}" ifname wlan0`
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
  async startHotspot(): Promise<void> {
    try {
      this.logger.log('[Setup] Pornire hotspot SmartHome-Setup...');
      await execAsync(`nmcli con down "SmartHome-Hotspot" || true`);
      await execAsync(`nmcli con delete "SmartHome-Hotspot" || true`);
      await execAsync(
        `nmcli con add type wifi ifname wlan0 con-name "SmartHome-Hotspot" ` +
        `autoconnect no ssid "${SetupService.HOTSPOT_SSID}"`
      );
      await execAsync(
        `nmcli con modify "SmartHome-Hotspot" ` +
        `802-11-wireless.mode ap ` +
        `802-11-wireless-security.key-mgmt wpa-psk ` +
        `802-11-wireless-security.psk "${SetupService.HOTSPOT_PASS}" ` +
        `ipv4.method shared ` +
        `ipv4.addresses ${SetupService.HOTSPOT_IP}/24`
      );
      await execAsync(`nmcli con up "SmartHome-Hotspot"`);
      this.logger.log('[Setup] Hotspot activ: SmartHome-Setup / smarthome2026');
    } catch (e) {
      this.logger.error('[Setup] Eroare pornire hotspot:', e.message);
    }
  }

  // ── Auto-hotspot: pornit la boot dacă nu e WiFi ────────
  async autoHotspot(): Promise<void> {
    this.logger.log('[Setup] Verificare conectivitate la boot...');

    // Așteptăm 15s să se conecteze la rețeaua salvată
    await new Promise(r => setTimeout(r, 15_000));

    const status = await this.getStatus();
    if (status.mode === 'connected') {
      this.logger.log(`[Setup] Conectat la ${status.ssid} — hotspot inactiv`);
    } else {
      this.logger.log('[Setup] Nicio rețea găsită — pornire hotspot');
      await this.startHotspot();
    }
  }
}
