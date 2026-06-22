import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface NodeCommand {
  action:
    | 'relay_on'    | 'relay_off'    | 'relay_toggle'   // relay vechi (backward compat)
    | 'led_on'      | 'led_off'      | 'led_toggle'      // control LED individual (led: 0..2)
    | 'fan_on'      | 'fan_off'                          // control ventilator manual
    | 'fan_auto'    | 'fan_threshold'                    // mod automat + prag temperatură
    | 'motion_arm'  | 'motion_disarm'                    // armare/dezarmare PIR din telefon
    | 'buzzer_beep' | 'servo_move'   | 'all_off'         // acțiuni existente
    | 'wifi_update';                                      // actualizare configurare WiFi
  relay?: number;       // 0–2 (backward compat)
  led?: number;         // 0–2 (index LED pentru led_on/off/toggle)
  count?: number;       // număr bipuri (buzzer_beep)
  servoAngle?: number;  // 0–180 grade (servo_move)
  value?: number;       // valoare generică (ex. prag temperatură fan_threshold)
  [key: string]: unknown; // câmpuri suplimentare pentru wifi_update etc.
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
