import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { SensorsService } from '../sensors/sensors.service';
import { UsersService } from '../users/users.service';

interface NodeState {
  nodeId: string;
  location: string;
  tempBase: number;       // temperatura de bază a zonei
  humBase: number;
  gasBaseline: number;
  lastMotion: number;     // timestamp ultimă mișcare
}

@Injectable()
export class SimulatorService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private tick = 0;

  // Topologia reală: un singur nod interior (toți senzorii) + camera exterioară.
  // Zonele Living/Dormitor/Bucătărie sunt derivate în aplicație din câmpurile
  // aceluiași nod (DHT11 #1 = living, DHT11 #2 = dormitor, MQ-2 = bucătărie).
  private nodes: NodeState[] = [
    { nodeId: 'esp32_node_a',  location: 'interior', tempBase: 21, humBase: 52, gasBaseline: 150, lastMotion: 0 },
    { nodeId: 'esp32_cam_node', location: 'curte',   tempBase: 0,  humBase: 0,  gasBaseline: 0,   lastMotion: 0 },
  ];

  constructor(
    private sensorsService: SensorsService,
    private usersService: UsersService,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultUser();
    await this.ensureNodes();

    if (process.env.SIMULATE !== 'true') {
      console.log('[Simulator] Dezactivat (SIMULATE != true)');
      return;
    }

    const interval = parseInt(process.env.SIMULATE_INTERVAL_MS ?? '5000');
    console.log(`[Simulator] Pornit — interval ${interval}ms`);
    this.timer = setInterval(() => this.generate(), interval);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async ensureDefaultUser() {
    const hasUsers = await this.usersService.exists();
    if (!hasUsers) {
      const username = process.env.DEFAULT_USER ?? 'admin';
      const password = process.env.DEFAULT_PASS ?? 'admin123';
      await this.usersService.create(username, `${username}@smarthome.local`, password);
      console.log(`[Simulator] User implicit creat: ${username} / ${password}`);
    }
  }

  private async ensureNodes() {
    const nodeTypes: Record<string, string> = {
      esp32_node_a:   'hybrid',   // toți senzorii + servo + LED + ventilator
      esp32_cam_node: 'camera',   // cameră MJPEG + PIR exterior
    };
    for (const node of this.nodes) {
      await this.sensorsService.upsertNode(node.nodeId, node.location, nodeTypes[node.nodeId]);
    }
    console.log('[Simulator] Noduri verificate/create:', this.nodes.map((n) => n.nodeId).join(', '));
  }

  private async generate() {
    this.tick++;
    const hour = new Date().getHours();

    for (const node of this.nodes) {
      const reading = this.buildReading(node, hour);
      try {
        await this.sensorsService.saveReading(reading);
      } catch (e) {
        console.error(`[Simulator] Eroare salvare ${node.nodeId}:`, e.message);
      }
    }
  }

  private buildReading(node: NodeState, hour: number) {
    // Camera exterioară: publică DOAR mișcare (PIR pe GPIO13), fără senzori de mediu.
    if (node.nodeId === 'esp32_cam_node') {
      const motionProb = hour >= 7 && hour <= 23 ? 0.20 : 0.05;
      return {
        nodeId: node.nodeId,
        location: node.location,
        motion: Math.random() < motionProb,
        time: new Date(),
      };
    }

    // Variație sinusoidală zi/noapte: peak la ora 14, minim la ora 3
    const dayFactor = Math.sin(((hour - 3) / 11) * Math.PI);

    // DHT11 #1
    const temperature = parseFloat(
      (node.tempBase + dayFactor * 4 + this.noise(0.4)).toFixed(1)
    );
    const humidity = parseFloat(
      (node.humBase - dayFactor * 6 + this.noise(3)).toFixed(1)
    );

    // DHT11 #2 — ușor diferit față de primul (poziție fizică diferită)
    const temperature2 = parseFloat(
      (node.tempBase + dayFactor * 4 + this.noise(0.6) - 0.3).toFixed(1)
    );
    const humidity2 = parseFloat(
      (node.humBase - dayFactor * 6 + this.noise(4) + 1.5).toFixed(1)
    );

    // LDR #1 (ADC 0–1023): mai expus la lumina naturală
    const light1 = Math.max(0, Math.min(1023,
      Math.round(dayFactor * 800 + this.noise(40))
    ));
    // LDR #2 (ADC 0–1023): mai în umbră, valori mai mici
    const light2 = Math.max(0, Math.min(1023,
      Math.round(dayFactor * 350 + this.noise(25))
    ));
    // lightLux = alias light1 (conform contractului de date firmware)
    const lightLux = parseFloat(light1.toFixed(1));

    // Gaz: normal baseline, 1% șansă de spike simulat (la fiecare ~100 ticks)
    const gasSpike = this.tick % 100 === 0 && node.nodeId === 'esp32_node_a';
    const gasLevel = gasSpike
      ? Math.floor(420 + Math.random() * 150)
      : Math.floor(node.gasBaseline + this.noise(25));
    const gasAlert = gasLevel > 350;

    // Nodul interior nu are PIR (mișcarea e detectată doar de camera exterioară)
    const motion = false;

    // Ventilator simulat: mod automat, prag 28°C, pornit când temp medie ≥ prag
    const fanThreshold = 28;
    const fanAuto = true;
    const fanOn = (temperature + temperature2) / 2 >= fanThreshold;

    return {
      nodeId: node.nodeId,
      location: node.location,
      temperature,
      humidity,
      temperature2,
      humidity2,
      gasLevel,
      gasAlert,
      motion,
      lightLux,
      light1,
      light2,
      fanOn,
      fanAuto,
      fanThreshold,
      time: new Date(),
    };
  }

  private noise(amplitude: number): number {
    return (Math.random() - 0.5) * 2 * amplitude;
  }
}
