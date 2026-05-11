import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
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
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev_secret',
    }),
  ],
  providers: [SensorsService, SensorsGateway],
  controllers: [SensorsController],
  exports: [SensorsService],
})
export class SensorsModule {}
