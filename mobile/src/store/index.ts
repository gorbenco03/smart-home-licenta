import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SensorReading, AlertItem } from '../types';

interface AppStore {
  // Auth
  token: string | null;
  user: { id: number; username: string } | null;
  setAuth: (token: string, user: { id: number; username: string }) => void;
  logout: () => void;
  loadToken: () => Promise<void>;   // apelat la startup

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
  token: null,
  user:  null,

  setAuth: (token, user) => {
    AsyncStorage.setItem('token', token);
    AsyncStorage.setItem('user', JSON.stringify(user));
    set({ token, user });
  },

  logout: () => {
    AsyncStorage.removeItem('token');
    AsyncStorage.removeItem('user');
    set({ token: null, user: null, latestReadings: {}, alerts: [], unreadCount: 0 });
  },

  // Apelat o singură dată în App.tsx la mount
  loadToken: async () => {
    const token = await AsyncStorage.getItem('token');
    const userStr = await AsyncStorage.getItem('user');
    if (token) {
      set({
        token,
        user: userStr ? JSON.parse(userStr) : null,
      });
    }
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
