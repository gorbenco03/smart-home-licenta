import { Controller, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CommandsService, NodeCommand } from './commands.service';

@ApiTags('commands')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('commands')
export class CommandsController {
  constructor(private commandsService: CommandsService) {}

  @Post(':nodeId')
  send(@Param('nodeId') nodeId: string, @Body() command: NodeCommand) {
    return this.commandsService.send(nodeId, command);
  }
}
