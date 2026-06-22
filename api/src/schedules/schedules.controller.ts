import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SchedulesService } from './schedules.service';
import { Schedule } from './schedule.entity';

@ApiTags('schedules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('schedules')
export class SchedulesController {
  constructor(private schedulesService: SchedulesService) {}

  @Get()
  findAll() { return this.schedulesService.findAll(); }

  @Post()
  create(@Body() body: Partial<Schedule>) { return this.schedulesService.create(body); }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<Schedule>) {
    return this.schedulesService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) { return this.schedulesService.remove(id); }
}
