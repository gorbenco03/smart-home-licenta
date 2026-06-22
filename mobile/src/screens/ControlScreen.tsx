import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, Image, SafeAreaView, ActivityIndicator, Pressable,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { api } from '../services/api';
import { useAppStore } from '../store';
import { T, F, FONT } from '../theme';
import { GlassCard, Icon, Dot, IosSwitch, SectionHeader } from '../components/ui';
import { CAMERA_STREAM_URL, CAMERA_SNAPSHOT_URL } from '../services/config';
import type { RootStackParamList } from '../types';

/* ─── Constante nod ──────────────────────────────── */

const SENSOR_NODE_ID = 'esp32_node_a';   // nodul interior
const CAM_NODE_ID    = 'esp32_cam_node'; // camera din curte

type IonName = keyof typeof Ionicons.glyphMap;

const LED_DEFS: Array<{ index: number; label: string; icon: IonName }> = [
  { index: 0, label: 'LED 1 — Living',   icon: 'bulb' },
  { index: 1, label: 'LED 2 — Dormitor', icon: 'bulb-outline' },
  { index: 2, label: 'LED 3 — Baie',     icon: 'flash' },
  { index: 3, label: 'LED 4 — Curte',    icon: 'flashlight' },
];

type SceneKey = 'acasa' | 'plec' | 'noapte' | 'cinema';

const SCENES: Array<{ key: SceneKey; label: string; icon: IonName }> = [
  { key: 'acasa',  label: 'Acasă',  icon: 'home' },
  { key: 'plec',   label: 'Plec',   icon: 'walk' },
  { key: 'noapte', label: 'Noapte', icon: 'moon' },
  { key: 'cinema', label: 'Cinema', icon: 'film' },
];

const SERVO_PRESETS: Array<{ label: string; angle: number; icon: IonName }> = [
  { label: 'Deschis', angle: 0,   icon: 'sunny' },
  { label: '50%',     angle: 90,  icon: 'contrast' },
  { label: 'Inchis',  angle: 180, icon: 'moon' },
];

/* ─── SCREEN ─────────────────────────────────────── */

