import { io, Socket } from 'socket.io-client';
import { WS_HOST } from './config';
import { useAppStore } from '../store';
import { SensorReading, AlertItem } from '../types';

let socket: Socket | null = null;

export function connectSocket() {
  // Dacă există deja un socket conectat sau în curs de conectare, nu crea altul
  if (socket && (socket.connected || socket.active)) {
    return socket;
  }

  // Închide orice socket vechi înainte de a crea unul nou
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  const token = useAppStore.getState().token;

  socket = io(`${WS_HOST}/live`, {
    auth: { token },
    transports: ['websocket'],
    reconnectionDelay: 3000,
    reconnectionAttempts: Infinity,
    autoConnect: true,
  });

  socket.on('connect', () => {
    console.log('[WS] Conectat la server');
    useAppStore.getState().setConnected(true);
  });

  socket.on('disconnect', (reason) => {
    console.log('[WS] Deconectat:', reason);
    useAppStore.getState().setConnected(false);
  });

  socket.on('connect_error', (err) => {
    console.log('[WS] Eroare conectare:', err.message);
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
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  useAppStore.getState().setConnected(false);
}

export function getSocket() {
  return socket;
}
