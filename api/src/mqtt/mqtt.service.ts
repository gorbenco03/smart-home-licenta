import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as mqtt from 'mqtt';
import { SensorsService } from '../sensors/sensors.service';
import { AlertsService } from '../alerts/alerts.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private client: mqtt.MqttClient | null = null;

  constructor(
    private sensorsService: SensorsService,
    private alertsService: AlertsService,
    private eventEmitter: EventEmitter2,
  ) {}

  onModuleInit() {
    // MQTT activ doar când SIMULATE=false (hardware real)
    if (process.env.SIMULATE === 'true') {
      console.log('[MQTT] Dezactivat — folosim simulatorul');
      return;
    }

    const url  = process.env.MQTT_URL  ?? 'mqtt://localhost:1883';
    const user = process.env.MQTT_USER ?? 'nestjs_api';
    const pass = process.env.MQTT_PASS ?? '';

    this.client = mqtt.connect(url, {
      username: user,
      password: pass,
      clientId: 'nestjs_gateway',
      reconnectPeriod: 5000,
    });

    this.client.on('connect', () => {
      console.log('[MQTT] Conectat la Mosquitto');
      this.client.subscribe('smarthome/+/sensors', { qos: 1 });
      this.client.subscribe('smarthome/alerts',    { qos: 2 });
      this.client.subscribe('smarthome/+/status',  { qos: 1 });
    });

    this.client.on('message', (topic, payload) => {
      this.handleMessage(topic, payload.toString());
    });

    this.client.on('error', (err) => {
      console.error('[MQTT] Eroare:', err.message);
    });

    // Ascultă comenzi din API și le publică pe MQTT
    this.eventEmitter.on('command.sent', ({ nodeId, command }) => {
      const topic = `smarthome/${nodeId}/commands`;
      this.client?.publish(topic, JSON.stringify(command), { qos: 1 });
    });
  }

  private async handleMessage(topic: string, payload: string) {
    try {
      const data = JSON.parse(payload);

      if (topic.endsWith('/sensors')) {
        await this.sensorsService.saveReading({
          nodeId:      data.nodeId      ?? data.node_id,
          location:    data.location,
          temperature: data.temperature ?? data.sensors?.temperature,
          humidity:    data.humidity    ?? data.sensors?.humidity,
          gasLevel:    data.gasLevel    ?? data.sensors?.gas_level,
          gasAlert:    data.gasAlert    ?? data.sensors?.gas_alert ?? false,
          motion:      data.motion      ?? data.sensors?.motion ?? false,
          lightLux:    data.lightLux    ?? data.sensors?.light_lux,
        });
      } else if (topic === 'smarthome/alerts') {
        await this.alertsService.create({
          nodeId:    data.node_id,
          alertType: data.alert_type,
          severity:  data.alert_type === 'GAS_DETECTED' ? 'critical' : 'medium',
          location:  data.location,
          details:   data.details,
        });
      } else if (topic.endsWith('/status') && topic.startsWith('smarthome/')) {
        await this.sensorsService.updateNodeStatus(data);
      }
    } catch (e) {
      console.error(`[MQTT] Eroare procesare ${topic}:`, e.message);
    }
  }

  onModuleDestroy() {
    this.client?.end();
  }
}
