import { Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SensorsService } from './sensors.service';

@ApiTags('sensors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sensors')
export class SensorsController {
  constructor(private sensorsService: SensorsService) {}

  @Get('latest')
  getLatest() {
    return this.sensorsService.getLatest();
  }

  @Get('nodes')
  getNodes() {
    return this.sensorsService.getNodes();
  }

  @Get('history')
  @ApiQuery({ name: 'nodeId', required: true })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date string' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date string' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getHistory(
    @Query('nodeId') nodeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit', new DefaultValuePipe(200), ParseIntPipe) limit?: number,
  ) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const toDate   = to   ? new Date(to)   : new Date();
    return this.sensorsService.getHistory(nodeId, fromDate, toDate, limit);
  }
}
