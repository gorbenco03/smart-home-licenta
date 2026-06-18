// Primitive UI — stil glassmorphism vibrant.
// Export-uri: GlassCard, Icon, Chip, SectionHeader, Dot, StatusPill,
// Sparkline, Ring, IosSwitch, GasBar. Doar iconițe vectoriale (Ionicons),
// fără emoji.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Path, Circle, Defs,
  LinearGradient as SvgGradient,
  Stop,
} from 'react-native-svg';
import { T, F, FONT } from '../theme';

/* ─── ICON (wrapper Ionicons) ──────────────────────────── */

export function Icon({
  name, size = 20, color = T.text2,
}: { name: keyof typeof Ionicons.glyphMap; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

/* ─── GLASS CARD ───────────────────────────────────────── */

export function GlassCard({
  children,
  style,
  intensity = 24,
  padding = 18,
  tone = 'default',
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  padding?: number;
  tone?: 'default' | 'accent' | 'danger';
}) {
  const borderColor =
    tone === 'accent' ? T.accentLine : tone === 'danger' ? T.dangerLine : T.glassBorder;
  return (
    <View style={[gc.wrap, { borderColor }, T.shadow, style]}>
      <BlurView
        intensity={intensity}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: T.glass }]} />
      <View style={{ padding }}>{children}</View>
    </View>
  );
}

const gc = StyleSheet.create({
  wrap: {
    borderRadius: T.r.lg,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(18,26,46,0.55)', // fallback dacă blur-ul e slab
  },
});

/* ─── CHIP (selector / filtru) ─────────────────────────── */

export function Chip({
  label, active = false, onPress, count, color = T.accent,
}: {
  label: string; active?: boolean; onPress?: () => void; count?: number; color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        chip.wrap,
        active
          ? { backgroundColor: T.accentSoft, borderColor: T.accentLine }
          : { backgroundColor: T.glass, borderColor: T.glassBorder },
      ]}
    >
      <Text style={[chip.label, { color: active ? T.text : T.text2, fontFamily: active ? FONT.semibold : FONT.medium }]}>
        {label}
      </Text>
      {count != null && (
        <View style={[chip.badge, { backgroundColor: active ? color : T.glass2 }]}>
          <Text style={[chip.badgeTxt, { color: active ? T.accentOn : T.text3 }]}>{count}</Text>
        </View>
      )}
    </Pressable>
  );
}

const chip = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: T.r.pill, borderWidth: 1,
  },
  label: { fontSize: 13.5 },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  badgeTxt: { fontSize: 11.5, fontFamily: FONT.bold, fontVariant: ['tabular-nums'] },
});

/* ─── SECTION HEADER ───────────────────────────────────── */

export function SectionHeader({
  title, meta, icon,
}: { title: string; meta?: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={sh.row}>
      <View style={sh.left}>
        {icon && <Icon name={icon} size={15} color={T.text3} />}
        <Text style={sh.title}>{title}</Text>
      </View>
      {meta && <Text style={sh.meta}>{meta}</Text>}
    </View>
  );
}

const sh = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { fontSize: 12.5, fontFamily: FONT.semibold, color: T.text2, letterSpacing: 1, textTransform: 'uppercase' },
  meta: { fontSize: 12.5, fontFamily: FONT.medium, color: T.text3 },
});

/* ─── DOT ──────────────────────────────────────────────── */

export function Dot({ color = T.success, size = 8, glow = false }: { color?: string; size?: number; glow?: boolean }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, backgroundColor: color,
      ...(glow ? { shadowColor: color, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 4 } : {}),
    }} />
  );
}

/* ─── STATUS PILL ──────────────────────────────────────── */

type PillKind = 'live' | 'reconn' | 'offline';

const PILL_MAP: Record<PillKind, { color: string; bg: string; label: string }> = {
  live:    { color: T.success, bg: T.successSoft, label: 'Live' },
  reconn:  { color: T.warning, bg: T.warningSoft, label: 'Reconectare' },
  offline: { color: T.text3,   bg: T.glass2,      label: 'Offline' },
};

export function StatusPill({ kind = 'live' }: { kind?: PillKind }) {
  const m = PILL_MAP[kind];
  return (
    <View style={[pill.wrap, { backgroundColor: m.bg, borderColor: T.glassBorder }]}>
      <Dot color={m.color} size={6} glow={kind === 'live'} />
      <Text style={[pill.text, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

const pill = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 11, paddingVertical: 6,
    borderRadius: T.r.pill, borderWidth: 1,
  },
  text: { fontSize: 12.5, fontFamily: FONT.semibold },
});

/* ─── SPARKLINE ────────────────────────────────────────── */

export function Sparkline({
  data, width = 96, height = 34, color = T.accent, fill = true, strokeWidth = 2,
}: {
  data: number[]; width?: number; height?: number; color?: string; fill?: boolean; strokeWidth?: number;
}) {
  const id = useMemo(() => 'sp' + Math.random().toString(36).slice(2, 7), []);
  if (!data || data.length < 2) return <View style={{ width, height }} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 5) - 2.5;
    return [x, y] as [number, number];
  });
  const d = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
  const fd = `${d} L${width},${height} L0,${height} Z`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.34" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </SvgGradient>
      </Defs>
      {fill && <Path d={fd} fill={`url(#${id})`} />}
      <Path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/* ─── RING / GAUGE (stroke cu gradient) ────────────────── */

