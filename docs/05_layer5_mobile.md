# Layer 5 — Aplicație Mobilă React Native

> **Document:** 05 din 05
> **Prerequisite:** Layer 4 complet — API răspunde, WebSocket emite date live
> **Timp estimat:** 4-5 ore
> **Ce obții la final:** Aplicație mobilă completă iOS/Android cu date live, control, grafice, notificări

---

## 1. Setup proiect Expo

```bash
# Pe calculatorul tău de dezvoltare
npx create-expo-app SmartHome --template blank-typescript
cd SmartHome

# Dependențe principale
npx expo install \
  expo-notifications \
  expo-device \
  expo-constants \
  expo-background-fetch \
  expo-task-manager

npm install \
  @react-navigation/native \
  @react-navigation/bottom-tabs \
  @react-navigation/stack \
  react-native-screens \
  react-native-safe-area-context \
  react-native-gesture-handler \
  socket.io-client \
  axios \
  react-query \
  @tanstack/react-query \
  react-native-mmkv \
  react-native-gifted-charts \
  react-native-svg \
  date-fns \
  zustand

npx expo install react-native-reanimated
```

### 1.1 app.json — configurare Expo

```json
{
  "expo": {
    "name": "Smart Home",
    "slug": "smart-home",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "backgroundColor": "#0f172a"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0f172a"
      },
      "permissions": [
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE"
      ]
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.smarthome.local"
    },
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#0f172a"
        }
      ]
    ]
  }
}
```

---

## 2. Structura proiectului

```
SmartHome/
├── app.json
├── App.tsx                        ← entry point
├── src/
│   ├── config.ts                  ← IP gateway, setări
│   ├── store/
│   │   └── useStore.ts            ← Zustand global state
│   ├── services/
│   │   ├── api.ts                 ← Axios + toate request-urile
│   │   ├── websocket.ts           ← Socket.io client
│   │   ├── notifications.ts       ← Expo Notifications setup
│   │   └── storage.ts             ← MMKV cache offline
│   ├── navigation/
│   │   └── AppNavigator.tsx       ← Bottom tabs + Stack
│   ├── screens/
│   │   ├── DashboardScreen.tsx    ← date live toate nodurile
│   │   ├── HistoryScreen.tsx      ← grafice istorice
│   │   ├── ControlScreen.tsx      ← control relay/buzzer
│   │   ├── AlertsScreen.tsx       ← lista alerte
│   │   ├── RulesScreen.tsx        ← gestiune automatizări
│   │   └── SettingsScreen.tsx     ← IP gateway, token
│   ├── components/
│   │   ├── SensorCard.tsx         ← card senzor individual
│   │   ├── AlertBadge.tsx         ← badge număr alerte necitite
│   │   ├── NodeStatusBar.tsx      ← online/offline indicator
│   │   ├── RelayControl.tsx       ← buton toggle relay
│   │   └── TemperatureChart.tsx   ← grafic temperatură
│   └── hooks/
│       ├── useSensors.ts          ← date live + cache
│       ├── useAlerts.ts           ← alerte + polling
│       └── useWebSocket.ts        ← conexiune WS
```

---

## 3. config.ts — setări globale

```typescript
// src/config.ts

// Schimbă IP-ul la cel al Raspberry Pi tău
export const GATEWAY_IP   = '192.168.1.100';
export const API_BASE_URL = `http://${GATEWAY_IP}:3000/api`;
export const WS_URL       = `http://${GATEWAY_IP}:3000`;

export const COLORS = {
  bg:          '#0f172a',   // slate-900
  surface:     '#1e293b',   // slate-800
  surfaceLight:'#334155',   // slate-700
  border:      '#475569',   // slate-600
  text:        '#f1f5f9',   // slate-100
  textMuted:   '#94a3b8',   // slate-400
  primary:     '#38bdf8',   // sky-400
  success:     '#4ade80',   // green-400
  warning:     '#fb923c',   // orange-400
  danger:      '#f87171',   // red-400
  purple:      '#a78bfa',   // violet-400
};

export const REFRESH_INTERVAL_MS = 30_000;  // polling fallback
```

---

## 4. services/storage.ts — cache offline MMKV

```typescript
// src/services/storage.ts

import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'smarthome-storage' });

