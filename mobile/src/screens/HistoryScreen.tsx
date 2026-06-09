import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop, Line as SvgLine, Circle, G, Rect, Text as SvgText } from 'react-native-svg';
import { api } from '../services/api';
import { SensorReading } from '../types';
import { T } from '../theme';

const NODES = [
  { id: 'esp32_node_a', label: 'Living' },
  { id: 'esp32_node_b', label: 'Dormitor' },
];

const METRICS: Array<{ key: keyof SensorReading; label: string; color: string; unit: string }> = [
  { key: 'temperature', label: 'Temperatură', color: T.warning, unit: '°C' },
  { key: 'humidity',    label: 'Umiditate',   color: T.info,    unit: '%' },
  { key: 'lightLux',   label: 'Lumină',       color: T.violet,  unit: 'lux' },
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

  const values = (data ?? []).map((r) => Number(r[metric.key] ?? 0));
  const minV   = values.length ? Math.min(...values) : 0;
  const maxV   = values.length ? Math.max(...values) : 100;
  const avgV   = values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
  const lastV  = values.length ? values[values.length - 1] : null;

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.content}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.kicker}>SENZORI</Text>
          <Text style={s.title}>Istoric</Text>
        </View>

        {/* Selectors */}
        <View style={s.selectors}>
          <ChipRow
            label="NOD"
            options={NODES.map(n => n.label)}
            activeIdx={NODES.findIndex(n => n.id === nodeId)}
            onSelect={i => setNodeId(NODES[i].id)}
          />
          <ChipRow
            label="INTERVAL"
            options={RANGES.map(r => r.label)}
            activeIdx={RANGES.indexOf(range)}
            onSelect={i => setRange(RANGES[i])}
            mono
          />
          <ChipRow
            label="METRICĂ"
            options={METRICS.map(m => m.label)}
            activeIdx={METRICS.indexOf(metric)}
            onSelect={i => setMetric(METRICS[i])}
            colored
            colors={METRICS.map(m => m.color)}
          />
        </View>

        {/* Stat tiles */}
        <View style={s.statRow}>
          <StatTile label="CURENT" value={lastV?.toFixed(1) ?? '—'} unit={metric.unit} color={metric.color} big />
          <StatTile label="MIN"    value={values.length ? minV.toFixed(1) : '—'} unit={metric.unit} />
          <StatTile label="MAX"    value={values.length ? maxV.toFixed(1) : '—'} unit={metric.unit} />
          <StatTile label="MED"    value={avgV != null ? avgV.toFixed(1) : '—'} unit={metric.unit} />
        </View>

        {/* Chart */}
        {isLoading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 40 }} />
        ) : values.length > 1 ? (
          <View style={s.chartCard}>
            <View style={s.chartHeader}>
              <Text style={s.chartTitle}>{metric.label} · {metric.unit}</Text>
              <View style={s.legend}>
                <LegendSwatch color={metric.color} label="azi" />
              </View>
            </View>
            <BigChart values={values} color={metric.color} />
            <View style={s.xAxis}>
              {['início', '', '', '', 'agora'].map((t, i) => (
                <Text key={i} style={s.xLabel}>{t}</Text>
              ))}
            </View>
          </View>
        ) : (
          <Text style={s.empty}>Insuficiente date pentru intervalul selectat.</Text>
        )}
      </ScrollView>
    </View>
  );
}

/* ── CHIP ROW ──────────────────────────────────────── */
function ChipRow({
  label, options, activeIdx, onSelect, mono, colored, colors,
}: {
  label: string;
  options: string[];
  activeIdx: number;
  onSelect: (i: number) => void;
  mono?: boolean;
  colored?: boolean;
  colors?: string[];
}) {
  return (
    <View style={cr.row}>
      <Text style={cr.label}>{label}</Text>
      <View style={cr.pills}>
        {options.map((o, i) => {
          const on = i === activeIdx;
          const c  = colored && colors ? colors[i] : null;
          return (
            <TouchableOpacity
              key={o}
              style={[
                cr.pill,
                on && (c ? { backgroundColor: c + '22', borderColor: c + '88' } : cr.pillActive),
              ]}
              onPress={() => onSelect(i)}
              activeOpacity={0.7}
            >
              <Text style={[
                cr.pillText,
                { fontFamily: mono ? 'Courier New' : undefined },
                on && { color: c ?? T.text, fontWeight: '600' },
              ]}>
                {o}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const cr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  label: { fontFamily: 'Courier New', fontSize: 9.5, color: T.text3, letterSpacing: 1.2, width: 52 },
  pills: {
    flex: 1, flexDirection: 'row',
    backgroundColor: T.surface,
    borderRadius: 14, padding: 4,
    borderWidth: 1, borderColor: T.border,
    gap: 4,
  },
  pill: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: 'transparent',
  },
  pillActive: { backgroundColor: T.surface3 },
  pillText: { fontSize: 12.5, fontWeight: '500', color: T.text2 },
});

/* ── STAT TILE ─────────────────────────────────────── */
function StatTile({ label, value, unit, color = T.text2, big }:
  { label: string; value: string; unit: string; color?: string; big?: boolean }) {
  return (
    <View style={st.tile}>
      <Text style={st.label}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1, marginTop: 4 }}>
        <Text style={[st.val, big && { fontSize: 19, color }]}>{value}</Text>
        <Text style={st.unit}>{unit}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  tile: {
    flex: 1, backgroundColor: T.surface,
    borderRadius: 14, padding: 10,
    borderWidth: 1, borderColor: T.border,
  },
  label: { fontFamily: 'Courier New', fontSize: 9, color: T.text3, letterSpacing: 1.2 },
  val: { fontFamily: 'Courier New', fontSize: 16, fontWeight: '500', color: T.text, letterSpacing: -0.5 },
  unit: { fontFamily: 'Courier New', fontSize: 9.5, color: T.text3, paddingBottom: 2 },
});

/* ── LEGEND ────────────────────────────────────────── */
function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 14, height: 2, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ fontFamily: 'Courier New', fontSize: 10, color: T.text3, letterSpacing: 0.4 }}>{label}</Text>
    </View>
  );
}

