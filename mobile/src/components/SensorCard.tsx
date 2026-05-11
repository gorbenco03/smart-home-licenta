import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SensorReading } from '../types';

interface Props {
  nodeId: string;
  location: string;
  reading: SensorReading | null;
  online: boolean;
}

function MetricRow({ label, value, unit, alert }: {
  label: string; value: string | number; unit: string; alert?: boolean;
}) {
  return (
    <View style={s.metricRow}>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={[s.metricValue, alert && s.alertValue]}>
        {value ?? '—'} <Text style={s.unit}>{unit}</Text>
      </Text>
    </View>
  );
}

export function SensorCard({ nodeId, location, reading, online }: Props) {
  return (
    <View style={[s.card, !online && s.cardOffline]}>
      <View style={s.header}>
        <View>
          <Text style={s.location}>{location}</Text>
          <Text style={s.nodeId}>{nodeId}</Text>
        </View>
        <View style={[s.badge, online ? s.badgeOnline : s.badgeOffline]}>
          <Text style={s.badgeText}>{online ? 'online' : 'offline'}</Text>
        </View>
      </View>

      {reading ? (
        <>
          <MetricRow label="Temperatură"  value={reading.temperature?.toFixed(1) ?? '—'} unit="°C" />
          <MetricRow label="Umiditate"    value={reading.humidity?.toFixed(1) ?? '—'}    unit="%" />
          <MetricRow
            label="Gaz"
            value={reading.gasLevel ?? '—'}
            unit="ADC"
            alert={reading.gasAlert}
          />
          <MetricRow label="Lumină"       value={reading.lightLux?.toFixed(0) ?? '—'}    unit="lux" />
          <View style={s.motionRow}>
            <Text style={s.metricLabel}>Mișcare</Text>
            <View style={[s.motionDot, reading.motion ? s.motionActive : s.motionIdle]} />
          </View>
          {reading.gasAlert && (
            <View style={s.alertBanner}>
              <Text style={s.alertBannerText}>⚠️  ALERTĂ GAZ DETECTAT</Text>
            </View>
          )}
          <Text style={s.timestamp}>
            {new Date(reading.time).toLocaleTimeString('ro-RO')}
          </Text>
        </>
      ) : (
        <Text style={s.noData}>Aștept date…</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardOffline: {
    opacity: 0.6,
    borderColor: '#475569',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  location: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
    textTransform: 'capitalize',
  },
  nodeId: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeOnline: { backgroundColor: '#14532d' },
  badgeOffline: { backgroundColor: '#450a0a' },
  badgeText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1e3a5f22',
  },
  metricLabel: { color: '#94a3b8', fontSize: 14 },
  metricValue: { color: '#e2e8f0', fontSize: 15, fontWeight: '600' },
  alertValue: { color: '#f87171' },
  unit: { color: '#64748b', fontWeight: '400', fontSize: 12 },
  motionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  motionDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  motionActive: { backgroundColor: '#22c55e' },
  motionIdle:   { backgroundColor: '#334155' },
  alertBanner: {
    backgroundColor: '#7f1d1d',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    alignItems: 'center',
  },
  alertBannerText: { color: '#fca5a5', fontWeight: '700', fontSize: 14 },
  noData: { color: '#475569', textAlign: 'center', padding: 16 },
  timestamp: { color: '#475569', fontSize: 11, marginTop: 10, textAlign: 'right' },
});