export const Cache = {
  // Token JWT
  getToken:   ()           => storage.getString('auth_token'),
  setToken:   (t: string)  => storage.set('auth_token', t),
  clearToken: ()           => storage.delete('auth_token'),

  // Ultimele citiri (fallback offline)
  getLatestReadings: () => {
    const raw = storage.getString('latest_readings');
    return raw ? JSON.parse(raw) : null;
  },
  setLatestReadings: (data: any) =>
    storage.set('latest_readings', JSON.stringify(data)),

  // IP gateway (configurabil din Settings)
  getGatewayIp: ()           => storage.getString('gateway_ip') || '192.168.1.100',
  setGatewayIp: (ip: string) => storage.set('gateway_ip', ip),

  // Alerte necitite (pentru badge)
  getUnreadCount: ()           => storage.getNumber('unread_alerts') || 0,
  setUnreadCount: (n: number)  => storage.set('unread_alerts', n),
};
```

---

## 5. services/api.ts — toate request-urile HTTP

```typescript
// src/services/api.ts

import axios, { AxiosInstance } from 'axios';
import { Cache } from './storage';
import { API_BASE_URL } from '../config';

// Instanță Axios cu interceptori
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: `http://${Cache.getGatewayIp()}:3000/api`,
    timeout: 8000,
  });

  // Adaugă automat token JWT la fiecare request
  client.interceptors.request.use((config) => {
    const token = Cache.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Gestionează 401 — redirect la login
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        Cache.clearToken();
        // Navigare la Login gestionată prin Zustand store
      }
      return Promise.reject(error);
    }
  );

  return client;
};

export const api = createApiClient();

// ─── Auth ──────────────────────────────────────────────
export const authApi = {
  login: async (username: string, password: string) => {
    const { data } = await api.post('/auth/login', { username, password });
    Cache.setToken(data.access_token);
    return data;
  },
  logout: () => Cache.clearToken(),
};

// ─── Sensors ───────────────────────────────────────────
export const sensorsApi = {
  getLatest: async () => {
    try {
      const { data } = await api.get('/sensors/latest');
      Cache.setLatestReadings(data);  // salvează în cache pentru offline
      return data;
    } catch {
      // Fallback offline
      return Cache.getLatestReadings() || [];
    }
  },

  getHistory: (params: {
    nodeId?:   string;
    from?:     string;
    to?:       string;
    interval?: string;
    limit?:    number;
  }) => api.get('/sensors/history', { params }).then(r => r.data),

  getStats: (nodeId: string, hours = 24) =>
    api.get(`/sensors/stats/${nodeId}`, { params: { hours } }).then(r => r.data),
};

// ─── Commands ──────────────────────────────────────────
export const commandsApi = {
  relayOn:  (nodeId: string, relay: number) =>
    api.post(`/commands/${nodeId}/relay/${relay}/on`).then(r => r.data),

  relayOff: (nodeId: string, relay: number) =>
    api.post(`/commands/${nodeId}/relay/${relay}/off`).then(r => r.data),

  buzzerBeep: (nodeId: string, count = 1) =>
    api.post(`/commands/${nodeId}`, { action: 'buzzer_beep', count }).then(r => r.data),

  allOff: (nodeId: string) =>
    api.post(`/commands/${nodeId}`, { action: 'all_off' }).then(r => r.data),
};

// ─── Alerts ────────────────────────────────────────────
export const alertsApi = {
  getAll: (acknowledged?: boolean) =>
    api.get('/alerts', { params: { acknowledged } }).then(r => r.data),

  getUnreadCount: () =>
    api.get('/alerts/unread-count').then(r => r.data.count),

  acknowledge: (id: number) =>
    api.patch(`/alerts/${id}/acknowledge`).then(r => r.data),

  acknowledgeAll: () =>
    api.patch('/alerts/acknowledge-all').then(r => r.data),
};

// ─── Rules ─────────────────────────────────────────────
export const rulesApi = {
  getAll:  ()              => api.get('/rules').then(r => r.data),
  create:  (dto: any)      => api.post('/rules', dto).then(r => r.data),
  update:  (id: number, dto: any) => api.put(`/rules/${id}`, dto).then(r => r.data),
  remove:  (id: number)    => api.delete(`/rules/${id}`).then(r => r.data),
  toggle:  (id: number, enabled: boolean) =>
    api.put(`/rules/${id}`, { enabled }).then(r => r.data),
};

