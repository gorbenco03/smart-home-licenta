import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Schedule } from './schedule.entity';
import { CommandsService } from '../commands/commands.service';

@Injectable()
export class SchedulesService {
  private readonly logger = new Logger('Schedules');

  constructor(
    @InjectRepository(Schedule) private repo: Repository<Schedule>,
    private commands: CommandsService,
  ) {}

  findAll(): Promise<Schedule[]> {
    return this.repo.find({ order: { time: 'ASC' } });
  }

  findOne(id: number): Promise<Schedule> {
    return this.repo.findOne({ where: { id } });
  }

  create(data: Partial<Schedule>): Promise<Schedule> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: number, data: Partial<Schedule>): Promise<Schedule> {
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  remove(id: number) {
    return this.repo.delete(id);
  }

  /** Verifică din minut în minut programele și declanșează acțiunile scadente. */
  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const current = `${hh}:${mm}`;
    const today = String(now.getDay()); // 0=Duminică … 6=Sâmbătă

    const list = await this.repo.find({ where: { enabled: true } });
    for (const s of list) {
      if (s.time !== current) continue;

      const days = (s.days || '').split(',').map((d) => d.trim()).filter(Boolean);
      if (days.length && !days.includes(today)) continue;

      // Evită re-declanșarea în același minut (ex. la restart)
      if (s.lastRun) {
        const lr = new Date(s.lastRun);
        if (
          lr.getFullYear() === now.getFullYear() &&
          lr.getMonth() === now.getMonth() &&
          lr.getDate() === now.getDate() &&
          lr.getHours() === now.getHours() &&
          lr.getMinutes() === now.getMinutes()
        ) {
          continue;
        }
      }

      const command = { action: s.action, ...(s.params || {}) };
      this.commands.send(s.nodeId, command as any);

      s.lastRun = now;
      await this.repo.save(s);
      this.logger.log(`Program #${s.id} declanșat (${s.time}) → ${s.nodeId}: ${s.action}`);
    }
  }
}
