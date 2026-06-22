import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Svg, {
  Path, Defs, LinearGradient as SvgGradient, Stop,
  Line as SvgLine, Circle, G, Rect, Text as SvgText,
} from 'react-native-svg';
import { api } from '../services/api';
import { SensorReading } from '../types';
import { T, F, FONT } from '../theme';
import { GlassCard, Chip, Icon } from '../components/ui';

type Metric = { key: keyof SensorReading; label: string; color: string; unit: string };
type Zone = { id: string; label: string; nodeId: string; metrics: Metric[] };

// Un singur senzor fizic deservește mai multe camere (open space):
// living = DHT #1 + LDR1, dormitor = DHT #2 + LDR2, bucătăria = gaz + aceiași
// DHT/umiditate ca living. Curtea = nodul cameră (mișcare).
const T_M: Metric = { key: 'temperature',  label: 'Temperatură', color: T.warning, unit: '°C' };
const H_M: Metric = { key: 'humidity',     label: 'Umiditate',   color: T.info,    unit: '%' };

const ZONES: Zone[] = [
  { id: 'living', label: 'Living', nodeId: 'esp32_node_a', metrics: [
    T_M, H_M,
    { key: 'light1', label: 'Lumină', color: T.violet, unit: '' },
  ]},
  { id: 'dormitor', label: 'Dormitor', nodeId: 'esp32_node_a', metrics: [
    { key: 'temperature2', label: 'Temperatură', color: T.warning, unit: '°C' },
    { key: 'humidity2',    label: 'Umiditate',   color: T.info,    unit: '%' },
    { key: 'light2',       label: 'Lumină',      color: T.violet,  unit: '' },
  ]},
  { id: 'bucatarie', label: 'Bucătărie', nodeId: 'esp32_node_a', metrics: [
    { key: 'gasLevel', label: 'Gaz', color: T.danger, unit: '' },
    T_M, H_M,
  ]},
  { id: 'curte', label: 'Curte', nodeId: 'esp32_cam_node', metrics: [
    { key: 'motion', label: 'Mișcare', color: T.accent, unit: '' },
  ]},
];

const RANGES = [
  { label: '1h',  hours: 1 },
  { label: '6h',  hours: 6 },
  { label: '24h', hours: 24 },
];