// ─── ML ────────────────────────────────────────────────
export const mlApi = {
  getStatus: () => api.get('/ml/status').then(r => r.data),
};
```

---

## 6. services/websocket.ts — date live

```typescript
// src/services/websocket.ts

import { io, Socket } from 'socket.io-client';
import { WS_URL } from '../config';
import { Cache } from './storage';

type EventCallback = (data: any) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, EventCallback[]> = new Map();
  private _connected = false;

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(WS_URL, {
      transports:      ['websocket'],
      reconnection:    true,
      reconnectionDelay: 3000,
      reconnectionAttempts: 10,
      namespace:       '/live',
    });

    this.socket.on('connect', () => {
      this._connected = true;
      console.log('[WS] Conectat la gateway');
      this.emit('connection_change', { connected: true });
    });

    this.socket.on('disconnect', (reason) => {
      this._connected = false;
      console.log('[WS] Deconectat:', reason);
      this.emit('connection_change', { connected: false });
    });

    // Redirecționează evenimentele server → listeners locali
    this.socket.on('sensor_update', (data) => this.emit('sensor_update', data));
    this.socket.on('alert',         (data) => this.emit('alert', data));
    this.socket.on('node_status',   (data) => this.emit('node_status', data));
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this._connected = false;
  }

  on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: EventCallback) {
    const eventListeners = this.listeners.get(event) || [];
    this.listeners.set(
      event,
      eventListeners.filter(cb => cb !== callback)
    );
  }

  private emit(event: string, data: any) {
    (this.listeners.get(event) || []).forEach(cb => cb(data));
  }

  get connected() { return this._connected; }
}

// Singleton
export const wsService = new WebSocketService();
```

---

## 7. hooks/useWebSocket.ts

```typescript
// src/hooks/useWebSocket.ts

import { useEffect, useState, useCallback } from 'react';
import { wsService } from '../services/websocket';
import { useStore } from '../store/useStore';
import { scheduleLocalNotification } from '../services/notifications';

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const { updateSensorData, addAlert } = useStore();

  useEffect(() => {
    wsService.connect();

    const onConnectionChange = ({ connected }: { connected: boolean }) => {
      setConnected(connected);
    };

    const onSensorUpdate = (data: any) => {
      updateSensorData(data.node_id, data.sensors);
    };

    const onAlert = async (data: any) => {
      addAlert(data);

      // Notificare push locală imediată
      await scheduleLocalNotification({
        title:    getAlertTitle(data.alert_type),
        body:     getAlertBody(data),
        data:     { alertId: data.id, type: data.alert_type },
        priority: data.severity === 'critical' ? 'max' : 'high',
      });
    };

    wsService.on('connection_change', onConnectionChange);
    wsService.on('sensor_update',     onSensorUpdate);
    wsService.on('alert',             onAlert);

    return () => {
      wsService.off('connection_change', onConnectionChange);
      wsService.off('sensor_update',     onSensorUpdate);
      wsService.off('alert',             onAlert);
    };
  }, []);

  return { connected };
}

function getAlertTitle(type: string): string {
  const titles: Record<string, string> = {
    GAS_DETECTED:  '⚠️ Alertă gaz!',
    MOTION_NIGHT:  '🚶 Mișcare detectată',
    ML_ANOMALY:    '🤖 Anomalie detectată',
    ALERT_HEAT:    '🌡️ Temperatură ridicată',
  };
  return titles[type] || '🔔 Alertă Smart Home';
}

function getAlertBody(data: any): string {
  const loc = data.location || data.node_id;
  const bodies: Record<string, string> = {
    GAS_DETECTED: `Gaz detectat în ${loc}. Verifică imediat!`,
    MOTION_NIGHT: `Mișcare în ${loc} la ora ${new Date().getHours()}:00`,
    ML_ANOMALY:   `Comportament neobișnuit în ${loc} (scor: ${data.details?.score?.toFixed(2)})`,
  };
  return bodies[data.alert_type] || `Alertă în ${loc}`;
}
```

---

## 8. store/useStore.ts — Zustand global state

```typescript
// src/store/useStore.ts

import { create } from 'zustand';

