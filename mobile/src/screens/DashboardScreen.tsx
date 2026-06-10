import React, { useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAppStore } from '../store';
import { T } from '../theme';
import { Dot, Ring, Sparkline, StatusPill, GasBar } from '../components/ui';
import { SensorReading } from '../types';
import { disconnectSocket } from '../services/socket';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RootStackParamList, MainTabParamList } from '../types';

type DashboardNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Dashboard'>,
  StackNavigationProp<RootStackParamList>
>;

// Static sparkline history shapes (will animate via WS updates in future)
const TREND_TEMP   = [20.5, 21.0, 21.4, 21.8, 22.0, 22.1];
const TREND_HUMID  = [58, 57, 56, 55, 54, 54];
const TREND_LUX    = [180, 220, 280, 300, 310, 312];
const TREND_GAS_OK = [148, 150, 152, 149, 148, 148];

function now() {
  return new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function DashboardScreen() {
  const latestReadings = useAppStore((s) => s.latestReadings);
  const nodeStatus     = useAppStore((s) => s.nodeStatus);
  const setLatest      = useAppStore((s) => s.setLatestReading);
  const connected      = useAppStore((s) => s.connected);
  const logout         = useAppStore((s) => s.logout);
  const navigation     = useNavigation<DashboardNavProp>();

  function handleLogout() {
    disconnectSocket();
    logout();
  }

  const { data: nodes, isLoading, refetch } = useQuery({
    queryKey: ['nodes'],
    queryFn: api.sensors.nodes,
    staleTime: 30_000,
  });

  const { data: latest, refetch: refetchLatest } = useQuery({
    queryKey: ['latest'],
    queryFn: api.sensors.latest,
    staleTime: 5_000,
    refetchInterval: 5_000,
  });

  useEffect(() => {
    if (latest) Object.values(latest).forEach((r) => setLatest(r));
  }, [latest]);

  function handleRefresh() { refetch(); refetchLatest(); }

  // Aggregate stats across all nodes for the Hero card
  const allReadings = Object.values(latestReadings);
  const avgTemp  = allReadings.length ? allReadings.reduce((s, r) => s + (r.temperature ?? 0), 0) / allReadings.length : null;
  const avgHumid = allReadings.length ? allReadings.reduce((s, r) => s + (r.humidity ?? 0), 0) / allReadings.length : null;
  const avgLux   = allReadings.length ? allReadings.reduce((s, r) => s + (r.lightLux ?? 0), 0) / allReadings.length : null;
  const maxGas   = allReadings.length ? Math.max(...allReadings.map(r => r.gasLevel ?? 0)) : null;
  const anyGas   = allReadings.some(r => r.gasAlert);
  const onlineCount = (nodes ?? []).filter(n => nodeStatus[n.nodeId] ?? n.online).length;

  // Safety score: 100 - deductions
  const safetyScore = anyGas ? Math.round(100 - ((maxGas! - 350) / 650) * 60) : 92;

  const sortedNodes = nodes ? [...nodes].sort((a, b) => a.nodeId.localeCompare(b.nodeId)) : [];

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={T.accent} />
        }
      >
        {/* ── HEADER ── */}
        <View style={s.header}>
          <View>
            <Text style={s.kicker}>ACASĂ</Text>
            <Text style={s.title}>Dashboard</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <StatusPill kind={connected ? 'live' : 'reconn'} />
            <TouchableOpacity onPress={() => navigation.navigate('Setup')} style={s.logoutBtn} activeOpacity={0.75}>
              <Ionicons name="wifi-outline" size={17} color={T.text2} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={s.logoutBtn} activeOpacity={0.75}>
              <Ionicons name="power" size={16} color={T.text2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── HERO CARD ── */}
        <View style={[s.heroCard, anyGas && s.heroCardAlert]}>
          {/* Glow accent */}
          <View style={[s.heroGlow, anyGas && s.heroGlowAlert]} pointerEvents="none" />

          <View style={s.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={s.heroKicker}>Status general</Text>
              <Text style={[s.heroTitle, anyGas && { color: T.dangerHi }]}>
                {anyGas ? 'Alertă gaz' : 'Totul în regulă'}
              </Text>
              <Text style={s.heroSub}>
                {anyGas
                  ? 'Nivelul de gaz a depășit pragul de siguranță'
                  : onlineCount === (nodes ?? []).length
                    ? 'Toate camerele sunt online'
                    : `${onlineCount} din ${(nodes ?? []).length} camere online`}
              </Text>
            </View>
            <Ring
              value={anyGas ? (maxGas ?? 0) : safetyScore}
              max={anyGas ? 1023 : 100}
              size={88}
              stroke={7}
              color={anyGas ? T.danger : T.success}
              track="rgba(255,255,255,0.06)"
              label={anyGas ? 'Gaz' : 'Sigur'}
              unit={anyGas ? '' : '%'}
            />
          </View>

          {/* Mini stats row */}
          <View style={s.miniRow}>
            <MiniStat
              label="Temp"
              value={avgTemp != null ? avgTemp.toFixed(1) : '—'}
              unit="°C"
              trend={TREND_TEMP}
              color={T.warning}
            />
            <MiniStat
              label="Umiditate"
              value={avgHumid != null ? Math.round(avgHumid).toString() : '—'}
              unit="%"
              trend={TREND_HUMID}
              color={T.info}
            />
            <MiniStat
              label="Lumină"
              value={avgLux != null ? Math.round(avgLux).toString() : '—'}
              unit="lx"
              trend={TREND_LUX}
              color={T.violet}
            />
            <MiniStat
              label="Aer"
              value={anyGas ? 'Atenție' : 'Curat'}
              unit=""
              trend={anyGas ? [150, 200, 280, 350, 400, maxGas ?? 400] : TREND_GAS_OK}
              color={anyGas ? T.danger : T.success}
            />
          </View>
        </View>

        {/* ── CAMERAS HEADER ── */}
        <View style={s.sectionRow}>
          <Text style={s.sectionLabel}>Camere</Text>
          <Text style={s.sectionMeta}>{onlineCount} din {(nodes ?? []).length} online</Text>
        </View>

        {/* ── ROOM TILES 2-column ── */}
        <View style={s.tilesGrid}>
          {sortedNodes.map((node) => {
            const reading = latestReadings[node.nodeId] ?? null;
            const online = nodeStatus[node.nodeId] ?? node.online;
            return (
              <RoomTile
                key={node.nodeId}
                name={node.location}
                nodeId={node.nodeId}
                reading={reading}
                online={online}
              />
            );
          })}
          {sortedNodes.length === 0 && !isLoading && (
            <Text style={s.empty}>Niciun nod găsit.{'\n'}Verifică că backend-ul rulează.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/* ── MINI STAT ───────────────────────────────────── */
function MiniStat({
  label, value, unit, trend, color,
}: { label: string; value: string; unit: string; trend: number[]; color: string }) {
  return (
    <View style={ms.wrap}>
      <Text style={ms.label}>{label}</Text>
      <View style={ms.valRow}>
        <Text style={ms.val}>{value}</Text>
        {unit ? <Text style={ms.unit}>{unit}</Text> : null}
      </View>
      <Sparkline data={trend} width={62} height={16} color={color} strokeWidth={1.4} />
    </View>
  );
}

const ms = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 4, paddingVertical: 2 },
  label: { fontSize: 12, fontWeight: '500', color: T.text3, marginBottom: 4 },
  valRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, marginBottom: 4 },
  val: { fontSize: 18, fontWeight: '600', color: T.text, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 12, color: T.text3, paddingBottom: 2 },
});