export default function HistoryScreen() {
  const [zone,   setZone]    = useState(ZONES[0]);
  const [metric, setMetric]  = useState(ZONES[0].metrics[0]);
  const [range,  setRange]   = useState(RANGES[2]);

  // La schimbarea zonei, resetăm metrica la prima disponibilă pentru zona aceea
  function selectZone(i: number) {
    setZone(ZONES[i]);
    setMetric(ZONES[i].metrics[0]);
  }

  const { data, isLoading } = useQuery({
    queryKey: ['history', zone.nodeId, metric.key, range.hours],
    queryFn: () => {
      const to   = new Date();
      const from = new Date(Date.now() - range.hours * 3600 * 1000);
      return api.sensors.history(zone.nodeId, from.toISOString(), to.toISOString(), 300);
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
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.kicker}>Senzori</Text>
          <Text style={s.title}>Istoric</Text>
        </View>

        {/* ── Selectors ── */}
        <View style={s.selectorBlock}>
          <SelectorRow
            iconName="home-outline"
            label="Cameră"
            options={ZONES.map(z => z.label)}
            activeIdx={ZONES.findIndex(z => z.id === zone.id)}
            onSelect={selectZone}
          />
          <SelectorRow
            iconName="time-outline"
            label="Interval"
            options={RANGES.map(r => r.label)}
            activeIdx={RANGES.indexOf(range)}
            onSelect={i => setRange(RANGES[i])}
          />
          <SelectorRow
            iconName="pulse-outline"
            label="Metrică"
            options={zone.metrics.map(m => m.label)}
            activeIdx={zone.metrics.findIndex(m => m.key === metric.key)}
            onSelect={i => setMetric(zone.metrics[i])}
            colors={zone.metrics.map(m => m.color)}
          />
        </View>

        {/* ── Stat tiles ── */}
        <View style={s.statRow}>
          <StatTile label="Acum"  value={lastV?.toFixed(1) ?? '—'} unit={metric.unit} color={metric.color} big />
          <StatTile label="Min"   value={values.length ? minV.toFixed(1) : '—'} unit={metric.unit} />
          <StatTile label="Max"   value={values.length ? maxV.toFixed(1) : '—'} unit={metric.unit} />
          <StatTile label="Mediu" value={avgV != null ? avgV.toFixed(1) : '—'}   unit={metric.unit} />
        </View>

        {/* ── Chart ── */}
        {isLoading ? (
          <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
        ) : values.length > 1 ? (
          <GlassCard style={s.chartCard} padding={16}>
            {/* Chart header */}
            <View style={s.chartHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="analytics-outline" size={16} color={metric.color} />
                <Text style={[s.chartTitle, { color: metric.color }]}>
                  {metric.label}
                </Text>
                <Text style={s.chartUnit}>({metric.unit})</Text>
              </View>
              {/* Legend swatch */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={[s.legendLine, { backgroundColor: metric.color }]} />
                <Text style={s.legendLabel}>Ultimele {range.label}</Text>
              </View>
            </View>

            <BigChart values={values} color={metric.color} />

            {/* X-axis labels */}
            <View style={s.xAxis}>
              {[`-${range.label}`, '', '', '', 'Acum'].map((t, i) => (
                <Text key={i} style={s.xLabel}>{t}</Text>
              ))}
            </View>
          </GlassCard>
        ) : (
          <View style={s.emptyWrap}>
            <Icon name="bar-chart-outline" size={36} color={T.text3} />
            <Text style={s.emptyText}>
              Insuficiente date pentru intervalul selectat.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ── SELECTOR ROW (label + Chip row) ──────────────────────── */
function SelectorRow({
  iconName, label, options, activeIdx, onSelect, colors,
}: {
  iconName: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  label: string;
  options: string[];
  activeIdx: number;
  onSelect: (i: number) => void;
  colors?: string[];
}) {
  return (
    <View style={sr.row}>
      <View style={sr.labelBox}>
        <Icon name={iconName} size={14} color={T.text3} />
        <Text style={sr.label}>{label}</Text>
      </View>
      <View style={sr.chips}>
        {options.map((o, i) => {
          const accentColor = colors ? colors[i] : T.accent;
          return (
            <Chip
              key={o}
              label={o}
              active={i === activeIdx}
              onPress={() => onSelect(i)}
              color={accentColor}
            />
          );
        })}
      </View>
    </View>
  );
}

const sr = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.s.md,
    marginBottom: T.s.sm,
  },
  labelBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    width: 72,
  },
  label: {
    ...F.caption,
    color: T.text3,
  },
  chips: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
});

/* ── STAT TILE ─────────────────────────────────────────────── */
function StatTile({
  label, value, unit, color, big,
}: {
  label: string;
  value: string;
  unit: string;
  color?: string;
  big?: boolean;
}) {
  const numColor = big && color ? color : T.text;
  return (
    <GlassCard style={st.tile} padding={10}>
      <Text style={st.label}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, marginTop: 5 }}>
        <Text style={[st.val, big && { fontSize: 22, color: numColor }]}>
          {value}
        </Text>
        <Text style={st.unit}>{unit}</Text>
      </View>
    </GlassCard>
  );
}

const st = StyleSheet.create({
  tile: { flex: 1 },
  label: {
    fontSize: 12,
    fontFamily: FONT.medium,
    color: T.text3,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  val: {
    fontSize: 18,
    fontFamily: FONT.numBold,
    color: T.text,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontSize: 12,
    fontFamily: FONT.medium,
    color: T.text3,
    paddingBottom: 2,
  },
});

/* ── BIG CHART (SVG area chart) ───────────────────────────── */
function BigChart({ values, color }: { values: number[]; color: string }) {
  const W = 340, H = 190;
  const PAD = { l: 40, r: 12, t: 16, b: 8 };
  const min = Math.min(...values) - 0.5;
  const max = Math.max(...values) + 0.5;
  const range = max - min || 1;

  const px = (i: number) => PAD.l + (i / (values.length - 1)) * (W - PAD.l - PAD.r);
  const py = (v: number) => PAD.t + (1 - (v - min) / range) * (H - PAD.t - PAD.b);

  const pts = values.map((v, i) => [px(i), py(v)] as [number, number]);
  const d   = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
  const fd  = `${d} L${pts[pts.length - 1][0]},${H - PAD.b} L${pts[0][0]},${H - PAD.b} Z`;

  const lastX = pts[pts.length - 1][0];
  const lastY = pts[pts.length - 1][1];

  const ticks = [min, min + range * 0.33, min + range * 0.66, max];

  return (
    <Svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'flex' }}>
      <Defs>
        <SvgGradient id="area" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.40" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </SvgGradient>
      </Defs>

      {/* Gridlines + Y-axis labels */}
      {ticks.map((t, i) => (
        <G key={i}>
          <SvgLine
            x1={PAD.l} x2={W - PAD.r}
            y1={py(t)} y2={py(t)}
            stroke={i === 0 || i === ticks.length - 1 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)'}
            strokeWidth="1"
            strokeDasharray={i === 0 || i === ticks.length - 1 ? '0' : '3 5'}
          />
          <SvgText
            x={PAD.l - 8}
            y={py(t) + 4}
            textAnchor="end"
            fontSize="12"
            fontFamily={FONT.num}
            fill={T.text3}
          >
            {t.toFixed(1)}
          </SvgText>
        </G>
      ))}

      {/* Area fill */}
      <Path d={fd} fill="url(#area)" />
      {/* Line */}
      <Path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Current value dot + halo */}
      <Circle cx={lastX} cy={lastY} r="10" fill={color} fillOpacity="0.18" />
      <Circle cx={lastX} cy={lastY} r="4.5" fill={T.bg} stroke={color} strokeWidth="2.5" />

      {/* Value bubble */}
      <Rect
        x={lastX - 24} y={lastY - 29}
        width="48" height="20" rx="7"
        fill={color}
      />
      <SvgText
        x={lastX} y={lastY - 13}
        textAnchor="middle"
        fontSize="12"
        fontFamily={FONT.numBold}
        fill={T.accentOn}
      >
        {values[values.length - 1].toFixed(1)}
      </SvgText>
    </Svg>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: T.bg },
  content: { paddingBottom: 110 },

  header: {
    paddingHorizontal: T.s.xl,
    paddingTop: 60,
    paddingBottom: T.s.lg,
  },
  kicker: {
    ...F.kicker,
    marginBottom: 4,
  },
  title: {
    fontSize: 30,
    fontFamily: FONT.display,
    color: T.text,
    letterSpacing: -0.8,
  },

  selectorBlock: {
    paddingHorizontal: T.s.xl,
    marginBottom: T.s.lg,
  },

  statRow: {
    flexDirection: 'row',
    gap: T.s.sm,
    paddingHorizontal: T.s.lg,
    marginBottom: T.s.lg,
  },

  chartCard: {
    marginHorizontal: T.s.lg,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: T.s.sm,
  },
  chartTitle: {
    fontSize: 14,
    fontFamily: FONT.semibold,
    letterSpacing: -0.1,
  },
  chartUnit: {
    ...F.caption,
    color: T.text3,
  },
  legendLine: {
    width: 16,
    height: 2.5,
    borderRadius: 2,
  },
  legendLabel: {
    fontSize: 12,
    fontFamily: FONT.medium,
    color: T.text3,
  },

  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: T.s.sm,
  },
  xLabel: {
    fontSize: 12,
    fontFamily: FONT.medium,
    color: T.text3,
  },

  emptyWrap: {
    alignItems: 'center',
    marginTop: 60,
    gap: T.s.md,
    paddingHorizontal: 40,
  },
  emptyText: {
    ...F.body,
    color: T.text3,
    textAlign: 'center',
  },
});
