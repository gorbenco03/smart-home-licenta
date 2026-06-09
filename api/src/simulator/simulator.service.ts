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

  private nodes: NodeState[] = [
    { nodeId: 'esp32_node_a', location: 'living',   tempBase: 21, humBase: 52, gasBaseline: 150, lastMotion: 0 },
    { nodeId: 'esp32_node_b', location: 'dormitor', tempBase: 19, humBase: 58, gasBaseline: 130, lastMotion: 0 },
    { nodeId: 'esp32_cam_node', location: 'hol',    tempBase: 20, humBase: 55, gasBaseline: 140, lastMotion: 0 },
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
      esp32_node_a:   'hybrid',   // senzori + servo + relay
      esp32_node_b:   'sensor',   // senzori + relay
      esp32_cam_node: 'camera',   // cameră MJPEG
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
    // Variație sinusoidală zi/noapte: peak la ora 14, minim la ora 3
    const dayFactor = Math.sin(((hour - 3) / 11) * Math.PI);

    const temperature = parseFloat(
      (node.tempBase + dayFactor * 4 + this.noise(0.4)).toFixed(1)
    );
    const humidity = parseFloat(
      (node.humBase - dayFactor * 6 + this.noise(3)).toFixed(1)
    );

    // Lumina urmărește ziua (0 noaptea, ~600 lux la prânz)
    const lightLux = parseFloat(
      Math.max(0, dayFactor * 500 + this.noise(30)).toFixed(1)
    );

    // Gaz: normal baseline, 1% șansă de spike simulat (la fiecare ~100 ticks)
    const gasSpike = this.tick % 100 === 0 && node.nodeId === 'esp32_node_a';
    const gasLevel = gasSpike
      ? Math.floor(420 + Math.random() * 150)
      : Math.floor(node.gasBaseline + this.noise(25));
    const gasAlert = gasLevel > 350;

    // Mișcare: mai probabil ziua (ora 7-23)
    const motionProb = hour >= 7 && hour <= 23 ? 0.25 : 0.03;
    const motion = Math.random() < motionProb;

    return {
      nodeId: node.nodeId,
      location: node.location,
      temperature,
      humidity,
      gasLevel,
      gasAlert,
      motion,
      lightLux,
      time: new Date(),
    };
  }

  private noise(amplitude: number): number {
    return (Math.random() - 0.5) * 2 * amplitude;
  }
}
