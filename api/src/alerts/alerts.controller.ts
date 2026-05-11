import { Controller, Get, Patch, Param, ParseIntPipe, UseGuards, Query, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AlertsService } from './alerts.service';

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private alertsService: AlertsService) {}

  @Get()
  findAll(@Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number) {
    return this.alertsService.findAll(limit);
  }

  @Get('unread-count')
  countUnread() {
    return this.alertsService.countUnread();
  }

  @Patch(':id/acknowledge')
  acknowledge(@Param('id', ParseIntPipe) id: number) {
    return this.alertsService.acknowledge(id);
  }
}
