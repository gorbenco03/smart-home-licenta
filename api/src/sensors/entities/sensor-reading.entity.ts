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

  @Column({ name: 'motion_armed', type: 'boolean', nullable: true })
  motionArmed: boolean;

  @Column({ name: 'light_lux', type: 'float', nullable: true })
  lightLux: number;

  // DHT11 #2 — al doilea senzor de temperatură/umiditate (opțional, nullable pentru compatibilitate înapoi)
  @Column({ name: 'temperature2', type: 'float', nullable: true })
  temperature2: number;

  @Column({ name: 'humidity2', type: 'float', nullable: true })
  humidity2: number;

  // LDR analogice — valorile raw ADC 0–1023 de la cele două fotorezistențe
  @Column({ name: 'light1', type: 'int', nullable: true })
  light1: number;

  @Column({ name: 'light2', type: 'int', nullable: true })
  light2: number;

  // Stare ventilator — pornit/oprit, mod automat și pragul de temperatură (°C)
  @Column({ name: 'fan_on', nullable: true })
  fanOn: boolean;

  @Column({ name: 'fan_auto', nullable: true })
  fanAuto: boolean;

  @Column({ name: 'fan_threshold', type: 'float', nullable: true })
  fanThreshold: number;
}
