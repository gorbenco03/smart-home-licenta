import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SensorReading } from './entities/sensor-reading.entity';
import { Node } from './entities/node.entity';
import { AlertsService } from '../alerts/alerts.service';
import { AutomationRule } from '../rules/rule.entity';

@Injectable()
export class SensorsService {
  constructor(
    @InjectRepository(SensorReading) private readingsRepo: Repository<SensorReading>,
    @InjectRepository(Node) private nodesRepo: Repository<Node>,
    @InjectRepository(AutomationRule) private rulesRepo: Repository<AutomationRule>,
    private eventEmitter: EventEmitter2,
    private alertsService: AlertsService,
  ) {}

  async saveReading(data: Partial<SensorReading>): Promise<SensorReading> {
    const reading = this.readingsRepo.create(data);
    const saved = await this.readingsRepo.save(reading);

    await this.nodesRepo.update(
      { nodeId: data.nodeId },
      { lastSeen: new Date(), online: true },
    );

    this.eventEmitter.emit('sensor.reading', saved);

    if (data.gasAlert) {
      await this.alertsService.createFromReading(saved, 'GAS_DETECTED', 'critical');
    }

    await this.evaluateRules(saved);

    return saved;
  }

  async getLatest(): Promise<Record<string, SensorReading>> {
    const nodes = await this.nodesRepo.find();
    const result: Record<string, SensorReading> = {};

    for (const node of nodes) {
      const reading = await this.readingsRepo.findOne({
        where: { nodeId: node.nodeId },
        order: { time: 'DESC' },
      });
      if (reading) result[node.nodeId] = reading;
    }

    return result;
  }

  async getHistory(nodeId: string, from: Date, to: Date, limit = 200): Promise<SensorReading[]> {
    return this.readingsRepo.find({
      where: { nodeId, time: Between(from, to) },
      order: { time: 'ASC' },
      take: limit,
    });
  }

  async getNodes(): Promise<Node[]> {
    return this.nodesRepo.find({ order: { nodeId: 'ASC' } });
  }

  async updateNodeStatus(data: { node_id: string; status: string }): Promise<void> {
    const online = data.status === 'online';
    await this.nodesRepo.update({ nodeId: data.node_id }, { online, lastSeen: new Date() });
    this.eventEmitter.emit('node.status', { nodeId: data.node_id, online });
  }

  async getActiveRules(nodeId: string): Promise<AutomationRule[]> {
    return this.rulesRepo.find({
      where: [
        { nodeId, enabled: true },
        { nodeId: null, enabled: true },
      ],
    });
  }

  private async evaluateRules(reading: SensorReading): Promise<void> {
    const rules = await this.getActiveRules(reading.nodeId);
    const hour = new Date().getHours();

    for (const rule of rules) {
      const value = reading[rule.sensor as keyof SensorReading] as number;
      if (value === undefined || value === null) continue;

      let triggered = false;
      switch (rule.operator) {
        case '>':  triggered = value > rule.threshold; break;
        case '<':  triggered = value < rule.threshold; break;
        case '>=': triggered = value >= rule.threshold; break;
        case '<=': triggered = value <= rule.threshold; break;
        case '==': triggered = Number(value) == rule.threshold; break;
      }

      if (triggered && rule.timeFrom && rule.timeTo) {
        const fromH = parseInt(rule.timeFrom.split(':')[0]);
        const toH   = parseInt(rule.timeTo.split(':')[0]);
        if (toH > fromH) {
          triggered = hour >= fromH && hour < toH;
        } else {
          triggered = hour >= fromH || hour < toH;
        }
      }

      if (triggered) {
        this.eventEmitter.emit('rule.triggered', {
          rule,
          nodeId: reading.nodeId,
          reading,
        });
      }
    }
  }
}