/* ── BIG CHART (SVG area chart) ───────────────────── */
function BigChart({ values, color }: { values: number[]; color: string }) {
  const W = 340, H = 180;
  const PAD = { l: 28, r: 10, t: 14, b: 8 };
  const min = Math.min(...values) - 0.5;
  const max = Math.max(...values) + 0.5;
  const range = max - min || 1;

  const px = (i: number) => PAD.l + (i / (values.length - 1)) * (W - PAD.l - PAD.r);
  const py = (v: number) => PAD.t + (1 - (v - min) / range) * (H - PAD.t - PAD.b);

  const pts = values.map((v, i) => [px(i), py(v)] as [number, number]);
  const d  = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
  const fd = `${d} L${pts[pts.length - 1][0]},${H - PAD.b} L${pts[0][0]},${H - PAD.b} Z`;

  const lastX = pts[pts.length - 1][0];
  const lastY = pts[pts.length - 1][1];

  const ticks = [min, min + range * 0.33, min + range * 0.66, max];

  return (
    <Svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'flex' }}>
      <Defs>
        <SvgGradient id="area" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </SvgGradient>
      </Defs>

      {ticks.map((t, i) => (
        <G key={i}>
          <SvgLine
            x1={PAD.l} x2={W - PAD.r}
            y1={py(t)} y2={py(t)}
            stroke={T.border}
            strokeWidth="1"
            strokeDasharray={i === 0 || i === ticks.length - 1 ? '0' : '2 4'}
          />
          <SvgText
            x={PAD.l - 6} y={py(t) + 3}
            textAnchor="end"
            fontSize="9"
            fill={T.text3}
            fontFamily="Courier New"
          >
            {t.toFixed(0)}
          </SvgText>
        </G>
      ))}

      <Path d={fd} fill="url(#area)" />
      <Path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Current point */}
      <Circle cx={lastX} cy={lastY} r="9" fill={color} fillOpacity="0.18" />
      <Circle cx={lastX} cy={lastY} r="4.5" fill={T.bg} stroke={color} strokeWidth="2" />

      {/* Value bubble */}
      <Rect
        x={lastX - 22} y={lastY - 26}
        width="44" height="18" rx="6"
        fill={color}
      />
      <SvgText
        x={lastX} y={lastY - 12}
        textAnchor="middle"
        fontSize="10.5"
        fill={T.accentOn}
        fontFamily="Courier New"
        fontWeight="600"
      >
        {values[values.length - 1].toFixed(1)}
      </SvgText>
    </Svg>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  content: { paddingBottom: 110 },
  header: { paddingHorizontal: 22, paddingTop: 60, paddingBottom: 14 },
  kicker: { fontFamily: 'Courier New', fontSize: 11, color: T.text3, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 4 },
  title: { fontSize: 30, fontWeight: '600', color: T.text, letterSpacing: -0.8 },
  selectors: { paddingHorizontal: 22, marginBottom: 14 },
  statRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginBottom: 14 },
  chartCard: {
    marginHorizontal: 18,
    backgroundColor: T.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: T.border,
    padding: 14,
    ...T.shadow,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  chartTitle: { fontFamily: 'Courier New', fontSize: 10.5, color: T.text3, letterSpacing: 1.2, textTransform: 'uppercase' },
  legend: { flexDirection: 'row', gap: 10 },
  xAxis: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 8 },
  xLabel: { fontFamily: 'Courier New', fontSize: 10, color: T.text3, letterSpacing: 0.4 },
  empty: { color: T.text4, textAlign: 'center', marginTop: 60, fontSize: 15, paddingHorizontal: 40 },
});
