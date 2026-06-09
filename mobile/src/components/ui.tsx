// Shared UI primitives — ported from Claude Design handoff (shared.jsx)
// Sparkline, Ring gauge, Switch, StatusPill, Dot

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Path, Circle, Defs,
  LinearGradient as SvgGradient,
  Stop,
} from 'react-native-svg';
import { T } from '../theme';

/* ─── DOT ─────────────────────────────────────────────── */

export function Dot({
  color = T.success,
  size = 8,
}: { color?: string; size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color,
    }} />
  );
}

/* ─── STATUS PILL ──────────────────────────────────────── */

type PillKind = 'live' | 'reconn' | 'offline';

const PILL_MAP: Record<PillKind, { color: string; bg: string; label: string }> = {
  live:    { color: T.success, bg: T.successSoft, label: 'Live' },
  reconn:  { color: T.warning, bg: T.warningSoft, label: 'Reconectare…' },
  offline: { color: T.text3,   bg: T.surface2,    label: 'Offline' },
};

export function StatusPill({ kind = 'live' }: { kind?: PillKind }) {
  const m = PILL_MAP[kind];
  return (
    <View style={[pill.wrap, { backgroundColor: m.bg, borderColor: T.border }]}>
      <Dot color={m.color} size={6} />
      <Text style={[pill.text, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

const pill = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});

/* ─── SPARKLINE ────────────────────────────────────────── */

export function Sparkline({
  data,
  width = 80,
  height = 28,
  color = T.accent,
  fill = true,
  strokeWidth = 1.6,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  strokeWidth?: number;
}) {
  const id = useMemo(() => 'sp' + Math.random().toString(36).slice(2, 7), []);

  if (!data || data.length < 2) return <View style={{ width, height }} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y] as [number, number];
  });

  const d = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
  const fd = `${d} L${width},${height} L0,${height} Z`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </SvgGradient>
      </Defs>
      {fill && <Path d={fd} fill={`url(#${id})`} />}
      <Path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/* ─── RING / GAUGE ─────────────────────────────────────── */

export function Ring({
  value,
  max = 100,
  size = 88,
  stroke = 7,
  color = T.accent,
  track = T.surface3,
  label,
  unit,
}: {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  label?: string;
  unit?: string;
}) {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const sweep = 270;
  const circ = 2 * Math.PI * r;
  const arcLen = (sweep / 360) * circ;
  const pct = Math.min(1, Math.max(0, value / max));
  const rotation = 135; // start lower-left

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Track */}
        <Circle
          cx={cx} cy={cx} r={r}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
          strokeDasharray={`${arcLen} ${circ}`}
          strokeLinecap="round"
          rotation={rotation}
          origin={`${cx}, ${cx}`}
        />
        {/* Value arc */}
        <Circle
          cx={cx} cy={cx} r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${pct * arcLen} ${circ}`}
          strokeLinecap="round"
          rotation={rotation}
          origin={`${cx}, ${cx}`}
        />
      </Svg>
      {/* Center label */}
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', gap: 2 }]}>
        {label && (
          <Text style={{ fontSize: 12, fontWeight: '600', color: T.text3, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {label}
          </Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
          <Text style={{ fontSize: 24, fontWeight: '600', color: T.text, lineHeight: 26, fontVariant: ['tabular-nums'] }}>
            {value}
          </Text>
          {unit && (
            <Text style={{ fontSize: 12, color: T.text3, paddingBottom: 3 }}>
              {unit}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

/* ─── iOS SWITCH ───────────────────────────────────────── */

export function IosSwitch({ on = false, color = T.accent }: { on?: boolean; color?: string }) {
  return (
    <View style={[sw.track, { backgroundColor: on ? color : T.surface3 }]}>
      <View style={[sw.thumb, { left: on ? 22 : 2 }]} />
    </View>
  );
}

const sw = StyleSheet.create({
  track: {
    width: 50, height: 30, borderRadius: 999,
    borderWidth: 1, borderColor: T.border,
    position: 'relative',
  },
  thumb: {
    position: 'absolute', top: 2,
    width: 24, height: 24, borderRadius: 999,
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 3,
  },
});

/* ─── GAS BAR ──────────────────────────────────────────── */

export function GasBar({ value, alert }: { value: number; alert: boolean }) {
  const pct = Math.min(100, (value / 600) * 100);
  const threshold = (350 / 600) * 100;
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: T.text3, letterSpacing: 0.8 }}>AER</Text>
        <Text style={{ fontSize: 12, fontWeight: '600', color: alert ? T.danger : T.text2 }}>
          {alert ? 'Nivel ridicat' : 'Normal'}
        </Text>
      </View>
      <View style={{ height: 6, borderRadius: 99, backgroundColor: T.surface3, overflow: 'hidden', position: 'relative' }}>
        <View style={{
          position: 'absolute', top: 0, left: 0, bottom: 0,
          width: `${pct}%`,
          backgroundColor: alert ? T.danger : T.success,
          borderRadius: 99,
        }} />
      </View>
      {/* Threshold marker drawn separately below the bar */}
      <View style={{ position: 'relative', height: 4, marginTop: -4 }}>
        <View style={{
          position: 'absolute',
          left: `${threshold}%` as any,
          top: 0, bottom: 0, width: 1,
          backgroundColor: T.text3,
        }} />
      </View>
    </View>
  );
}
