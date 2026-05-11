import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutomationRule } from './rule.entity';

@Injectable()
export class RulesService {
  constructor(@InjectRepository(AutomationRule) private repo: Repository<AutomationRule>) {}

  findAll(): Promise<AutomationRule[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  create(data: Partial<AutomationRule>): Promise<AutomationRule> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: number, data: Partial<AutomationRule>): Promise<AutomationRule> {
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  async findOne(id: number): Promise<AutomationRule> {
    const rule = await this.repo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException(`Regula #${id} nu există`);
    return rule;
  }

  async remove(id: number): Promise<void> {
    await this.repo.delete(id);
  }
}
