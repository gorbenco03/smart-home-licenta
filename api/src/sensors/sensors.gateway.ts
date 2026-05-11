import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/live',
})
export class SensorsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedClients = 0;

  constructor(private jwtService: JwtService) {}

  handleConnection(client: Socket) {
    // Validare opțională JWT la conectare WebSocket
    const token = client.handshake.auth?.token as string;
    if (token) {
      try {
        this.jwtService.verify(token);
      } catch {
        client.disconnect();
        return;
      }
    }
    this.connectedClients++;
    console.log(`[WS] Client conectat. Total: ${this.connectedClients}`);
  }

  handleDisconnect() {
    this.connectedClients--;
    console.log(`[WS] Client deconectat. Total: ${this.connectedClients}`);
  }

  @OnEvent('sensor.reading')
  handleSensorReading(data: any) {
    this.server.emit('sensor_update', data);
  }

  @OnEvent('alert.new')
  handleNewAlert(data: any) {
    this.server.emit('alert', data);
  }

  @OnEvent('node.status')
  handleNodeStatus(data: any) {
    this.server.emit('node_status', data);
  }

  @OnEvent('rule.triggered')
  handleRuleTriggered(data: any) {
    this.server.emit('rule_triggered', {
      nodeId: data.nodeId,
      ruleName: data.rule.name,
      actionType: data.rule.actionType,
    });
  }
}
