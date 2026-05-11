import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RulesService } from './rules.service';
import { AutomationRule } from './rule.entity';

@ApiTags('rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rules')
export class RulesController {
  constructor(private rulesService: RulesService) {}

  @Get()
  findAll() { return this.rulesService.findAll(); }

  @Post()
  create(@Body() body: Partial<AutomationRule>) { return this.rulesService.create(body); }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<AutomationRule>) {
    return this.rulesService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) { return this.rulesService.remove(id); }
}