interface SensorData {
  temperature:  number | null;
  humidity:     number | null;
  gas_level:    number | null;
  gas_alert:    boolean;
  motion:       boolean;
  light_lux:    number | null;
  last_updated: Date;
}

interface Alert {
  id:           number;
  time:         string;
  node_id:      string;
  alert_type:   string;
  severity:     string;
  location:     string;
  details:      any;
  acknowledged: boolean;
}

interface AppState {
  // Auth
  isAuthenticated: boolean;
  setAuthenticated: (v: boolean) => void;

  // Sensors — map nodeId → datele lui
  sensorData:       Record<string, SensorData>;
  updateSensorData: (nodeId: string, data: Partial<SensorData>) => void;

  // Node status
  nodeOnline:       Record<string, boolean>;
  setNodeOnline:    (nodeId: string, online: boolean) => void;

  // Alerte
  alerts:           Alert[];
  addAlert:         (alert: Alert) => void;
  setAlerts:        (alerts: Alert[]) => void;
  acknowledgeAlert: (id: number) => void;
  unreadCount:      number;

  // WS connection
  wsConnected: boolean;
  setWsConnected: (v: boolean) => void;

  // Relay state (optimistic UI)
  relayStates:    Record<string, boolean[]>;
  setRelayState:  (nodeId: string, relay: number, state: boolean) => void;
}

export const useStore = create<AppState>((set, get) => ({
  isAuthenticated: false,
  setAuthenticated: (v) => set({ isAuthenticated: v }),

  sensorData: {},
  updateSensorData: (nodeId, data) =>
    set((state) => ({
      sensorData: {
        ...state.sensorData,
        [nodeId]: {
          ...state.sensorData[nodeId],
          ...data,
          last_updated: new Date(),
        },
      },
    })),

  nodeOnline:    {},
  setNodeOnline: (nodeId, online) =>
    set((state) => ({
      nodeOnline: { ...state.nodeOnline, [nodeId]: online },
    })),

  alerts:    [],
  unreadCount: 0,
  addAlert:  (alert) =>
    set((state) => ({
      alerts:      [alert, ...state.alerts].slice(0, 100),
      unreadCount: state.unreadCount + 1,
    })),
  setAlerts: (alerts) =>
    set({
      alerts,
      unreadCount: alerts.filter(a => !a.acknowledged).length,
    }),
  acknowledgeAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map(a =>
        a.id === id ? { ...a, acknowledged: true } : a
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),

  wsConnected:    false,
  setWsConnected: (v) => set({ wsConnected: v }),

  relayStates:   { esp32_node_a: [false, false, false, false] },
  setRelayState: (nodeId, relay, state) =>
    set((s) => {
      const current = s.relayStates[nodeId] || [false, false, false, false];
      const updated = [...current];
      updated[relay] = state;
      return { relayStates: { ...s.relayStates, [nodeId]: updated } };
    }),
}));
```

---

## 9. screens/DashboardScreen.tsx

```typescript
// src/screens/DashboardScreen.tsx

