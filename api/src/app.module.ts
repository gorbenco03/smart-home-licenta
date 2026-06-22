import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { databaseConfig } from './config/database.config';
import { SchedulesModule } from './schedules/schedules.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SensorsModule } from './sensors/sensors.module';
import { AlertsModule } from './alerts/alerts.module';
import { RulesModule } from './rules/rules.module';
import { CommandsModule } from './commands/commands.module';
import { MqttModule } from './mqtt/mqtt.module';
import { SimulatorModule } from './simulator/simulator.module';
import { SetupModule } from './setup/setup.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({ useFactory: databaseConfig }),
    SchedulesModule,
    AuthModule,
    UsersModule,
    SensorsModule,
    AlertsModule,
    RulesModule,
    CommandsModule,
    MqttModule,
    SimulatorModule,
    SetupModule,
  ],
})
export class AppModule {}
