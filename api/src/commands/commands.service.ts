import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface NodeCommand {
  action: 'relay_on' | 'relay_off' | 'relay_toggle' | 'buzzer_beep' | 'all_off';
  relay?: number;
  count?: number;
}

@Injectable()
export class CommandsService {
  constructor(private eventEmitter: EventEmitter2) {}

  send(nodeId: string, command: NodeCommand): { sent: boolean; nodeId: string; command: NodeCommand } {
    // În producție: publică pe MQTT home/{nodeId}/commands
    // În development: emite event intern
    console.log(`[CMD] → ${nodeId}:`, command);
    this.eventEmitter.emit('command.sent', { nodeId, command });

    return { sent: true, nodeId, command };
  }
}