export default function ControlScreen() {
  const nodeStatus = useAppStore((s) => s.nodeStatus);
  const [activeScene, setActiveScene] = useState<SceneKey>('acasa');
  const [streamOpen, setStreamOpen]   = useState(false);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  // Fallback de status: la repornirea aplicației socket-ul încă n-a primit
  // node_status, deci folosim online-ul din REST (calculat după lastSeen).
  const { data: nodes } = useQuery({
    queryKey: ['nodes'],
    queryFn: api.sensors.nodes,
    refetchInterval: 15_000,
  });
  const restOnline = (nodes ?? []).reduce(
    (acc, n) => { acc[n.nodeId] = n.online; return acc; },
    {} as Record<string, boolean>,
  );
  const isOnline = (id: string) => nodeStatus[id] ?? restOnline[id] ?? false;

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ───────────────────────────── */}
        <View style={s.header}>
          <Text style={s.kicker}>Comenzi</Text>
          <Text style={s.title}>Control</Text>
        </View>

        {/* ── Programări orare ─────────────────── */}
        <TouchableOpacity
          style={s.scheduleEntry}
          onPress={() => navigation.navigate('Program')}
          activeOpacity={0.78}
        >
          <View style={s.scheduleLeft}>
            <View style={s.scheduleIconBox}>
              <Ionicons name="time-outline" size={18} color={T.accent} />
            </View>
            <View>
              <Text style={s.scheduleTitle}>Programări orare</Text>
              <Text style={s.scheduleSub}>Automatizare pe baza orei si zilei</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={T.text4} />
        </TouchableOpacity>

        {/* ── Cameră ──────────────────────────── */}
        <CameraCard onOpenStream={() => setStreamOpen(true)} />

        {/* ── Scene presets ────────────────────── */}
        <View style={s.section}>
          <SectionHeader title="Scene" icon="layers" />
          <View style={s.scenesGrid}>
            {SCENES.map(sc => {
              const active = activeScene === sc.key;
              return (
                <TouchableOpacity
                  key={sc.key}
                  style={[s.sceneCard, active && s.sceneCardActive]}
                  onPress={() => setActiveScene(sc.key)}
                  activeOpacity={0.75}
                >
                  <View style={[s.sceneIconBox, active && s.sceneIconBoxActive]}>
                    <Ionicons
                      name={sc.icon}
                      size={18}
                      color={active ? T.accent : T.text2}
                    />
                  </View>
                  <Text style={[s.sceneLabel, active && s.sceneLabelActive]}>
                    {sc.label}
                  </Text>
                  {active && <View style={s.sceneActiveDot} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Servo — draperii ──────────────────── */}
        <ServoCard nodeId={SENSOR_NODE_ID} online={isOnline(SENSOR_NODE_ID)} />

        {/* ── LED-uri ──────────────────────────── */}
        <LedCard
          nodeId={SENSOR_NODE_ID}
          online={isOnline(SENSOR_NODE_ID)}
        />

        {/* ── Ventilator ───────────────────────── */}
        <FanCard
          nodeId={SENSOR_NODE_ID}
          online={isOnline(SENSOR_NODE_ID)}
        />

        {/* ── Detecție mișcare (PIR) ───────────── */}
        <MotionCard
          nodeId={SENSOR_NODE_ID}
          online={isOnline(SENSOR_NODE_ID)}
        />

        {/* ── Quick actions ─────────────────────── */}
        <View style={s.quickRow}>
          <QuickActionButton
            icon="notifications"
            label="Test alarma"
            nodeId={SENSOR_NODE_ID}
            action="buzzer_beep"
          />
          <QuickActionButton
            icon="power"
            label="Oprire totala"
            nodeId={SENSOR_NODE_ID}
            action="all_off"
            danger
          />
        </View>

        <View style={s.bottomSpacer} />
      </ScrollView>

      {/* ── Full-screen stream modal ──────────── */}
      <StreamModal visible={streamOpen} onClose={() => setStreamOpen(false)} />
    </View>
  );
}

/* ─── STREAM MODAL ───────────────────────────────── */
function StreamModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={sm.root}>
        {/* Dark scrim + safe area toolbar */}
        <SafeAreaView style={sm.safeArea}>
          <View style={sm.toolbar}>
            <TouchableOpacity
              onPress={onClose}
              style={sm.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <View style={sm.closeBtnInner}>
                <Ionicons name="close" size={18} color={T.text} />
              </View>
            </TouchableOpacity>

            <View style={sm.titleRow}>
              <View style={sm.liveDotWrap}>
                <Dot color={T.danger} size={6} glow />
              </View>
              <Text style={sm.toolbarTitle}>Curte — Live</Text>
            </View>

            {/* Spacer to center title */}
            <View style={sm.closeBtnSpacer} />
          </View>
        </SafeAreaView>

        {/* MJPEG nu se randeaza ca URI direct in WebView — il invelim intr-un
            <img> pe fundal negru, scalat sa incapa. */}
        <WebView
          source={{
            html: `<!DOCTYPE html><html><head>
              <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
              <style>
                html,body{margin:0;height:100%;background:#000;}
                .wrap{display:flex;align-items:center;justify-content:center;height:100%;}
                img{max-width:100%;max-height:100%;object-fit:contain;}
              </style></head>
              <body><div class="wrap">
                <img src="${CAMERA_STREAM_URL}" />
              </div></body></html>`,
          }}
          originWhitelist={['*']}
          style={sm.webview}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          allowsInlineMediaPlayback
          startInLoadingState
          renderLoading={() => (
            <View style={sm.loading}>
              <ActivityIndicator color={T.accent} size="large" />
              <Text style={sm.loadingText}>Conectare la camera...</Text>
            </View>
          )}
        />
      </View>
    </Modal>
  );
}

const sm = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#000' },
  safeArea: { backgroundColor: 'rgba(7,10,20,0.92)' },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: T.glassBorder,
  },
  closeBtn: { padding: 2 },
  closeBtnInner: {
    width: 36, height: 36, borderRadius: T.r.sm,
    backgroundColor: T.glass2, borderWidth: 1, borderColor: T.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnSpacer: { width: 36 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDotWrap: { marginTop: 1 },
  toolbarTitle: { ...F.heading, fontSize: 16 },
  webview: { flex: 1 },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    gap: 14, backgroundColor: '#000',
  },
  loadingText: { ...F.body, color: T.text2 },
});

