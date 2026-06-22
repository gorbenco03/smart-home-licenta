import React, { useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAppStore } from '../store';
import { T, F, FONT } from '../theme';
import {
  GlassCard, Icon, Dot, Ring, Sparkline,
  StatusPill, GasBar,
} from '../components/ui';
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
const TREND_TEMP2  = [19.0, 19.5, 20.0, 20.2, 20.5, 20.6];
const TREND_LIGHT  = [300, 350, 400, 420, 410, 415];

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

  // Aggregate stats across all nodes for the Hero card.
  // IMPORTANT: media doar peste citirile care chiar au valoarea respectivă
  // (nodul cameră nu trimite temperatură/umiditate → nu trebuie să tragă media la 0).
  const allReadings = Object.values(latestReadings);
  const tempVals  = allReadings.filter(r => r.temperature != null).map(r => r.temperature);
  const humidVals = allReadings.filter(r => r.humidity != null).map(r => r.humidity);
  const luxVals   = allReadings.filter(r => r.lightLux != null).map(r => r.lightLux);
  const avgTemp  = tempVals.length  ? tempVals.reduce((s, v) => s + v, 0) / tempVals.length   : null;
  const avgHumid = humidVals.length ? humidVals.reduce((s, v) => s + v, 0) / humidVals.length : null;
  const avgLux   = luxVals.length   ? luxVals.reduce((s, v) => s + v, 0) / luxVals.length     : null;
  const maxGas   = allReadings.length ? Math.max(...allReadings.map(r => r.gasLevel ?? 0)) : null;
  const anyGas   = allReadings.some(r => r.gasAlert);
  const onlineCount = (nodes ?? []).filter(n => nodeStatus[n.nodeId] ?? n.online).length;

  // Valori senzori duali (primul nod cu date disponibile)
  const readingWithTemp2  = allReadings.find(r => r.temperature2 != null);
  const readingWithLight1 = allReadings.find(r => r.light1 != null);
  const readingWithLight2 = allReadings.find(r => r.light2 != null);

  // Safety score: 100 - deductions
  const safetyScore = anyGas ? Math.round(100 - ((maxGas! - 350) / 650) * 60) : 92;

  const sortedNodes = nodes ? [...nodes].sort((a, b) => a.nodeId.localeCompare(b.nodeId)) : [];

  const hasLight = readingWithLight1 != null || readingWithLight2 != null;

  // Nodul interior real = un singur ESP32 cu toți senzorii.
  // Zonele Living/Dormitor/Bucătărie sunt derivate din câmpurile lui.
  const indoor =
    allReadings.find(r => r.gasLevel != null || r.temperature2 != null) ??
    allReadings.find(r => r.temperature != null) ?? null;
  const indoorOnline = indoor != null;

  // Nodul exterior (ESP32-CAM) — doar mișcare (PIR)
  const CAM_ID = 'esp32_cam_node';
  const outdoor = latestReadings[CAM_ID] ?? null;
  const outdoorOnline = nodeStatus[CAM_ID] ?? (outdoor != null);

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: T.s.sm }}>
            <StatusPill kind={connected ? 'live' : 'reconn'} />
            <TouchableOpacity
              onPress={() => navigation.navigate('Setup')}
              style={s.iconBtn}
              activeOpacity={0.75}
              accessibilityLabel="Configurare WiFi"
            >
              <Icon name="wifi-outline" size={18} color={T.text2} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleLogout}
              style={s.iconBtn}
              activeOpacity={0.75}
              accessibilityLabel="Deconectare"
            >
              <Icon name="power" size={17} color={T.text2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── HERO CARD ── */}
        <GlassCard
          style={[s.heroCard, anyGas && s.heroCardAlert]}
          tone={anyGas ? 'danger' : 'default'}
          intensity={28}
          padding={0}
        >
          {/* Gradient glow layer */}
          <LinearGradient
            colors={anyGas
              ? ['rgba(251,94,114,0.18)', 'rgba(240,136,62,0.06)', 'transparent'] as const
              : ['rgba(109,139,255,0.14)', 'rgba(34,211,238,0.06)', 'transparent'] as const
            }
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <View style={s.heroPadding}>
            {/* Top row: text + ring */}
            <View style={s.heroTop}>
              <View style={{ flex: 1, paddingRight: T.s.lg }}>
                <Text style={s.heroKicker}>Status general</Text>
                <Text style={[s.heroTitle, anyGas && { color: T.dangerHi }]}>
                  {anyGas ? 'Alerta gaz' : 'Totul in regula'}
                </Text>
                <Text style={s.heroSub}>
                  {anyGas
                    ? 'Nivelul de gaz a depasit pragul de siguranta'
                    : onlineCount === (nodes ?? []).length
                      ? 'Toate camerele sunt online'
                      : `${onlineCount} din ${(nodes ?? []).length} camere online`}
                </Text>
              </View>
              <Ring
                value={anyGas ? (maxGas ?? 0) : safetyScore}
                max={anyGas ? 1023 : 100}
                size={96}
                stroke={8}
                color={anyGas ? T.danger : T.success}
                color2={anyGas ? T.warning : T.cyan}
                track="rgba(255,255,255,0.07)"
                label={anyGas ? 'Gaz' : 'Sigur'}
                unit={anyGas ? '' : '%'}
              />
            </View>

            {/* Mini stats row */}
            <View style={s.divider} />
            <View style={s.miniRow}>
              <MiniStat
                label="Living"
                subLabel="Temp"
                value={avgTemp != null ? avgTemp.toFixed(1) : '—'}
                unit="°C"
                trend={TREND_TEMP}
                color={T.warning}
                icon="thermometer-outline"
              />
              <View style={s.miniDivider} />
              <MiniStat
                label="Living"
                subLabel="Umid."
                value={avgHumid != null ? Math.round(avgHumid).toString() : '—'}
                unit="%"
                trend={TREND_HUMID}
                color={T.info}
                icon="water-outline"
              />
              <View style={s.miniDivider} />
              <MiniStat
                label="Medie"
                subLabel="Lumina"
                value={avgLux != null ? Math.round(avgLux).toString() : '—'}
                unit="lx"
                trend={TREND_LUX}
                color={T.violet}
                icon="sunny-outline"
              />
              <View style={s.miniDivider} />
              <MiniStat
                label="Calitate"
                subLabel="Aer"
                value={anyGas ? 'Atentie' : 'Curat'}
                unit=""
                trend={anyGas ? [150, 200, 280, 350, 400, maxGas ?? 400] : TREND_GAS_OK}
                color={anyGas ? T.danger : T.success}
                icon={anyGas ? 'warning-outline' : 'checkmark-circle-outline'}
              />
            </View>
          </View>
        </GlassCard>

        {/* ── CAMERE / ZONE SECTION ── */}
        <View style={s.sectionRow}>
          <Text style={s.sectionLabel}>Camere</Text>
          <View style={s.sectionMetaRow}>
            <Dot color={indoorOnline ? T.success : T.text3} size={6} glow={indoorOnline} />
            <Text style={s.sectionMeta}>
              {indoorOnline ? 'nod interior online' : 'nod interior offline'}
            </Text>
          </View>
        </View>

        <View style={s.tilesGrid}>
          {/* Living — DHT11 #1 + LDR 1 */}
          <TempZone
            name="Living"
            icon="tv-outline"
            color={T.warning}
            temp={indoor?.temperature ?? null}
            humid={indoor?.humidity ?? null}
            light={indoor?.light1 ?? null}
            online={indoorOnline}
          />
          {/* Dormitor — DHT11 #2 + LDR 2 */}
          <TempZone
            name="Dormitor"
            icon="bed-outline"
            color={T.violet}
            temp={indoor?.temperature2 ?? null}
            humid={indoor?.humidity2 ?? null}
            light={indoor?.light2 ?? null}
            online={indoorOnline}
          />
          {/* Bucătărie — MQ-2 (senzor de gaz) */}
          <GasZone
            gas={indoor?.gasLevel ?? null}
            alert={indoor?.gasAlert ?? false}
            online={indoorOnline}
          />
          {/* Curte — ESP32-CAM (mișcare PIR exterior) */}
          <MotionZone
            motion={outdoor?.motion ?? false}
            online={outdoorOnline}
          />

          {!indoor && !isLoading && (
            <View style={s.emptyWrap}>
              <Icon name="cloud-offline-outline" size={32} color={T.text4} />
              <Text style={s.empty}>
                Nodul interior nu trimite date.{'\n'}Verifica ESP32 / backend-ul.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/* ── MINI STAT ───────────────────────────────────── */
function MiniStat({
  label, subLabel, value, unit, trend, color, icon,
}: {
  label: string;
  subLabel: string;
  value: string;
  unit: string;
  trend: number[];
  color: string;
  icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
}) {
  return (
    <View style={ms.wrap}>
      <View style={ms.iconRow}>
        <Icon name={icon} size={12} color={color} />
        <Text style={ms.label}>{subLabel}</Text>
      </View>
      <Text style={ms.roomLabel}>{label}</Text>
      <View style={ms.valRow}>
        <Text style={[ms.val, { color: T.text }]}>{value}</Text>
        {unit ? <Text style={ms.unit}>{unit}</Text> : null}
      </View>
      <Sparkline data={trend} width={96} height={24} color={color} strokeWidth={1.6} />
    </View>
  );
}

const ms = StyleSheet.create({
  wrap:     { flex: 1, paddingHorizontal: 2, paddingVertical: 2, minWidth: 0 },
  iconRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  label:    { fontSize: 11, fontFamily: FONT.semibold, color: T.text3, letterSpacing: 0.6, textTransform: 'uppercase' },
  roomLabel:{ fontSize: 11, fontFamily: FONT.medium, color: T.text3, marginBottom: 4 },
  valRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 2, marginBottom: 6 },
  val: {
    fontSize: 20, fontFamily: FONT.numBold,
    fontVariant: ['tabular-nums'], letterSpacing: -0.4,
  },
  unit: { fontSize: 11.5, fontFamily: FONT.medium, color: T.text3, paddingBottom: 2 },
});

/* ── ZONĂ cu temperatură (Living / Dormitor) ──────── */
function TempZone({
  name, icon, color, temp, humid, light, online,
}: {
  name: string;
  icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  color: string;
  temp: number | null;
  humid: number | null;
  light: number | null;
  online: boolean;
}) {
  return (
    <GlassCard
      style={[s.roomCard, !online && s.roomOffline]}
      intensity={online ? 22 : 10}
      padding={0}
    >
      <View style={s.roomPadding}>
        <View style={s.roomHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.roomName} numberOfLines={1}>{name}</Text>
            <View style={s.roomStatusRow}>
              <Dot color={online ? T.success : T.text3} size={6} glow={online} />
              <Text style={[s.roomStatus, { color: online ? T.success : T.text3 }]}>
                {online ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
          <View style={[s.zoneIcon, { backgroundColor: T.glass2 }]}>
            <Icon name={icon} size={15} color={color} />
          </View>
        </View>

        {temp != null ? (
          <>
            <View style={s.tempRow}>
              <Text style={s.temp}>{temp.toFixed(1)}</Text>
              <Text style={s.tempUnit}>°C</Text>
            </View>
            <View style={s.metaRow}>
              <View style={s.metaItem}>
                <Icon name="water-outline" size={12} color={T.info} />
                <Text style={s.metaVal}>
                  {humid != null ? humid.toFixed(0) : '—'}
                  <Text style={s.metaUnit}>%</Text>
                </Text>
              </View>
              <View style={s.metaDot} />
              <View style={s.metaItem}>
                <Icon name="sunny-outline" size={12} color={T.accentHi} />
                <Text style={s.metaVal}>
                  {light != null ? String(light) : '—'}
                  <Text style={s.metaUnit}> lx</Text>
                </Text>
              </View>
            </View>
          </>
        ) : (
          <View style={s.noDataWrap}>
            <Icon name="hourglass-outline" size={18} color={T.text3} />
            <Text style={s.noData}>Astept date...</Text>
          </View>
        )}
      </View>
    </GlassCard>
  );
}

/* ── ZONĂ Curte (ESP32-CAM, mișcare PIR) ──────────── */
function MotionZone({
  motion, online,
}: { motion: boolean; online: boolean }) {
  return (
    <GlassCard
      style={[s.roomCard, !online && s.roomOffline]}
      intensity={online ? 22 : 10}
      padding={0}
    >
      <View style={s.roomPadding}>
        <View style={s.roomHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.roomName} numberOfLines={1}>Curte</Text>
            <View style={s.roomStatusRow}>
              <Dot color={online ? T.success : T.text3} size={6} glow={online} />
              <Text style={[s.roomStatus, { color: online ? T.success : T.text3 }]}>
                {online ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
          <View style={[s.zoneIcon, { backgroundColor: motion ? T.accentSoft : T.glass2 }]}>
            <Icon name="videocam-outline" size={15} color={motion ? T.accent : T.info} />
          </View>
        </View>

        <View style={[s.tempRow, { marginTop: 2 }]}>
          <Icon name={motion ? 'walk' : 'shield-checkmark-outline'} size={22} color={motion ? T.accent : T.success} />
          <Text style={[s.motionText, { color: motion ? T.accent : T.text2 }]}>
            {motion ? 'Mișcare' : 'Liniște'}
          </Text>
        </View>
        <View style={s.metaRow}>
          <View style={s.metaItem}>
            <Icon name="camera-outline" size={12} color={T.text3} />
            <Text style={s.metaVal}>flux video în Control</Text>
          </View>
        </View>
      </View>
    </GlassCard>
  );
}

/* ── ZONĂ Bucătărie (senzor de gaz) ───────────────── */
function GasZone({
  gas, alert, online,
}: { gas: number | null; alert: boolean; online: boolean }) {
  return (
    <GlassCard
      style={[s.gasCard, !online && s.roomOffline]}
      tone={alert ? 'danger' : 'default'}
      intensity={online ? 22 : 10}
      padding={0}
    >
      <View style={s.roomPadding}>
        <View style={s.roomHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.roomName} numberOfLines={1}>Bucătărie</Text>
            <View style={s.roomStatusRow}>
              <Dot color={online ? T.success : T.text3} size={6} glow={online} />
              <Text style={[s.roomStatus, { color: online ? T.success : T.text3 }]}>
                {online ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
          <View style={[s.zoneIcon, { backgroundColor: alert ? T.dangerSoft : T.glass2 }]}>
            <Icon name="flame-outline" size={15} color={alert ? T.danger : T.success} />
          </View>
        </View>

        {gas != null ? (
          <View style={{ marginTop: T.s.xs }}>
            <View style={s.gasValueRow}>
              <Text style={[s.gasValue, { color: alert ? T.dangerHi : T.text }]}>{gas}</Text>
              <Text style={s.gasUnit}>nivel gaz (ADC)</Text>
            </View>
            <GasBar value={gas} alert={alert} />
          </View>
        ) : (
          <View style={s.noDataWrap}>
            <Icon name="hourglass-outline" size={18} color={T.text3} />
            <Text style={s.noData}>Astept date...</Text>
          </View>
        )}
      </View>
    </GlassCard>
  );
}

/* ──────────── STYLES ──────────── */

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: T.bg },
  content: { paddingBottom: 110 },

  // ── Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: T.s.xl,
    paddingTop: 60,
    paddingBottom: T.s.lg,
  },
  kicker: {
    ...F.kicker,
    marginBottom: T.s.xs,
  },
  title: {
    ...F.title,
    letterSpacing: -0.8,
  },
  iconBtn: {
    width: 44, height: 44,
    borderRadius: T.r.sm,
    backgroundColor: T.glass2,
    borderWidth: 1,
    borderColor: T.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Hero card
  heroCard: {
    marginHorizontal: T.s.xl,
    marginBottom: T.s.md,
  },
  heroCardAlert: {
    // GlassCard handles border via tone prop
  },
  heroPadding: { padding: T.s.xl },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: T.s.lg,
  },
  heroKicker: { ...F.kicker, marginBottom: T.s.sm },
  heroTitle: {
    ...F.title,
    marginBottom: T.s.xs,
  },
  heroSub: {
    ...F.body,
    lineHeight: 20,
    maxWidth: 200,
  },
  divider: {
    height: 1,
    backgroundColor: T.glassBorder,
    marginBottom: T.s.lg,
  },
  miniRow: {
    flexDirection: 'row',
    gap: 2,
  },
  miniDivider: {
    width: 1,
    backgroundColor: T.glassBorder,
    marginHorizontal: 4,
  },

  // ── Dual sensors grid
  dualGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: T.s.xl,
    gap: T.s.sm,
    marginBottom: T.s.md,
  },
  dualCard: {
    width: '47.5%',
  },
  dualCardEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 110,
    opacity: 0.55,
  },
  dualEmptyText: {
    ...F.caption,
    textAlign: 'center',
    marginTop: T.s.sm,
    lineHeight: 17,
  },
  dualCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.s.xs,
    marginBottom: T.s.sm,
  },
  dualIconWrap: {
    width: 24, height: 24, borderRadius: T.r.xs,
    alignItems: 'center', justifyContent: 'center',
  },
  dualLabel: {
    ...F.label,
    color: T.text,
  },
  dualSublabel: {
    ...F.caption,
    marginLeft: 'auto',
  },
  dualValues: {
    flexDirection: 'row',
    gap: T.s.md,
    marginBottom: T.s.sm,
  },
  dualValueItem: { gap: 2 },
  dualBigNum: {
    fontSize: 22,
    fontFamily: FONT.numBold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  dualBigUnit: {
    fontSize: 13,
    fontFamily: FONT.medium,
    color: T.text3,
  },
  dualCaption: { ...F.caption },

  // ── Section header
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: T.s.xl,
    paddingBottom: T.s.sm,
    paddingTop: T.s.md,
  },
  sectionLabel: { ...F.kicker },
  sectionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.s.xs,
  },
  sectionMeta: { ...F.caption },

  // ── Tiles grid
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: T.s.xl,
    gap: T.s.sm,
  },

  // ── Room tile
  roomCard: {
    width: '47.5%',
  },
  gasCard: {
    width: '47.5%',
  },
  motionText: {
    fontSize: 18,
    fontFamily: FONT.displaySemi,
    letterSpacing: -0.3,
  },
  zoneIcon: {
    width: 30, height: 30, borderRadius: T.r.sm,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: T.glassBorder,
  },
  gasValueRow: {
    flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: T.s.sm,
  },
  gasValue: {
    fontSize: 28, fontFamily: FONT.numBold,
    fontVariant: ['tabular-nums'], letterSpacing: -0.6,
  },
  gasUnit: { ...F.caption },
  roomOffline: { opacity: 0.5 },
  alertBand: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 3,
    borderTopLeftRadius: T.r.lg,
    borderTopRightRadius: T.r.lg,
  },
  roomPadding: { padding: T.s.md },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: T.s.sm,
  },
  roomName: {
    fontSize: 15,
    fontFamily: FONT.semibold,
    color: T.text,
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  roomStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.s.xs,
  },
  roomStatus: {
    fontSize: 11.5,
    fontFamily: FONT.medium,
  },
  alertBadge: {
    width: 24, height: 24, borderRadius: T.r.xs,
    backgroundColor: T.dangerSoft,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: T.dangerLine,
  },
  tempRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    marginBottom: T.s.sm,
  },
  temp: {
    fontSize: 34,
    fontFamily: FONT.numBold,
    fontVariant: ['tabular-nums'],
    color: T.text,
    letterSpacing: -1,
    lineHeight: 36,
  },
  tempUnit: {
    fontSize: 14,
    fontFamily: FONT.medium,
    color: T.text3,
    paddingBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.s.sm,
    marginBottom: T.s.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.s.xs,
  },
  metaVal: {
    fontSize: 12,
    fontFamily: FONT.medium,
    color: T.text2,
    fontVariant: ['tabular-nums'],
  },
  metaUnit: {
    fontSize: 11,
    fontFamily: FONT.medium,
    color: T.text3,
  },
  metaDot: {
    width: 2, height: 2, borderRadius: 1,
    backgroundColor: T.text3,
  },
  tsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.s.xs,
  },
  tsText: {
    fontSize: 11.5,
    fontFamily: FONT.medium,
    color: T.text3,
    fontVariant: ['tabular-nums'],
  },
  noDataWrap: {
    alignItems: 'center',
    paddingVertical: T.s.lg,
    gap: T.s.sm,
  },
  noData: { ...F.caption, textAlign: 'center' },

  // ── Empty state
  emptyWrap: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 40,
    gap: T.s.md,
  },
  empty: {
    ...F.body,
    color: T.text3,
    textAlign: 'center',
    lineHeight: 22,
  },
});
