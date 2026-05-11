import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('automation_rules')
export class AutomationRule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'node_id', nullable: true })
  nodeId: string;

  @Column()
  sensor: string;

  @Column()
  operator: string;

  @Column({ type: 'float' })
  threshold: number;

  @Column({ name: 'time_from', type: 'varchar', nullable: true })
  timeFrom: string;

  @Column({ name: 'time_to', type: 'varchar', nullable: true })
  timeTo: string;

  @Column({ name: 'action_type' })
  actionType: string;

  @Column({ name: 'action_target', nullable: true })
  actionTarget: string;

  @Column({ name: 'action_params', type: 'jsonb', nullable: true })
  actionParams: Record<string, any>;

  @Column({ default: true })
  enabled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