/* ─── CAMERA CARD ────────────────────────────────── */
function CameraCard({ onOpenStream }: { onOpenStream: () => void }) {
  const [ts, setTs] = useState(Date.now());
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setTs(Date.now()), 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const snapshotUrl = `${CAMERA_SNAPSHOT_URL}?t=${ts}`;

  return (
    <GlassCard style={cc.card} padding={0}>
      {/* Header */}
      <View style={cc.header}>
        <View style={cc.headerLeft}>
          <View style={cc.iconBox}>
            <Ionicons name="videocam" size={17} color={T.accent} />
          </View>
          <View>
            <Text style={cc.cardTitle}>Curte</Text>
            <Text style={cc.cardSub}>Supraveghere live</Text>
          </View>
        </View>
        {/* LIVE badge */}
        <View style={cc.livePill}>
          <Dot color={T.danger} size={6} glow />
          <Text style={cc.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Snapshot preview */}
      <View style={cc.previewWrap}>
        <Image
          source={{ uri: snapshotUrl }}
          style={cc.preview}
          resizeMode="cover"
          onError={() => {}}
        />
        {/* Vignette overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(7,10,20,0.55)']}
          style={cc.vignette}
          pointerEvents="none"
        />
      </View>

      {/* CTA — Vezi live */}
      <TouchableOpacity onPress={onOpenStream} activeOpacity={0.85} style={cc.streamBtnWrap}>
        <LinearGradient
          colors={T.grad.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={cc.streamBtn}
        >
          <Ionicons name="play-circle" size={18} color="#fff" />
          <Text style={cc.streamBtnText}>Vezi live</Text>
        </LinearGradient>
      </TouchableOpacity>
    </GlassCard>
  );
}

const cc = StyleSheet.create({
  card: {
    marginHorizontal: T.s.xl, marginBottom: T.s.md,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: T.s.xl, paddingTop: T.s.xl, paddingBottom: T.s.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 36, height: 36, borderRadius: T.r.sm,
    backgroundColor: T.accentSoft, borderWidth: 1, borderColor: T.accentLine,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { ...F.heading, fontSize: 16 },
  cardSub:   { ...F.caption, marginTop: 2 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: T.dangerSoft, borderRadius: T.r.pill,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: T.dangerLine,
  },
  liveText: {
    fontSize: 11, fontFamily: FONT.bold, color: T.dangerHi, letterSpacing: 1,
    textTransform: 'uppercase',
  },
  previewWrap: {
    marginHorizontal: T.s.xl, marginBottom: T.s.md,
    height: 168, borderRadius: T.r.md, overflow: 'hidden',
    backgroundColor: T.surface3,
  },
  preview: { width: '100%', height: '100%' },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: T.r.md,
  },
  streamBtnWrap: {
    marginHorizontal: T.s.xl, marginBottom: T.s.xl,
    borderRadius: T.r.sm, overflow: 'hidden',
  },
  streamBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13,
    ...T.glow,
  },
  streamBtnText: {
    fontSize: 15, fontFamily: FONT.semibold, color: '#fff', letterSpacing: -0.1,
  },
});