import React, { useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, ActivityIndicator
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { sensorsApi } from '../services/api';
import { useStore } from '../store/useStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { SensorCard } from '../components/SensorCard';
import { NodeStatusBar } from '../components/NodeStatusBar';
import { COLORS } from '../config';

export function DashboardScreen() {
  const { connected } = useWebSocket();
  const { sensorData, nodeOnline } = useStore();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey:    ['sensors', 'latest'],
    queryFn:     sensorsApi.getLatest,
    refetchInterval: 30_000,   // polling fallback dacă WS cade
    staleTime:   25_000,
  });

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} size="large" />
        <Text style={styles.loadingText}>Conectare la gateway...</Text>
      </View>
    );
  }

  const nodes = data || [];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* Status conexiune WebSocket */}
      <View style={[styles.wsBar, { backgroundColor: connected ? '#14532d' : '#450a0a' }]}>
        <View style={[styles.wsDot, { backgroundColor: connected ? COLORS.success : COLORS.danger }]} />
        <Text style={styles.wsText}>
          {connected ? 'Live — date în timp real' : 'Offline — date din cache'}
        </Text>
      </View>

      {nodes.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Niciun nod ESP32 conectat</Text>
          <Text style={styles.emptySubtext}>Verifică că ESP32-urile sunt pornite</Text>
        </View>
      ) : (
        nodes.map((node: any) => (
          <View key={node.node_id} style={styles.nodeSection}>
            <NodeStatusBar
              nodeId={node.node_id}
              location={node.location}
              online={nodeOnline[node.node_id] ?? true}
              lastSeen={node.time}
            />

            <View style={styles.cardsGrid}>
              <SensorCard
                icon="🌡️"
                label="Temperatură"
                value={node.temperature}
                unit="°C"
                color={getTemperatureColor(node.temperature)}
              />
              <SensorCard
                icon="💧"
                label="Umiditate"
                value={node.humidity}
                unit="%"
                color={COLORS.primary}
              />
              <SensorCard
                icon="💨"
                label="Gaz"
                value={node.gas_level}
                unit="adc"
                color={node.gas_alert ? COLORS.danger : COLORS.success}
                alert={node.gas_alert}
              />
              <SensorCard
                icon="☀️"
                label="Lumină"
                value={node.light_lux}
                unit="lux"
                color={COLORS.warning}
              />
              <SensorCard
                icon={node.motion ? '🚶' : '😶'}
                label="Mișcare"
                value={node.motion ? 'Da' : 'Nu'}
                color={node.motion ? COLORS.warning : COLORS.textMuted}
                isText
              />
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function getTemperatureColor(temp: number | null): string {
  if (!temp) return COLORS.textMuted;
  if (temp < 10)  return '#38bdf8';  // albastru — frig
  if (temp < 22)  return COLORS.success;
  if (temp < 28)  return COLORS.warning;
  return COLORS.danger;
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.bg },
  centered:     { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText:  { color: COLORS.textMuted, marginTop: 12, fontSize: 15 },
  emptyText:    { color: COLORS.text, fontSize: 17, fontWeight: '600' },
  emptySubtext: { color: COLORS.textMuted, fontSize: 14, marginTop: 6 },
  wsBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8, gap: 8,
  },
  wsDot:    { width: 8, height: 8, borderRadius: 4 },
  wsText:   { color: COLORS.text, fontSize: 13 },
  nodeSection: { marginBottom: 8 },
  cardsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, gap: 10,
    paddingBottom: 12,
  },
});
```

---

## 10. components/SensorCard.tsx

```typescript
// src/components/SensorCard.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../config';

interface Props {
  icon:    string;
  label:   string;
  value:   number | string | null;
  unit?:   string;
  color:   string;
  alert?:  boolean;
  isText?: boolean;
}

