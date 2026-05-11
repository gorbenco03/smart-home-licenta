import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('nodes')
export class Node {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'node_id', unique: true })
  nodeId: string;

  @Column()
  location: string;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'last_seen', type: 'timestamptz', nullable: true })
  lastSeen: Date;

  @Column({ default: false })
  online: boolean;

  @Column({ name: 'firmware_ver', nullable: true })
  firmwareVer: string;
}
