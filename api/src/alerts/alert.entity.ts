import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('alerts')
export class Alert {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz' })
  time: Date;

  @Column({ name: 'node_id' })
  nodeId: string;

  @Column({ name: 'alert_type' })
  alertType: string;

  @Column({ default: 'medium' })
  severity: string;

  @Column({ nullable: true })
  location: string;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, any>;

  @Column({ default: false })
  acknowledged: boolean;

  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt: Date;
}
