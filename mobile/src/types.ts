export interface SensorReading {
  id: number;
  time: string;
  nodeId: string;
  location: string;
  temperature: number;
  humidity: number;
  gasLevel: number;
  gasAlert: boolean;
  motion: boolean;
  motionArmed?: boolean;   // PIR armat/dezarmat din aplicație
  lightLux: number;
  // Al 2-lea DHT11 (altă cameră)
  temperature2?: number;
  humidity2?: number;
  // Cele 2 senzori LDR (0–1023)
  light1?: number;
  light2?: number;
  // Stare ventilator: pornit, mod automat și pragul de temperatură (°C)
  fanOn?: boolean;
  fanAuto?: boolean;
  fanThreshold?: number;
}

export interface AlertItem {
  id: number;
  time: string;
  nodeId: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  details: Record<string, any>;
  acknowledged: boolean;
  acknowledgedAt: string | null;
}

export interface NodeInfo {
  id: number;
  nodeId: string;
  location: string;
  description: string;
  lastSeen: string | null;
  online: boolean;
  nodeType?: 'sensor' | 'camera' | 'hybrid' | null;
}

export interface AutomationRule {
  id: number;
  name: string;
  description: string;
  nodeId: string | null;
  sensor: string;
  operator: string;
  threshold: number;
  timeFrom: string | null;
  timeTo: string | null;
  actionType: string;
  actionTarget: string | null;
  enabled: boolean;
}

export interface Schedule {
  id: number;
  name?: string;
  nodeId: string;
  time: string;          // "HH:MM" (24h)
  days: string;          // CSV JS getDay indices: "1,2,3,4,5"
  action: string;
  params?: Record<string, unknown>;
  enabled: boolean;
  lastRun?: string | null;
  createdAt?: string;
}

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  Setup: undefined;
  Program: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  History: undefined;
  Alerts: undefined;
  Control: undefined;
};
