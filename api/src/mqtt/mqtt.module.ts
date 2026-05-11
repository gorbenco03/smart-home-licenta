import { Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { SensorsModule } from '../sensors/sensors.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [SensorsModule, AlertsModule],
  providers: [MqttService],
})
export class MqttModule {}
