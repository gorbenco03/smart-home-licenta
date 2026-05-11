import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { LineChart } from 'react-native-gifted-charts';
import { api } from '../services/api';
import { SensorReading } from '../types';

const NODES = [
  { id: 'esp32_node_a', label: 'Living' },
  { id: 'esp32_node_b', label: 'Dormitor' },
];

const METRICS: Array<{ key: keyof SensorReading; label: string; color: string; unit: string }> = [
  { key: 'temperature', label: 'Temperatură', color: '#f59e0b', unit: '°C' },
  { key: 'humidity',    label: 'Umiditate',   color: '#38bdf8', unit: '%' },
  { key: 'lightLux',   label: 'Lumină',       color: '#a78bfa', unit: 'lux' },
];

const RANGES = [
  { label: '1h',  hours: 1 },
  { label: '6h',  hours: 6 },
  { label: '24h', hours: 24 },
];

export default function HistoryScreen() {
  const [nodeId,  setNodeId]  = useState(NODES[0].id);
  const [metric,  setMetric]  = useState(METRICS[0]);
  const [range,   setRange]   = useState(RANGES[2]);

  const { data, isLoading } = useQuery({
    queryKey: ['history', nodeId, metric.key, range.hours],
    queryFn: () => {
      const to   = new Date();
      const from = new Date(Date.now() - range.hours * 3600 * 1000);
      return api.sensors.history(nodeId, from.toISOString(), to.toISOString(), 300);
    },
    refetchInterval: 30_000,
  });

  const chartData = (data ?? []).map((r) => ({
    value: Number(r[metric.key] ?? 0),
    label: '',
  }));

  const values = chartData.map((d) => d.value);
  const minV   = values.length ? Math.min(...values) : 0;
  const maxV   = values.length ? Math.max(...values) : 100;
  const lastV  = values.length ? values[values.length - 1] : null;

  return (
    <View style={s.container}>
      <Text style={s.title}>Istoric</Text>

      {/* Selector nod */}
      <View style={s.row}>
        {NODES.map((n) => (
          <TouchableOpacity
            key={n.id}
            style={[s.chip, nodeId === n.id && s.chipActive]}
            onPress={() => setNodeId(n.id)}
          >
            <Text style={[s.chipText, nodeId === n.id && s.chipTextActive]}>{n.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Selector interval */}
      <View style={s.row}>
        {RANGES.map((r) => (
          <TouchableOpacity
            key={r.label}
            style={[s.chip, range.label === r.label && s.chipActive]}
            onPress={() => setRange(r)}
          >
            <Text style={[s.chipText, range.label === r.label && s.chipTextActive]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Selector metric */}
      <View style={s.row}>
        {METRICS.map((m) => (
          <TouchableOpacity
            key={m.key}
            style={[s.chip, metric.key === m.key && { ...s.chipActive, borderColor: m.color }]}
            onPress={() => setMetric(m)}
          >
            <Text style={[s.chipText, metric.key === m.key && { color: m.color }]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {isLoading ? (
          <ActivityIndicator color="#38bdf8" style={{ marginTop: 40 }} />
        ) : chartData.length > 1 ? (
          <>
            <View style={s.statRow}>
              <View style={s.stat}>
                <Text style={s.statLabel}>Curent</Text>
                <Text style={[s.statValue, { color: metric.color }]}>
                  {lastV?.toFixed(1)} {metric.unit}
                </Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statLabel}>Min</Text>
                <Text style={s.statValue}>{minV.toFixed(1)} {metric.unit}</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statLabel}>Max</Text>
                <Text style={s.statValue}>{maxV.toFixed(1)} {metric.unit}</Text>
              </View>
            </View>

            <LineChart
              data={chartData}
              color={metric.color}
              thickness={2}
              dataPointsColor={metric.color}
              dataPointsRadius={0}
              startFillColor={metric.color}
              endFillColor="#0f172a"
              startOpacity={0.3}
              endOpacity={0}
              areaChart
              hideDataPoints
              hideYAxisText={false}
              yAxisColor="#334155"
              xAxisColor="#334155"
              rulesColor="#1e293b"
              yAxisTextStyle={{ color: '#64748b', fontSize: 10 }}
              backgroundColor="#0f172a"
              width={330}
              height={220}
              noOfSections={4}
              maxValue={Math.ceil(maxV * 1.1)}
              minValue={Math.floor(minV * 0.9)}
            />
          </>
        ) : (
          <Text style={s.empty}>Insuficiente date pentru intervalul selectat.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  title: {
    fontSize: 24, fontWeight: '700', color: '#f1f5f9',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12,
  },
  row: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1, borderColor: '#334155',
  },
  chipActive:     { backgroundColor: '#0ea5e920', borderColor: '#38bdf8' },
  chipText:       { color: '#64748b', fontSize: 13 },
  chipTextActive: { color: '#38bdf8', fontWeight: '600' },
  content:  { padding: 16 },
  statRow:  { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  stat:     { alignItems: 'center' },
  statLabel:{ color: '#64748b', fontSize: 12, marginBottom: 4 },
  statValue:{ color: '#e2e8f0', fontSize: 18, fontWeight: '700' },
  empty:    { color: '#475569', textAlign: 'center', marginTop: 60, fontSize: 15 },
});