/* ── ROOM TILE ───────────────────────────────────── */
function RoomTile({
  name, nodeId, reading, online,
}: { name: string; nodeId: string; reading: SensorReading | null; online: boolean }) {
  const alert = reading?.gasAlert ?? false;
  return (
    <View style={[rt.card, !online && rt.offline]}>
      {alert && <View style={rt.alertStripe} />}
      <View style={rt.header}>
        <View style={{ flex: 1 }}>
          <Text style={rt.name}>{name.charAt(0).toUpperCase() + name.slice(1)}</Text>
          <Text style={rt.subLabel}>{online ? 'Online' : 'Offline'}</Text>
        </View>
        <Dot color={online ? T.success : T.text4} size={7} />
      </View>

      {reading ? (
        <>
          <View style={rt.tempRow}>
            <Text style={[rt.temp, alert && { color: T.danger }]}>
              {reading.temperature?.toFixed(1) ?? '—'}
            </Text>
            <Text style={rt.tempUnit}>°C</Text>
          </View>
          <View style={rt.meta}>
            <Text style={rt.metaText}>{reading.humidity?.toFixed(0) ?? '—'}% umiditate</Text>
            <View style={rt.dot2} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Dot
                color={reading.motion ? T.accent : T.text4}
                size={5}
              />
              <Text style={[rt.metaText, { color: reading.motion ? T.accent : T.text3 }]}>
                {reading.motion ? 'mișcare' : 'liniște'}
              </Text>
            </View>
          </View>
          <Text style={rt.ts}>
            {new Date(reading.time).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </>
      ) : (
        <Text style={rt.noData}>Aștept date…</Text>
      )}
    </View>
  );
}

const rt = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: T.border,
    padding: 14,
    overflow: 'hidden',
    ...T.shadow,
  },
  offline: { opacity: 0.5 },
  alertStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: T.danger },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  name: { fontSize: 16, fontWeight: '600', color: T.text, letterSpacing: -0.2 },
  subLabel: { fontSize: 12, color: T.text3, marginTop: 2 },
  tempRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginBottom: 6 },
  temp: { fontSize: 32, fontWeight: '600', color: T.text, letterSpacing: -1, lineHeight: 34, fontVariant: ['tabular-nums'] },
  tempUnit: { fontSize: 14, color: T.text3, paddingBottom: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  dot2: { width: 2, height: 2, borderRadius: 1, backgroundColor: T.text4 },
  metaText: { fontSize: 12, color: T.text2 },
  ts: { fontSize: 12, color: T.text4 },
  noData: { fontSize: 13, color: T.text3, textAlign: 'center', paddingVertical: 16 },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  content: { paddingBottom: 110 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 60,
    paddingBottom: 16,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '600',
    color: T.text3,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: { fontSize: 30, fontWeight: '700', color: T.text, letterSpacing: -0.8 },
  logoutBtn: {
    width: 34, height: 34,
    borderRadius: 10,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero card
  heroCard: {
    marginHorizontal: 18,
    marginBottom: 14,
    backgroundColor: T.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: T.border,
    padding: 20,
    overflow: 'hidden',
    ...T.shadow,
  },
  heroCardAlert: { borderColor: T.dangerLine },
  heroGlow: {
    position: 'absolute', top: -60, right: -60,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(251,146,60,0.10)',
  },
  heroGlowAlert: { backgroundColor: 'rgba(219,106,94,0.14)' },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 },
  heroKicker: { fontSize: 12, fontWeight: '600', color: T.text3, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  heroTitle: { fontSize: 26, fontWeight: '700', letterSpacing: -0.6, color: T.text, marginBottom: 4 },
  heroSub: { fontSize: 14, color: T.text2, maxWidth: 210, lineHeight: 19 },

  miniRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingTop: 16,
    gap: 4,
  },

  // Section
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 22,
    paddingBottom: 10,
    paddingTop: 6,
  },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: T.text3, letterSpacing: 1, textTransform: 'uppercase' },
  sectionMeta:  { fontSize: 12, color: T.text3 },

  tilesGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 18, gap: 10 },
  empty: { color: T.text4, textAlign: 'center', fontSize: 14, marginTop: 40, lineHeight: 22, width: '100%' },
});