export function Ring({
  value, max = 100, size = 96, stroke = 9,
  color = T.accent, color2, track = T.surface3, label, unit,
}: {
  value: number; max?: number; size?: number; stroke?: number;
  color?: string; color2?: string; track?: string; label?: string; unit?: string;
}) {
  const gid = useMemo(() => 'rg' + Math.random().toString(36).slice(2, 7), []);
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const sweep = 270;
  const circ = 2 * Math.PI * r;
  const arcLen = (sweep / 360) * circ;
  const pct = Math.min(1, Math.max(0, value / max));
  const rotation = 135;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={color} />
            <Stop offset="100%" stopColor={color2 || T.cyan} />
          </SvgGradient>
        </Defs>
        <Circle
          cx={cx} cy={cx} r={r} fill="none" stroke={track} strokeWidth={stroke}
          strokeDasharray={`${arcLen} ${circ}`} strokeLinecap="round"
          rotation={rotation} origin={`${cx}, ${cx}`}
        />
        <Circle
          cx={cx} cy={cx} r={r} fill="none" stroke={`url(#${gid})`} strokeWidth={stroke}
          strokeDasharray={`${pct * arcLen} ${circ}`} strokeLinecap="round"
          rotation={rotation} origin={`${cx}, ${cx}`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', gap: 2 }]}>
        {label && (
          <Text style={{ fontSize: 11.5, fontFamily: FONT.semibold, color: T.text3, textTransform: 'uppercase', letterSpacing: 1 }}>
            {label}
          </Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
          <Text style={{ fontSize: 27, fontFamily: FONT.numBold, color: T.text, lineHeight: 30 }}>
            {value}
          </Text>
          {unit && <Text style={{ fontSize: 13, fontFamily: FONT.medium, color: T.text3, paddingBottom: 4 }}>{unit}</Text>}
        </View>
      </View>
    </View>
  );
}

/* ─── iOS SWITCH ───────────────────────────────────────── */

export function IosSwitch({ on = false, color = T.accent }: { on?: boolean; color?: string }) {
  return (
    <View style={[
      sw.track,
      on
        ? { backgroundColor: color, borderColor: color, shadowColor: color, shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 4 }
        : { backgroundColor: T.surface3, borderColor: T.borderStrong },
    ]}>
      <View style={[sw.thumb, { left: on ? 24 : 3 }]} />
    </View>
  );
}

const sw = StyleSheet.create({
  track: { width: 52, height: 31, borderRadius: T.r.pill, borderWidth: 1, position: 'relative' },
  thumb: {
    position: 'absolute', top: 3, width: 25, height: 25, borderRadius: T.r.pill,
    backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
  },
});

/* ─── GAS BAR ──────────────────────────────────────────── */

export function GasBar({ value, alert }: { value: number; alert: boolean }) {
  const pct = Math.min(100, (value / 600) * 100);
  const threshold = (350 / 600) * 100;
  const c = alert ? T.danger : T.success;
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 7 }}>
        <Text style={{ fontSize: 12, fontFamily: FONT.semibold, color: T.text3, letterSpacing: 1, textTransform: 'uppercase' }}>Aer</Text>
        <Text style={{ fontSize: 12.5, fontFamily: FONT.semibold, color: alert ? T.dangerHi : T.text2 }}>
          {alert ? 'Nivel ridicat' : 'Normal'}
        </Text>
      </View>
      <View style={{ height: 8, borderRadius: T.r.pill, backgroundColor: T.surface3, overflow: 'hidden' }}>
        <View style={{
          position: 'absolute', top: 0, left: 0, bottom: 0, width: `${pct}%`,
          backgroundColor: c, borderRadius: T.r.pill,
          shadowColor: c, shadowOpacity: 0.7, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 3,
        }} />
      </View>
      <View style={{ position: 'relative', height: 6, marginTop: -7 }}>
        <View style={{ position: 'absolute', left: `${threshold}%` as any, top: 0, bottom: 0, width: 2, backgroundColor: T.text2, opacity: 0.7 }} />
      </View>
    </View>
  );
}
