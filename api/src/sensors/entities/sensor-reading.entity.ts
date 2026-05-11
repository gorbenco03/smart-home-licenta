import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('sensor_readings')
export class SensorReading {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz' })
  time: Date;

  @Column({ name: 'node_id' })
  nodeId: string;

  @Column({ nullable: true })
  location: string;

  @Column({ type: 'float', nullable: true })
  temperature: number;

  @Column({ type: 'float', nullable: true })
  humidity: number;

  @Column({ name: 'gas_level', type: 'int', nullable: true })
  gasLevel: number;

  @Column({ name: 'gas_alert', default: false })
  gasAlert: boolean;

  @Column({ default: false })
  motion: boolean;

  @Column({ name: 'light_lux', type: 'float', nullable: true })
  lightLux: number;
}
