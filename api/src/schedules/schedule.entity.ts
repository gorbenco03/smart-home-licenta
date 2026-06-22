import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Program orar — declanșează o acțiune pe un nod la o anumită oră,
 * în zilele selectate ale săptămânii. Evaluat de SchedulesService
 * (cron, din minut în minut) și publicat prin MQTT.
 */
@Entity('schedules')
export class Schedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  name: string;

  @Column({ name: 'node_id', default: 'esp32_node_a' })
  nodeId: string;

  // Ora declanșării, format "HH:MM" (24h)
  @Column()
  time: string;

  // Zile active: CSV cu indici 0=Duminică … 6=Sâmbătă (JS getDay).
  // Implicit toate zilele.
  @Column({ default: '0,1,2,3,4,5,6' })
  days: string;

  // Acțiunea trimisă nodului (ex. servo_move, fan_on, fan_off, led_on, all_off)
  @Column()
  action: string;

  // Parametri opționali ai acțiunii (ex. {"servoAngle":0} sau {"led":1})
  @Column({ type: 'jsonb', nullable: true })
  params: Record<string, unknown>;

  @Column({ default: true })
  enabled: boolean;

  // Ultima declanșare — previne re-declanșarea în același minut
  @Column({ name: 'last_run', type: 'timestamptz', nullable: true })
  lastRun: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
