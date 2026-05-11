import { Module } from '@nestjs/common';
import { SimulatorService } from './simulator.service';
import { SensorsModule } from '../sensors/sensors.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [SensorsModule, UsersModule],
  providers: [SimulatorService],
})
export class SimulatorModule {}
