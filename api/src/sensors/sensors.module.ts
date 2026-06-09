import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SensorsService } from './sensors.service';
import { SensorsController } from './sensors.controller';
import { SensorsGateway } from './sensors.gateway';
import { SensorReading } from './entities/sensor-reading.entity';
import { Node } from './entities/node.entity';
import { AlertsModule } from '../alerts/alerts.module';
import { AutomationRule } from '../rules/rule.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SensorReading, Node, AutomationRule]),
    AlertsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'dev_secret',
      }),
    }),
  ],
  providers: [SensorsService, SensorsGateway],
  controllers: [SensorsController],
  exports: [SensorsService],
})
export class SensorsModule {}
