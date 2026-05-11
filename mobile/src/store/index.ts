import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';
import { SensorReading, AlertItem } from '../types';

const storage = new MMKV({ id: 'smarthome' });

interface AppStore {
  // Auth
  token: string | null;
  user: { id: number; username: string } | null;
  setAuth: (token: string, user: { id: number; username: string }) => void;
  logout: () => void;

  // WebSocket
  connected: boolean;
  setConnected: (v: boolean) => void;

  // Live sensor data — ultimele citiri per nod
  latestReadings: Record<string, SensorReading>;
  setLatestReading: (r: SensorReading) => void;

  // Alerte
  alerts: AlertItem[];
  unreadCount: number;
  addAlert: (a: AlertItem) => void;
  setAlerts: (a: AlertItem[]) => void;
  acknowledgeAlert: (id: number) => void;
  clearUnread: () => void;

  // Status noduri
  nodeStatus: Record<string, boolean>;
  setNodeStatus: (nodeId: string, online: boolean) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  // Restore token din MMKV persistent storage
  token: storage.getString('token') ?? null,
  user:  storage.getString('user') ? JSON.parse(storage.getString('user')!) : null,

  setAuth: (token, user) => {
    storage.set('token', token);
    storage.set('user', JSON.stringify(user));
    set({ token, user });
  },

  logout: () => {
    storage.delete('token');
    storage.delete('user');
    set({ token: null, user: null, latestReadings: {}, alerts: [], unreadCount: 0 });
  },

  connected: false,
  setConnected: (connected) => set({ connected }),

  latestReadings: {},
  setLatestReading: (reading) =>
    set((state) => ({
      latestReadings: { ...state.latestReadings, [reading.nodeId]: reading },
    })),

  alerts: [],
  unreadCount: 0,
  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts].slice(0, 100),
      unreadCount: state.unreadCount + 1,
    })),
  setAlerts: (alerts) => set({ alerts }),
  acknowledgeAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === id ? { ...a, acknowledged: true } : a,
      ),
    })),
  clearUnread: () => set({ unreadCount: 0 }),

  nodeStatus: {},
  setNodeStatus: (nodeId, online) =>
    set((state) => ({
      nodeStatus: { ...state.nodeStatus, [nodeId]: online },
    })),
}));
