import axios from 'axios';
import { API_BASE } from './config';
import { resolveHost, invalidateHost } from './discovery';
import { useAppStore } from '../store';
import { SensorReading, AlertItem, NodeInfo, AutomationRule } from '../types';

const client = axios.create({ baseURL: API_BASE });

// Descoperă serverul (acasă / hotspot / rețea nouă) + injectează JWT
client.interceptors.request.use(async (config) => {
  const host = await resolveHost();
  config.baseURL = `${host}/api`;

  const token = useAppStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 → logout automat (doar dacă există un token — evită loop la login)
// Eroare de rețea (fără răspuns) → redescoperim serverul la următoarea cerere
client.interceptors.response.use(
  (r) => r,
  (error) => {
    if (!error.response) {
      invalidateHost();
    } else if (error.response.status === 401 && useAppStore.getState().token) {
      useAppStore.getState().logout();
    }
    return Promise.reject(error);
  },
);

export const api = {
  auth: {
    login: (username: string, password: string) =>
      client.post<{ access_token: string; user: { id: number; username: string } }>(
        '/auth/login', { username, password },
      ).then((r) => r.data),
  },

  sensors: {
    latest: () =>
      client.get<Record<string, SensorReading>>('/sensors/latest').then((r) => r.data),

    history: (nodeId: string, from?: string, to?: string, limit = 200) =>
      client.get<SensorReading[]>('/sensors/history', {
        params: { nodeId, from, to, limit },
      }).then((r) => r.data),

    nodes: () =>
      client.get<NodeInfo[]>('/sensors/nodes').then((r) => r.data),
  },

  alerts: {
    list: (limit = 50) =>
      client.get<AlertItem[]>('/alerts', { params: { limit } }).then((r) => r.data),

    unreadCount: () =>
      client.get<number>('/alerts/unread-count').then((r) => r.data),

    acknowledge: (id: number) =>
      client.patch<AlertItem>(`/alerts/${id}/acknowledge`).then((r) => r.data),
  },

  commands: {
    send: (nodeId: string, action: string, extras?: Record<string, unknown>) =>
      client.post(`/commands/${nodeId}`, { action, ...extras }).then((r) => r.data),
  },

  rules: {
    list: () =>
      client.get<AutomationRule[]>('/rules').then((r) => r.data),

    create: (rule: Partial<AutomationRule>) =>
      client.post<AutomationRule>('/rules', rule).then((r) => r.data),

    update: (id: number, rule: Partial<AutomationRule>) =>
      client.put<AutomationRule>(`/rules/${id}`, rule).then((r) => r.data),

    remove: (id: number) =>
      client.delete(`/rules/${id}`).then((r) => r.data),
  },

  setup: {
    status: () =>
      client.get<{ mode: string; ssid?: string; ip?: string }>('/setup/status').then((r) => r.data),

    scanNetworks: () =>
      client.get<{ ssid: string; signal: number; secured: boolean; connected: boolean }[]>(
        '/setup/networks'
      ).then((r) => r.data),

    connectToNetwork: (ssid: string, password: string) =>
      client.post<{ success: boolean; message: string }>(
        '/setup/connect', { ssid, password }
      ).then((r) => r.data),
  },
};
