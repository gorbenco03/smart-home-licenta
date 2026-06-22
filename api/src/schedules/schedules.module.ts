import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Schedule } from './schedule.entity';
import { SchedulesService } from './schedules.service';
import { SchedulesController } from './schedules.controller';
import { CommandsModule } from '../commands/commands.module';

@Module({
  imports: [TypeOrmModule.forFeature([Schedule]), CommandsModule],
  providers: [SchedulesService],
  controllers: [SchedulesController],
})
export class SchedulesModule {}