/* ─── SERVO CARD (Draperii) ───────────────────────── */
function ServoCard({ nodeId, online }: { nodeId: string; online: boolean }) {
  const [activeAngle, setActiveAngle] = useState<number>(0);

  const mutation = useMutation({
    mutationFn: (angle: number) =>
      api.commands.send(nodeId, 'servo_move', { servoAngle: angle }),
    onSuccess: (_, angle) => setActiveAngle(angle),
  });

  function sendServo(angle: number) {
    mutation.mutate(angle);
  }

  return (
    <GlassCard style={sv.card}>
      {/* Header */}
      <View style={sv.header}>
        <View style={sv.headerLeft}>
          <View style={sv.iconBox}>
            <Ionicons name="reorder-four" size={17} color={T.accent} />
          </View>
          <View>
            <Text style={sv.cardTitle}>Draperii</Text>
            <Text style={sv.cardSub}>Living</Text>
          </View>
        </View>
        <View style={sv.statusRow}>
          <Dot color={online ? T.success : T.text4} size={7} glow={online} />
          <Text style={[sv.statusText, { color: online ? T.success : T.text4 }]}>
            {online ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Preset buttons */}
      <View style={sv.btnRow}>
        {SERVO_PRESETS.map(p => {
          const active = activeAngle === p.angle;
          return (
            <TouchableOpacity
              key={p.angle}
              style={[sv.btn, active ? sv.btnActive : sv.btnInactive]}
              onPress={() => sendServo(p.angle)}
              activeOpacity={0.75}
              disabled={!online}
            >
              <View style={[sv.btnIconWrap, active && sv.btnIconWrapActive]}>
                <Ionicons
                  name={p.icon}
                  size={18}
                  color={active ? T.accent : T.text2}
                />
              </View>
              <Text style={[sv.btnLabel, active && sv.btnLabelActive]}>
                {p.label}
              </Text>
              {active && <View style={sv.activePip} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {!online && (
        <View style={sv.offlineWrap}>
          <Ionicons name="cloud-offline-outline" size={14} color={T.text4} />
          <Text style={sv.offlineText}>Nodul este offline</Text>
        </View>
      )}
    </GlassCard>
  );
}

const sv = StyleSheet.create({
  card: { marginHorizontal: T.s.xl, marginBottom: T.s.md },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: T.s.lg,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 36, height: 36, borderRadius: T.r.sm,
    backgroundColor: T.accentSoft, borderWidth: 1, borderColor: T.accentLine,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { ...F.heading, fontSize: 16 },
  cardSub:   { ...F.caption, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontSize: 12, fontFamily: FONT.medium },
  btnRow: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1, alignItems: 'center', gap: 6,
    borderRadius: T.r.md, paddingVertical: 14, paddingHorizontal: 8,
    borderWidth: 1,
    position: 'relative',
  },
  btnInactive: {
    backgroundColor: T.glass,
    borderColor: T.glassBorder,
  },
  btnActive: {
    backgroundColor: T.accentSoft,
    borderColor: T.accentLine,
    ...T.glow,
  },
  btnIconWrap: {
    width: 34, height: 34, borderRadius: T.r.xs,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.glass2,
  },
  btnIconWrapActive: {
    backgroundColor: 'rgba(109,139,255,0.28)',
  },
  btnLabel: {
    fontSize: 12.5, fontFamily: FONT.semibold, color: T.text2,
  },
  btnLabelActive: { color: T.accentHi },
  activePip: {
    position: 'absolute', bottom: 7,
    width: 18, height: 3, borderRadius: T.r.pill,
    backgroundColor: T.accent,
  },
  offlineWrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 12,
  },
  offlineText: { ...F.caption, color: T.text4 },
});

/* ─── LED CARD ───────────────────────────────────── */
function LedCard({ nodeId, online }: { nodeId: string; online: boolean }) {
  const [leds, setLeds] = useState<Record<number, boolean>>({ 0: false, 1: false, 2: false, 3: false });

  const mutation = useMutation({
    mutationFn: ({ action, led }: { action: string; led: number }) =>
      api.commands.send(nodeId, action, { led }),
    onSuccess: (_, vars) => {
      setLeds(prev => ({ ...prev, [vars.led]: vars.action === 'led_on' }));
    },
  });

  const activeCount = Object.values(leds).filter(Boolean).length;

  return (
    <GlassCard style={rc.card} padding={0}>
      {/* Card header */}
      <View style={rc.cardHeader}>
        <View style={rc.headerLeft}>
          <View style={rc.iconBox}>
            <Ionicons name="bulb" size={17} color={T.accent} />
          </View>
          <View>
            <Text style={rc.cardTitle}>LED-uri</Text>
            <Text style={rc.cardSub}>Iluminat (3 interior + curte)</Text>
          </View>
        </View>
        <View style={[rc.countBadge, activeCount > 0 && rc.countBadgeActive]}>
          <Text style={[rc.countText, { color: activeCount > 0 ? T.accentHi : T.text3 }]}>
            {activeCount}/{LED_DEFS.length}
          </Text>
          <Text style={[rc.countLabel, { color: activeCount > 0 ? T.text3 : T.text4 }]}>
            {' '}active
          </Text>
        </View>
      </View>

      {/* Divider */}
      <View style={rc.divider} />

      {LED_DEFS.map((led, i) => {
        const on = leds[led.index];
        return (
          <TouchableOpacity
            key={led.index}
            style={[rc.row, i === LED_DEFS.length - 1 && rc.rowLast]}
            onPress={() =>
              mutation.mutate({ action: on ? 'led_off' : 'led_on', led: led.index })
            }
            activeOpacity={0.7}
            disabled={!online || mutation.isPending}
          >
            <View style={[rc.ledIconBox, on && rc.ledIconBoxOn]}>
              <Ionicons
                name={led.icon}
                size={16}
                color={on ? T.accent : T.text2}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[rc.ledLabel, on && rc.ledLabelOn]}>{led.label}</Text>
              <Text style={[rc.ledStatus, { color: on ? T.accentHi : T.text4 }]}>
                {on ? 'Pornit' : 'Oprit'}
              </Text>
            </View>
            <IosSwitch on={on} />
          </TouchableOpacity>
        );
      })}

      {!online && (
        <View style={rc.offlineWrap}>
          <Ionicons name="cloud-offline-outline" size={14} color={T.text4} />
          <Text style={rc.offlineText}>Nodul este offline</Text>
        </View>
      )}
    </GlassCard>
  );
}

/* ─── FAN CARD (manual + automat cu prag setabil) ── */
/* ─── MOTION CARD (armare PIR din telefon) ─────────── */
function MotionCard({ nodeId, online }: { nodeId: string; online: boolean }) {
  const reading = useAppStore((s) => s.latestReadings[nodeId]);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (reading?.motionArmed != null) setArmed(reading.motionArmed);
  }, [reading?.motionArmed]);

  const armMut = useMutation({
    mutationFn: (on: boolean) =>
      api.commands.send(nodeId, on ? 'motion_arm' : 'motion_disarm'),
    onSuccess: (_, on) => setArmed(on),
  });

  const motionNow = reading?.motion ?? false;
  const disabled = !online;

  return (
    <GlassCard style={rc.card} padding={0}>
      <View style={rc.cardHeader}>
        <View style={rc.headerLeft}>
          <View style={[rc.iconBox, { backgroundColor: T.accentSoft, borderColor: T.accentLine }]}>
            <Ionicons name="walk" size={17} color={T.accent} />
          </View>
          <View>
            <Text style={rc.cardTitle}>Detecție mișcare</Text>
            <Text style={rc.cardSub}>Senzor PIR · Curte</Text>
          </View>
        </View>
        <View style={[rc.countBadge, armed && rc.countBadgeFan]}>
          <Text style={[rc.countText, { color: armed ? (motionNow ? T.danger : T.accent) : T.text3 }]}>
            {armed ? (motionNow ? 'MIȘCARE' : 'ARMAT') : 'DEZARMAT'}
          </Text>
        </View>
      </View>

      <View style={rc.divider} />

      <TouchableOpacity
        style={[rc.row, rc.rowLast]}
        onPress={() => armMut.mutate(!armed)}
        activeOpacity={0.7}
        disabled={disabled || armMut.isPending}
      >
        <View style={[rc.ledIconBox, armed && rc.ledIconBoxFan]}>
          <Ionicons name="shield-checkmark" size={16} color={armed ? T.accent : T.text2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[rc.ledLabel, armed && rc.ledLabelFan]}>Alarmă mișcare</Text>
          <Text style={[rc.ledStatus, { color: armed ? T.accent : T.text4 }]}>
            {armed ? 'Activă — aprinde becul + alarmă la mișcare' : 'Oprită'}
          </Text>
        </View>
        <IosSwitch on={armed} color={T.accent} />
      </TouchableOpacity>
    </GlassCard>
  );
}

