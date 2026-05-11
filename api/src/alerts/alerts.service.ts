import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Alert } from './alert.entity';
import { SensorReading } from '../sensors/entities/sensor-reading.entity';

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert) private repo: Repository<Alert>,
    private eventEmitter: EventEmitter2,
  ) {}

  async createFromReading(
    reading: SensorReading,
    alertType: string,
    severity = 'medium',
  ): Promise<Alert> {
    const alert = this.repo.create({
      nodeId: reading.nodeId,
      alertType,
      severity,
      location: reading.location,
      details: {
        gasLevel: reading.gasLevel,
        temperature: reading.temperature,
      },
    });
    const saved = await this.repo.save(alert);
    this.eventEmitter.emit('alert.new', saved);
    return saved;
  }

  async create(data: Partial<Alert>): Promise<Alert> {
    const alert = this.repo.create(data);
    const saved = await this.repo.save(alert);
    this.eventEmitter.emit('alert.new', saved);
    return saved;
  }

  async findAll(limit = 50): Promise<Alert[]> {
    return this.repo.find({
      order: { time: 'DESC' },
      take: limit,
    });
  }

  async acknowledge(id: number): Promise<Alert> {
    await this.repo.update(id, { acknowledged: true, acknowledgedAt: new Date() });
    return this.repo.findOne({ where: { id } });
  }

  async countUnread(): Promise<number> {
    return this.repo.count({ where: { acknowledged: false } });
  }
}