export function SensorCard({ icon, label, value, unit, color, alert, isText }: Props) {
  const displayValue = value === null || value === undefined
    ? '—'
    : isText
      ? String(value)
      : typeof value === 'number'
        ? value.toFixed(1)
        : String(value);

  return (
    <View style={[styles.card, alert && styles.cardAlert]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color }]}>{displayValue}</Text>
        {unit && !isText && (
          <Text style={styles.unit}>{unit}</Text>
        )}
      </View>
      {alert && (
        <View style={styles.alertBadge}>
          <Text style={styles.alertBadgeText}>ALERTĂ</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius:    12,
    padding:         14,
    width:           '47%',
    minHeight:       100,
    borderWidth:     1,
    borderColor:     COLORS.border,
  },
  cardAlert: {
    borderColor:     COLORS.danger,
    backgroundColor: '#1c0a0a',
  },
  icon:  { fontSize: 22, marginBottom: 4 },
  label: { fontSize: 12, color: COLORS.textMuted, marginBottom: 6 },
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  value: { fontSize: 24, fontWeight: '700' },
  unit:  { fontSize: 13, color: COLORS.textMuted, marginBottom: 3 },
  alertBadge: {
    marginTop:       6,
    backgroundColor: COLORS.danger,
    borderRadius:    4,
    paddingHorizontal: 6,
    paddingVertical:   2,
    alignSelf:       'flex-start',
  },
  alertBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
```

---

## 11. screens/HistoryScreen.tsx — grafice

```typescript
// src/screens/HistoryScreen.tsx

import React, { useState } from 'react';
import {
  View, Text, StyleSheet,
  TouchableOpacity, ScrollView, ActivityIndicator
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { LineChart } from 'react-native-gifted-charts';
import { sensorsApi } from '../services/api';
import { COLORS } from '../config';
import { format } from 'date-fns';

type Interval = '1h' | '6h' | '24h' | '7d';

const INTERVALS: { label: string; value: Interval; bucket: string; hours: number }[] = [
  { label: '1h',  value: '1h',  bucket: '2 minutes', hours: 1  },
  { label: '6h',  value: '6h',  bucket: '10 minutes', hours: 6  },
  { label: '24h', value: '24h', bucket: '30 minutes', hours: 24 },
  { label: '7z',  value: '7d',  bucket: '2 hours',    hours: 168 },
];

export function HistoryScreen() {
  const [selectedInterval, setSelectedInterval] = useState<Interval>('24h');
  const [selectedNode, setSelectedNode] = useState('esp32_node_a');

  const interval = INTERVALS.find(i => i.value === selectedInterval)!;
  const from = new Date(Date.now() - interval.hours * 60 * 60 * 1000);

  const { data, isLoading } = useQuery({
    queryKey: ['history', selectedNode, selectedInterval],
    queryFn:  () => sensorsApi.getHistory({
      nodeId:   selectedNode,
      from:     from.toISOString(),
      interval: interval.bucket,
      limit:    200,
    }),
    staleTime: 60_000,
  });

  const tempData = (data || [])
    .filter((d: any) => d.temperature !== null)
    .map((d: any) => ({
      value: parseFloat(parseFloat(d.temperature).toFixed(1)),
      label: format(new Date(d.bucket || d.time), 'HH:mm'),
      dataPointText: '',
    }))
    .slice(-50);   // max 50 puncte pe grafic

  const humData = (data || [])
    .filter((d: any) => d.humidity !== null)
    .map((d: any) => ({
      value: parseFloat(parseFloat(d.humidity).toFixed(1)),
    }))
    .slice(-50);

  return (
    <ScrollView style={styles.container}>
      {/* Selector interval */}
      <View style={styles.intervalRow}>
        {INTERVALS.map(i => (
          <TouchableOpacity
            key={i.value}
            style={[styles.intervalBtn, selectedInterval === i.value && styles.intervalBtnActive]}
            onPress={() => setSelectedInterval(i.value)}
          >
            <Text style={[
              styles.intervalText,
              selectedInterval === i.value && styles.intervalTextActive
            ]}>
              {i.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Selector nod */}
      <View style={styles.nodeRow}>
        {['esp32_node_a', 'esp32_node_b'].map(nodeId => (
          <TouchableOpacity
            key={nodeId}
            style={[styles.nodeBtn, selectedNode === nodeId && styles.nodeBtnActive]}
            onPress={() => setSelectedNode(nodeId)}
          >
            <Text style={styles.nodeText}>
              {nodeId === 'esp32_node_a' ? 'Living' : 'Dormitor'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* Grafic temperatură */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Temperatură (°C)</Text>
            {tempData.length > 0 ? (
              <LineChart
                data={tempData}
                height={180}
                width={320}
                color={COLORS.danger}
                thickness={2}
                hideDataPoints={tempData.length > 20}
                curved
                areaChart
                startFillColor={COLORS.danger}
                startOpacity={0.2}
                endOpacity={0.01}
                yAxisTextStyle={{ color: COLORS.textMuted, fontSize: 11 }}
                xAxisLabelTextStyle={{ color: COLORS.textMuted, fontSize: 9 }}
                backgroundColor="transparent"
                noOfSections={4}
                yAxisColor={COLORS.border}
                xAxisColor={COLORS.border}
                rulesColor={COLORS.surfaceLight}
              />
            ) : (
              <Text style={styles.noData}>Date insuficiente</Text>
            )}
          </View>

          {/* Grafic umiditate */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Umiditate (%)</Text>
            {humData.length > 0 ? (
              <LineChart
                data={humData}
                height={180}
                width={320}
                color={COLORS.primary}
                thickness={2}
                curved
                areaChart
                startFillColor={COLORS.primary}
                startOpacity={0.2}
                endOpacity={0.01}
                yAxisTextStyle={{ color: COLORS.textMuted, fontSize: 11 }}
                xAxisLabelTextStyle={{ color: COLORS.textMuted, fontSize: 9 }}
                backgroundColor="transparent"
                noOfSections={4}
                yAxisColor={COLORS.border}
                xAxisColor={COLORS.border}
                rulesColor={COLORS.surfaceLight}
              />
            ) : (
              <Text style={styles.noData}>Date insuficiente</Text>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.bg },
  intervalRow: {
    flexDirection: 'row', padding: 16, gap: 8,
  },
  intervalBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  intervalBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  intervalText:      { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },
  intervalTextActive:{ color: COLORS.bg },
  nodeRow:     { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  nodeBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    backgroundColor: COLORS.surface, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  nodeBtnActive: { borderColor: COLORS.primary },
  nodeText:      { color: COLORS.text, fontSize: 13 },
  chartCard: {
    margin: 16, marginTop: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  chartTitle: {
    color: COLORS.text, fontSize: 15,
    fontWeight: '600', marginBottom: 16,
  },
  noData: { color: COLORS.textMuted, textAlign: 'center', paddingVertical: 20 },
});
```

---

## 12. screens/ControlScreen.tsx — control relay

```typescript
// src/screens/ControlScreen.tsx

import React, { useState } from 'react';
import {
  View, Text, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert
} from 'react-native';
import { commandsApi } from '../services/api';
import { useStore } from '../store/useStore';
import { COLORS } from '../config';

const RELAY_LABELS = ['Lumină', 'Ventilator', 'Priză 3', 'Priză 4'];
const NODES = [
  { id: 'esp32_node_a', label: 'Living / Bucătărie' },
  { id: 'esp32_node_b', label: 'Dormitor / Baie' },
];

export function ControlScreen() {
  const [loading, setLoading] = useState<string | null>(null);
  const { relayStates, setRelayState } = useStore();

  const handleRelay = async (nodeId: string, relay: number, currentState: boolean) => {
    const key = `${nodeId}_${relay}`;
    setLoading(key);

    try {
      if (currentState) {
        await commandsApi.relayOff(nodeId, relay);
        setRelayState(nodeId, relay, false);
      } else {
        await commandsApi.relayOn(nodeId, relay);
        setRelayState(nodeId, relay, true);
      }
    } catch {
      Alert.alert('Eroare', 'Nu s-a putut trimite comanda. Verifică conexiunea.');
    } finally {
      setLoading(null);
    }
  };

  const handleAllOff = async (nodeId: string) => {
    Alert.alert(
      'Oprire totală',
      `Oprești toate relay-urile pe ${nodeId}?`,
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Oprește tot',
          style: 'destructive',
          onPress: async () => {
            await commandsApi.allOff(nodeId);
            [0, 1, 2, 3].forEach(i => setRelayState(nodeId, i, false));
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {NODES.map(node => (
        <View key={node.id} style={styles.nodeCard}>
          <Text style={styles.nodeTitle}>{node.label}</Text>
          <Text style={styles.nodeId}>{node.id}</Text>

          <View style={styles.relaysGrid}>
            {RELAY_LABELS.map((label, idx) => {
              const isOn   = relayStates[node.id]?.[idx] ?? false;
              const key    = `${node.id}_${idx}`;
              const isLoading = loading === key;

              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.relayBtn, isOn && styles.relayBtnOn]}
                  onPress={() => handleRelay(node.id, idx, isOn)}
                  disabled={!!loading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={isOn ? COLORS.bg : COLORS.primary} size="small" />
                  ) : (
                    <>
                      <Text style={styles.relayIcon}>{isOn ? '💡' : '○'}</Text>
                      <Text style={[styles.relayLabel, isOn && styles.relayLabelOn]}>
                        {label}
                      </Text>
                      <Text style={[styles.relayState, { color: isOn ? COLORS.success : COLORS.textMuted }]}>
                        {isOn ? 'ON' : 'OFF'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.allOffBtn}
            onPress={() => handleAllOff(node.id)}
          >
            <Text style={styles.allOffText}>⬛ Oprește tot</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.bg, padding: 16, gap: 16 },
  nodeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  nodeTitle:  { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  nodeId:     { color: COLORS.textMuted, fontSize: 12, marginBottom: 16 },
  relaysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  relayBtn: {
    width: '47%', paddingVertical: 16,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  relayBtnOn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  relayIcon:     { fontSize: 24, marginBottom: 6 },
  relayLabel:    { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },
  relayLabelOn:  { color: COLORS.bg },
  relayState:    { fontSize: 11, fontWeight: '700', marginTop: 4 },
  allOffBtn: {
    marginTop: 14, paddingVertical: 10,
    backgroundColor: '#450a0a',
    borderRadius: 8, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.danger,
  },
  allOffText: { color: COLORS.danger, fontSize: 14, fontWeight: '600' },
});
```

---

## 13. services/notifications.ts — push locale

```typescript
// src/services/notifications.ts

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// Configurare comportament notificări când app e în foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

export async function setupNotifications(): Promise<boolean> {
  if (!Device.isDevice) {
    console.log('[Notif] Simulator — notificările push nu funcționează');
    return false;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Notif] Permisiune refuzată');
    return false;
  }

  console.log('[Notif] Permisiuni acordate');
  return true;
}

export async function scheduleLocalNotification(params: {
  title:    string;
  body:     string;
  data?:    Record<string, any>;
  priority?: 'default' | 'normal' | 'high' | 'max';
}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title:    params.title,
      body:     params.body,
      data:     params.data || {},
      priority: params.priority || 'high',
      sound:    true,
    },
    trigger: null,  // imediat
  });
}

export function setupNotificationListeners(
  onReceive:  (notification: Notifications.Notification) => void,
  onResponse: (response: Notifications.NotificationResponse) => void,
) {
  const receiveSubscription  = Notifications.addNotificationReceivedListener(onReceive);
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(onResponse);

  return () => {
    receiveSubscription.remove();
    responseSubscription.remove();
  };
}
```

---

## 14. App.tsx — entry point complet

```typescript
// App.tsx

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { AppNavigator } from './src/navigation/AppNavigator';
import { setupNotifications } from './src/services/notifications';
import { wsService } from './src/services/websocket';
import { Cache } from './src/services/storage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry:     2,
      staleTime: 25_000,
    },
  },
});

export default function App() {
  useEffect(() => {
    setupNotifications();

    // Conectează WebSocket dacă există token salvat
    if (Cache.getToken()) {
      wsService.connect();
    }

    return () => {
      wsService.disconnect();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <StatusBar style="light" />
          <AppNavigator />
        </NavigationContainer>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
```

---

## 15. Rulare și build

```bash
# Development — pe telefon fizic prin Expo Go
npx expo start

# Scanează QR code cu Expo Go (iOS/Android)
# Asigură-te că telefonul e pe aceeași rețea WiFi cu Raspberry Pi

# Build APK pentru Android (fără Expo Go, standalone)
npx expo build:android --type apk
# sau cu EAS Build (recomandat):
npm install -g eas-cli
eas build --platform android --profile preview
```

---

## 16. Verificare finală — sistem complet

```
Layer 1 ✓  Senzori citesc valori reale, actuatori răspund la comenzi
Layer 2 ✓  ESP32 conectat MQTT TLS, publică la 30s, primește comenzi
Layer 3 ✓  RPi: Mosquitto + TimescaleDB + PostgreSQL + ML Engine + API — toate ca servicii systemd
Layer 4 ✓  NestJS API răspunde, WebSocket emite live, JWT funcțional
Layer 5 ✓  App mobilă: date live, grafice, control relay, notificări push
```

**Scenarii de demonstrat comisiei:**

1. **Alertă gaz în timp real** — apropiați bricheta (fără flacără!) de MQ2 →
   buzzer pornit pe ESP32 în < 500ms, notificare push pe telefon în < 2s,
   relay oprit automat, alertă vizibilă în app

2. **Mișcare nocturnă** — simulați ora 23+ în config, mișcați în fața PIR →
   lumina se aprinde automat, notificare pe telefon

3. **Anomalie ML** — după 14 zile de date: schimbare bruscă temperatură la oră neobișnuită →
   alertă ML_ANOMALY fără să fie depășit threshold-ul hardcodat

4. **Funcționare fără internet** — deconectați Raspberry Pi de la router →
   sistemul continuă să funcționeze complet, app arată date din cache

5. **Control manual** — din app, porniți/opriți relay, vedeți schimbarea LED-ului fizic în < 1s

---

*Serie completă: 00_arhitectura_generala → 01_layer1 → 02_layer2 → 03_layer3 → 04_layer4 → 05_layer5*