function FanCard({ nodeId, online }: { nodeId: string; online: boolean }) {
  const reading = useAppStore((s) => s.latestReadings[nodeId]);
  const [fanOn, setFanOn]         = useState(false);
  const [fanAuto, setFanAuto]     = useState(true);
  const [threshold, setThreshold] = useState(28);

  // Sincronizează cu starea reală raportată de nod
  useEffect(() => {
    if (reading?.fanOn != null)        setFanOn(reading.fanOn);
    if (reading?.fanAuto != null)      setFanAuto(reading.fanAuto);
    if (reading?.fanThreshold != null) setThreshold(Math.round(reading.fanThreshold));
  }, [reading?.fanOn, reading?.fanAuto, reading?.fanThreshold]);

  const manualMut = useMutation({
    mutationFn: (on: boolean) => api.commands.send(nodeId, on ? 'fan_on' : 'fan_off'),
    onSuccess: (_, on) => { setFanOn(on); setFanAuto(false); },
  });
  const autoMut = useMutation({
    mutationFn: () => api.commands.send(nodeId, 'fan_auto'),
    onSuccess: () => setFanAuto(true),
  });
  const thrMut = useMutation({
    mutationFn: (value: number) => api.commands.send(nodeId, 'fan_threshold', { value }),
    onSuccess: (_, value) => setThreshold(value),
  });

  function changeThreshold(delta: number) {
    const v = Math.min(40, Math.max(10, threshold + delta));
    if (v !== threshold) thrMut.mutate(v);
  }

  const disabled = !online;

  return (
    <GlassCard style={rc.card} padding={0}>
      {/* Card header */}
      <View style={rc.cardHeader}>
        <View style={rc.headerLeft}>
          <View style={[rc.iconBox, { backgroundColor: T.infoSoft, borderColor: 'rgba(56,189,248,0.45)' }]}>
            <Ionicons name="leaf" size={17} color={T.info} />
          </View>
          <View>
            <Text style={rc.cardTitle}>Ventilator</Text>
            <Text style={rc.cardSub}>Circulatie aer</Text>
          </View>
        </View>
        <View style={[rc.countBadge, (fanAuto || fanOn) && rc.countBadgeFan]}>
          <Text style={[rc.countText, { color: fanAuto ? T.accent : (fanOn ? T.info : T.text3) }]}>
            {fanAuto ? 'AUTO' : (fanOn ? 'PORNIT' : 'OPRIT')}
          </Text>
        </View>
      </View>

      <View style={rc.divider} />

      {/* Comandă manuală pornit / oprit */}
      <TouchableOpacity
        style={rc.row}
        onPress={() => manualMut.mutate(!fanOn)}
        activeOpacity={0.7}
        disabled={disabled || manualMut.isPending}
      >
        <View style={[rc.ledIconBox, fanOn && rc.ledIconBoxFan]}>
          <Ionicons name="leaf" size={16} color={fanOn ? T.info : T.text2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[rc.ledLabel, fanOn && rc.ledLabelFan]}>Ventilator 5V</Text>
          <Text style={[rc.ledStatus, { color: fanOn ? T.info : T.text4 }]}>
            {fanOn ? 'Pornit (manual)' : 'Oprit'}
          </Text>
        </View>
        <IosSwitch on={fanOn} color={T.info} />
      </TouchableOpacity>

      {/* Mod automat */}
      <TouchableOpacity
        style={rc.row}
        onPress={() => (fanAuto ? manualMut.mutate(fanOn) : autoMut.mutate())}
        activeOpacity={0.7}
        disabled={disabled || autoMut.isPending}
      >
        <View style={[rc.ledIconBox, fanAuto && { backgroundColor: T.accentSoft, borderColor: T.accentLine }]}>
          <Ionicons name="thermometer-outline" size={16} color={fanAuto ? T.accent : T.text2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[rc.ledLabel, fanAuto && rc.ledLabelFan]}>Mod automat</Text>
          <Text style={[rc.ledStatus, { color: fanAuto ? T.accent : T.text4 }]}>
            {fanAuto ? 'Pornește singur la prag' : 'Dezactivat'}
          </Text>
        </View>
        <IosSwitch on={fanAuto} color={T.accent} />
      </TouchableOpacity>

      {/* Prag de temperatură (activ în mod automat) */}
      <View style={[rc.row, rc.rowLast, { opacity: fanAuto ? 1 : 0.45 }]}>
        <View style={rc.ledIconBox}>
          <Ionicons name="options-outline" size={16} color={T.text2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={rc.ledLabel}>Prag pornire</Text>
          <Text style={[rc.ledStatus, { color: T.text4 }]}>temperatura de declanșare</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity
            onPress={() => changeThreshold(-1)}
            disabled={disabled || !fanAuto || thrMut.isPending}
            style={fanStep.btn}
            activeOpacity={0.7}
          >
            <Ionicons name="remove" size={18} color={T.text} />
          </TouchableOpacity>
          <Text style={fanStep.val}>{threshold}°C</Text>
          <TouchableOpacity
            onPress={() => changeThreshold(1)}
            disabled={disabled || !fanAuto || thrMut.isPending}
            style={fanStep.btn}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={18} color={T.text} />
          </TouchableOpacity>
        </View>
      </View>

      {!online && (
        <View style={rc.offlineWrap}>
          <Ionicons name="cloud-offline-outline" size={14} color={T.text4} />
          <Text style={rc.offlineText}>Nodul este offline</Text>
        </View>
      )}
    </GlassCard>
  );
}

const fanStep = StyleSheet.create({
  btn: {
    width: 34, height: 34, borderRadius: T.r.sm,
    backgroundColor: T.glass2, borderWidth: 1, borderColor: T.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  val: {
    minWidth: 52, textAlign: 'center',
    fontSize: 17, fontFamily: FONT.numBold, color: T.text,
    fontVariant: ['tabular-nums'],
  },
});

const rc = StyleSheet.create({
  card: {
    marginHorizontal: T.s.xl, marginBottom: T.s.md,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: T.s.xl, paddingVertical: T.s.lg,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 36, height: 36, borderRadius: T.r.sm,
    backgroundColor: T.accentSoft, borderWidth: 1, borderColor: T.accentLine,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { ...F.heading, fontSize: 16 },
  cardSub:   { ...F.caption, marginTop: 2 },
  countBadge: {
    flexDirection: 'row', alignItems: 'baseline',
    backgroundColor: T.glass, borderRadius: T.r.sm,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: T.glassBorder,
  },
  countBadgeActive: { backgroundColor: T.accentSoft, borderColor: T.accentLine },
  countBadgeFan:    { backgroundColor: T.infoSoft,   borderColor: 'rgba(56,189,248,0.45)' },
  countText:  { fontFamily: FONT.num, fontSize: 14 },
  countLabel: { fontFamily: FONT.medium, fontSize: 12 },
  divider: { height: 1, backgroundColor: T.glassBorder, marginHorizontal: T.s.xl },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: T.s.xl, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: T.glassBorder,
  },
  rowLast: { borderBottomWidth: 0 },
  ledIconBox: {
    width: 36, height: 36, borderRadius: T.r.sm,
    backgroundColor: T.glass2, borderWidth: 1, borderColor: T.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  ledIconBoxOn:  { backgroundColor: T.accentSoft, borderColor: T.accentLine },
  ledIconBoxFan: { backgroundColor: T.infoSoft,   borderColor: 'rgba(56,189,248,0.45)' },
  ledLabel:    { ...F.body, color: T.text },
  ledLabelOn:  { color: T.text, fontFamily: FONT.semibold },
  ledLabelFan: { color: T.text, fontFamily: FONT.semibold },
  ledStatus: { fontSize: 12, fontFamily: FONT.medium, marginTop: 2 },
  offlineWrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, paddingHorizontal: T.s.xl,
  },
  offlineText: { ...F.caption, color: T.text4 },
});

/* ─── QUICK ACTION BUTTON ────────────────────────── */
function QuickActionButton({
  icon, label, nodeId, action, danger,
}: { icon: IonName; label: string; nodeId: string; action: string; danger?: boolean }) {
  const mutation = useMutation({
    mutationFn: () => api.commands.send(nodeId, action as any),
  });

  if (danger) {
    return (
      <TouchableOpacity
        style={[qa.btn, qa.btnDanger]}
        onPress={() => mutation.mutate()}
        disabled={mutation.isPending}
        activeOpacity={0.75}
      >
        <View style={qa.dangerIconBox}>
          <Ionicons name={icon} size={17} color={T.dangerHi} />
        </View>
        <Text style={qa.labelDanger}>{label}</Text>
        {mutation.isPending && (
          <ActivityIndicator size="small" color={T.dangerHi} style={{ marginLeft: 'auto' }} />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={qa.btn}
      onPress={() => mutation.mutate()}
      disabled={mutation.isPending}
      activeOpacity={0.75}
    >
      <View style={qa.iconBox}>
        <Ionicons name={icon} size={17} color={T.text2} />
      </View>
      <Text style={qa.label}>{label}</Text>
      {mutation.isPending && (
        <ActivityIndicator size="small" color={T.accent} style={{ marginLeft: 'auto' }} />
      )}
    </TouchableOpacity>
  );
}

const qa = StyleSheet.create({
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: T.glass, borderWidth: 1, borderColor: T.glassBorder,
    borderRadius: T.r.md, paddingVertical: 14, paddingHorizontal: 14,
    ...T.shadow,
  },
  btnDanger: {
    backgroundColor: T.dangerSoft,
    borderColor: T.dangerLine,
  },
  iconBox: {
    width: 32, height: 32, borderRadius: T.r.xs,
    backgroundColor: T.glass2, borderWidth: 1, borderColor: T.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  dangerIconBox: {
    width: 32, height: 32, borderRadius: T.r.xs,
    backgroundColor: 'rgba(251,94,114,0.22)', borderWidth: 1, borderColor: T.dangerLine,
    alignItems: 'center', justifyContent: 'center',
  },
  label:       { ...F.label, color: T.text, flex: 1 },
  labelDanger: { ...F.label, color: T.dangerHi, flex: 1 },
});

/* ─── SCREEN STYLES ──────────────────────────────── */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  content: { paddingBottom: 24 },
  bottomSpacer: { height: 86 },

  /* Header */
  header: {
    paddingHorizontal: T.s.xl, paddingTop: 60, paddingBottom: T.s.lg,
  },
  kicker: { ...F.kicker, marginBottom: 6 },
  title:  { ...F.display },

  /* Section wrapper */
  section: { paddingHorizontal: T.s.xl, marginBottom: T.s.md },

  /* Scenes grid */
  scenesGrid: { flexDirection: 'row', gap: 8 },
  sceneCard: {
    flex: 1, alignItems: 'center', gap: 6,
    paddingVertical: 14, paddingHorizontal: 4,
    backgroundColor: T.glass, borderRadius: T.r.md,
    borderWidth: 1, borderColor: T.glassBorder,
    position: 'relative',
  },
  sceneCardActive: {
    backgroundColor: T.accentSoft, borderColor: T.accentLine,
    ...T.glow,
  },
  sceneIconBox: {
    width: 34, height: 34, borderRadius: T.r.xs,
    backgroundColor: T.glass2, borderWidth: 1, borderColor: T.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  sceneIconBoxActive: {
    backgroundColor: 'rgba(109,139,255,0.28)',
    borderColor: T.accentLine,
  },
  sceneLabel:       { ...F.caption, color: T.text2 },
  sceneLabelActive: { color: T.accentHi, fontFamily: FONT.semibold },
  sceneActiveDot: {
    position: 'absolute', bottom: 6,
    width: 16, height: 3, borderRadius: T.r.pill,
    backgroundColor: T.accent,
  },

  /* Quick actions row */
  quickRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: T.s.xl, marginTop: 4,
  },

  /* Schedule entry */
  scheduleEntry: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: T.s.xl, marginBottom: T.s.md,
    backgroundColor: T.glass2, borderWidth: 1, borderColor: T.glassBorder,
    borderRadius: T.r.md, paddingHorizontal: T.s.lg, paddingVertical: 14,
    ...T.shadow,
  },
  scheduleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scheduleIconBox: {
    width: 36, height: 36, borderRadius: T.r.sm,
    backgroundColor: T.accentSoft, borderWidth: 1, borderColor: T.accentLine,
    alignItems: 'center', justifyContent: 'center',
  },
  scheduleTitle: { ...F.body, color: T.text, fontFamily: FONT.semibold },
  scheduleSub:   { ...F.caption, marginTop: 2 },
});
