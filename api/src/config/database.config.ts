import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { SensorReading } from '../sensors/entities/sensor-reading.entity';
import { Node } from '../sensors/entities/node.entity';
import { Alert } from '../alerts/alert.entity';
import { AutomationRule } from '../rules/rule.entity';
import { Schedule } from '../schedules/schedule.entity';
import { User } from '../users/user.entity';

export const databaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432'),
  database: process.env.DB_NAME ?? 'smarthome_db',
  username: process.env.DB_USER ?? 'smarthome',
  password: process.env.DB_PASS ?? 'smarthome123',
  entities: [SensorReading, Node, Alert, AutomationRule, Schedule, User],
  // synchronize în dev creează automat tabelele fără migrări
  synchronize: process.env.NODE_ENV !== 'production',
  logging: false,
  ssl: false,
});
