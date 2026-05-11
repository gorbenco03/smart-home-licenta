import { io, Socket } from 'socket.io-client';
import { WS_HOST } from './config';
import { useAppStore } from '../store';
import { SensorReading, AlertItem } from '../types';

let socket: Socket | null = null;

export function connectSocket() {
  const token = useAppStore.getState().token;

  socket = io(`${WS_HOST}/live`, {
    auth: { token },
    transports: ['websocket'],
    reconnectionDelay: 3000,
    reconnectionAttempts: Infinity,
  });

  socket.on('connect', () => {
    console.log('[WS] Conectat la server');
    useAppStore.getState().setConnected(true);
  });

  socket.on('disconnect', () => {
    console.log('[WS] Deconectat');
    useAppStore.getState().setConnected(false);
  });

  socket.on('sensor_update', (reading: SensorReading) => {
    useAppStore.getState().setLatestReading(reading);
  });

  socket.on('alert', (alert: AlertItem) => {
    useAppStore.getState().addAlert(alert);
  });

  socket.on('node_status', (data: { nodeId: string; online: boolean }) => {
    useAppStore.getState().setNodeStatus(data.nodeId, data.online);
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocket() {
  return socket;
}
