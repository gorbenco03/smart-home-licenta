import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, Image, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useMutation } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAppStore } from '../store';
import { T } from '../theme';
import { Dot, IosSwitch } from '../components/ui';
import { CAMERA_STREAM_URL, CAMERA_SNAPSHOT_URL } from '../services/config';

/* ─── Constante nod ──────────────────────────────── */

const SENSOR_NODE_ID = 'esp32_node_a';  // nod cu senzori + servo + relee
const CAM_NODE_ID    = 'esp32_cam_node'; // nod cu cameră

const RELAY_DEFS = [
  { index: 0, label: 'Lumină principală', icon: '💡' },
  { index: 1, label: 'Ventilator',        icon: '🌀' },
  { index: 2, label: 'Priză 1',           icon: '🔌' },
  { index: 3, label: 'Priză 2',           icon: '🔌' },
];

type SceneKey = 'acasa' | 'plec' | 'noapte' | 'cinema';

const SCENES: Array<{ key: SceneKey; label: string; icon: string }> = [
  { key: 'acasa',  label: 'Acasă',  icon: '⌂' },
  { key: 'plec',   label: 'Plec',   icon: '🏃' },
  { key: 'noapte', label: 'Noapte', icon: '🌙' },
  { key: 'cinema', label: 'Cinema', icon: '🎬' },
];

// Predefiniri servo pentru perdele
const SERVO_PRESETS = [
  { label: 'Deschis', angle: 0,   icon: '◧' },
  { label: '50%',     angle: 90,  icon: '◫' },
  { label: 'Închis',  angle: 180, icon: '◨' },
];

/* ─── SCREEN ─────────────────────────────────────── */

export default function ControlScreen() {
  const nodeStatus = useAppStore((s) => s.nodeStatus);
  const [activeScene, setActiveScene] = useState<SceneKey>('acasa');
  const [streamOpen, setStreamOpen]   = useState(false);

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.content}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.kicker}>MANUAL & SCENE</Text>
          <Text style={s.title}>Control</Text>
        </View>

        {/* ── Cameră ──────────────────────────── */}
        <CameraCard onOpenStream={() => setStreamOpen(true)} />

        {/* ── Scene presets ────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>SCENE</Text>
          <View style={s.scenesGrid}>
            {SCENES.map(sc => (
              <TouchableOpacity
                key={sc.key}
                style={[s.sceneCard, activeScene === sc.key && s.sceneCardActive]}
                onPress={() => setActiveScene(sc.key)}
                activeOpacity={0.7}
              >
                <Text style={s.sceneIcon}>{sc.icon}</Text>
                <Text style={[s.sceneLabel, activeScene === sc.key && s.sceneLabelActive]}>
                  {sc.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Servo — perdele ──────────────────── */}
        <ServoCard nodeId={SENSOR_NODE_ID} online={nodeStatus[SENSOR_NODE_ID] ?? false} />

        {/* ── Relee Living ─────────────────────── */}
        <RelayCard
          nodeId={SENSOR_NODE_ID}
          label="Living / Bucătărie"
          online={nodeStatus[SENSOR_NODE_ID] ?? false}
          defaultRelays={{ 0: true, 1: false, 2: false, 3: false }}
        />

        {/* ── Relee Dormitor ───────────────────── */}
        <RelayCard
          nodeId="esp32_node_b"
          label="Dormitor / Baie"
          online={nodeStatus['esp32_node_b'] ?? false}
          defaultRelays={{ 0: false, 1: false, 2: true, 3: false }}
        />

        {/* ── Quick actions ─────────────────────── */}
        <View style={s.quickRow}>
          <QuickActionButton icon="🔔" label="Test buzzer" nodeId={SENSOR_NODE_ID} action="buzzer_beep" />
          <QuickActionButton icon="⛔" label="Oprire totală" nodeId={SENSOR_NODE_ID} action="all_off" danger />
        </View>
      </ScrollView>

      {/* ── Full-screen stream modal ──────────── */}
      <Modal
        visible={streamOpen}
        animationType="slide"
        onRequestClose={() => setStreamOpen(false)}
      >
        <SafeAreaView style={sm.root}>
          <View style={sm.toolbar}>
            <TouchableOpacity onPress={() => setStreamOpen(false)} style={sm.closeBtn}>
              <Text style={sm.closeText}>✕ Închide</Text>
            </TouchableOpacity>
            <Text style={sm.toolbarTitle}>Camera Hol — Live</Text>
          </View>
          <WebView
            source={{ uri: CAMERA_STREAM_URL }}
            style={sm.webview}
            javaScriptEnabled
            startInLoadingState
            renderLoading={() => (
              <View style={sm.loading}>
                <ActivityIndicator color={T.accent} size="large" />
                <Text style={sm.loadingText}>Conectare la cameră…</Text>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

/* ─── CAMERA CARD ────────────────────────────────── */
function CameraCard({ onOpenStream }: { onOpenStream: () => void }) {
  const [snapshotUri, setSnapshotUri] = useState<string | null>(null);
  const [ts, setTs]   = useState(Date.now());
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refresh snapshot la fiecare 5 secunde
  useEffect(() => {
    timerRef.current = setInterval(() => setTs(Date.now()), 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const snapshotUrl = `${CAMERA_SNAPSHOT_URL}?t=${ts}`;

  return (
    <View style={cc.card}>
      <View style={cc.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={cc.icon}>📷</Text>
          <View>
            <Text style={cc.label}>Camera Hol</Text>
            <Text style={cc.nodeId}>{CAM_NODE_ID}</Text>
          </View>
        </View>
        <View style={cc.livePill}>
          <View style={cc.liveDot} />
          <Text style={cc.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Snapshot preview */}
      <View style={cc.previewWrap}>
        <Image
          source={{ uri: snapshotUrl }}
          style={cc.preview}
          resizeMode="cover"
          onError={() => {/* Cameră deconectată — imagine lipsa e OK */}}
        />
        <View style={cc.previewOverlay}>
          <Text style={cc.previewNote}>snapshot · refresh 5s</Text>
        </View>
      </View>

      <TouchableOpacity style={cc.streamBtn} onPress={onOpenStream} activeOpacity={0.8}>
        <Text style={cc.streamBtnIcon}>▶</Text>
        <Text style={cc.streamBtnText}>Stream live (MJPEG)</Text>
      </TouchableOpacity>
    </View>
  );
}

const cc = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderRadius: 22,
    borderWidth: 1, borderColor: T.border,
    marginHorizontal: 18, marginBottom: 14,
    overflow: 'hidden',
    ...T.shadow,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14, paddingBottom: 12,
  },
  icon: { fontSize: 20 },
  label: { fontSize: 15, fontWeight: '600', color: T.text, letterSpacing: -0.2 },
  nodeId: { fontFamily: 'Courier New', fontSize: 10, color: T.text3, marginTop: 1 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: T.dangerSoft,
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: T.dangerLine,
  },
  liveDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: T.danger,
  },
  liveText: { fontFamily: 'Courier New', fontSize: 10, color: T.dangerHi, fontWeight: '600' },
  previewWrap: {
    marginHorizontal: 14, marginBottom: 10,
    height: 160, borderRadius: 14, overflow: 'hidden',
    backgroundColor: T.surface3,
  },
  preview: { width: '100%', height: '100%' },
  previewOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 4, paddingHorizontal: 8,
  },
  previewNote: { fontFamily: 'Courier New', fontSize: 9.5, color: 'rgba(255,255,255,0.7)' },
  streamBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: T.accentSoft,
    borderTopWidth: 1, borderTopColor: T.accentLine,
    padding: 14,
  },
  streamBtnIcon: { fontSize: 14, color: T.accent },
  streamBtnText: { fontSize: 14, fontWeight: '600', color: T.accent, letterSpacing: -0.1 },
});

/* Stream modal styles */
const sm = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: T.bg, paddingHorizontal: 18, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 14, color: T.accent, fontWeight: '600' },
  toolbarTitle: { fontSize: 14, fontWeight: '600', color: T.text },
  webview: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: T.text2, fontFamily: 'Courier New', fontSize: 13 },
});

/* ─── SERVO CARD (Perdele) ───────────────────────── */
function ServoCard({ nodeId, online }: { nodeId: string; online: boolean }) {
  const [activeAngle, setActiveAngle] = useState<number>(0);

  const mutation = useMutation({
    mutationFn: (angle: number) =>
      api.commands.send(nodeId, 'servo_move' as any, undefined),
    onSuccess: (_, angle) => setActiveAngle(angle),
  });

  // Override api.commands.send to include servoAngle
  function sendServo(angle: number) {
    fetch(`${require('../services/config').API_BASE}/commands/${nodeId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // token via store interceptor handles auth
      },
      body: JSON.stringify({ action: 'servo_move', servoAngle: angle }),
    }).catch(() => {});
    setActiveAngle(angle);
  }

  return (
    <View style={sv.card}>
      <View style={sv.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={sv.icon}>🪟</Text>
          <View>
            <Text style={sv.label}>Perdele</Text>
            <Text style={sv.nodeId}>{nodeId} · servo GPIO18</Text>
          </View>
        </View>
        <Dot color={online ? T.success : T.text4} size={7} />
      </View>

      <View style={sv.btnRow}>
        {SERVO_PRESETS.map(p => (
          <TouchableOpacity
            key={p.angle}
            style={[sv.btn, activeAngle === p.angle && sv.btnActive]}
            onPress={() => sendServo(p.angle)}
            activeOpacity={0.7}
            disabled={!online}
          >
            <Text style={sv.btnIcon}>{p.icon}</Text>
            <Text style={[sv.btnLabel, activeAngle === p.angle && sv.btnLabelActive]}>
              {p.label}
            </Text>
            <Text style={[sv.btnAngle, activeAngle === p.angle && { color: T.accent }]}>
              {p.angle}°
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {!online && (
        <Text style={sv.offline}>Nodul este offline</Text>
      )}
    </View>
  );
}

const sv = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderRadius: 22,
    borderWidth: 1, borderColor: T.border,
    marginHorizontal: 18, marginBottom: 14,
    padding: 14,
    ...T.shadow,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 14,
  },
  icon: { fontSize: 20 },
  label: { fontSize: 15, fontWeight: '600', color: T.text, letterSpacing: -0.2 },
  nodeId: { fontFamily: 'Courier New', fontSize: 10, color: T.text3, marginTop: 1 },
  btnRow: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1, alignItems: 'center', gap: 4,
    backgroundColor: T.surface2,
    borderRadius: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: T.border,
  },
  btnActive: { backgroundColor: T.accentSoft, borderColor: T.accentLine },
  btnIcon: { fontSize: 18 },
  btnLabel: { fontSize: 12.5, fontWeight: '600', color: T.text },
  btnLabelActive: { color: T.accent },
  btnAngle: { fontFamily: 'Courier New', fontSize: 10, color: T.text3 },
  offline: { textAlign: 'center', fontFamily: 'Courier New', fontSize: 11, color: T.text4, marginTop: 8 },
});

/* ─── RELAY CARD ─────────────────────────────────── */
function RelayCard({
  nodeId, label, online, defaultRelays,
}: { nodeId: string; label: string; online: boolean; defaultRelays: Record<number, boolean> }) {
  const [relays, setRelays] = useState<Record<number, boolean>>(defaultRelays);

  const mutation = useMutation({
    mutationFn: ({ action, relay }: { action: string; relay: number }) =>
      api.commands.send(nodeId, action as any, relay),
    onSuccess: (_, vars) => {
      setRelays(prev => ({ ...prev, [vars.relay]: vars.action === 'relay_on' }));
    },
  });

  const activeCount = Object.values(relays).filter(Boolean).length;

  return (
    <View style={rc.card}>
      <View style={rc.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Dot color={online ? T.success : T.text4} size={7} />
          <Text style={rc.label}>{label}</Text>
        </View>
        <Text style={[rc.count, { color: activeCount > 0 ? T.accent : T.text3 }]}>
          {activeCount}/{RELAY_DEFS.length} active
        </Text>
      </View>

      {RELAY_DEFS.map((relay, i) => (
        <TouchableOpacity
          key={relay.index}
          style={[rc.row, i === RELAY_DEFS.length - 1 && rc.rowLast]}
          onPress={() => {
            const on = relays[relay.index];
            mutation.mutate({ action: on ? 'relay_off' : 'relay_on', relay: relay.index });
          }}
          activeOpacity={0.7}
          disabled={mutation.isPending}
        >
          <View style={[rc.iconBox, relays[relay.index] && rc.iconBoxOn]}>
            <Text style={rc.iconText}>{relay.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={rc.relayLabel}>{relay.label}</Text>
            <Text style={[rc.relayStatus, { color: relays[relay.index] ? T.accent : T.text3 }]}>
              {relays[relay.index] ? 'PORNIT · 14W' : 'OPRIT'}
            </Text>
          </View>
          <IosSwitch on={relays[relay.index]} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const rc = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderRadius: 22,
    borderWidth: 1, borderColor: T.border,
    padding: 14,
    marginHorizontal: 18, marginBottom: 14,
    ...T.shadow,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: T.border, marginBottom: 4,
  },
  label: { fontSize: 15, fontWeight: '600', color: T.text, letterSpacing: -0.2 },
  count: { fontFamily: 'Courier New', fontSize: 10.5, letterSpacing: 0.4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.border,
  },
  rowLast: { borderBottomWidth: 0 },
  iconBox: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: T.surface2, borderWidth: 1, borderColor: T.border,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBoxOn: { backgroundColor: T.accentSoft, borderColor: T.accentLine },
  iconText: { fontSize: 16 },
  relayLabel: { fontSize: 14, fontWeight: '500', color: T.text },
  relayStatus: { fontFamily: 'Courier New', fontSize: 10, letterSpacing: 0.4, marginTop: 2 },
});

/* ─── QUICK ACTION BUTTON ────────────────────────── */
function QuickActionButton({
  icon, label, nodeId, action, danger,
}: { icon: string; label: string; nodeId: string; action: string; danger?: boolean }) {
  const mutation = useMutation({
    mutationFn: () => api.commands.send(nodeId, action as any),
  });

  return (
    <TouchableOpacity
      style={[
        qa.btn,
        danger ? { backgroundColor: T.dangerSoft, borderColor: T.dangerLine } : null,
      ]}
      onPress={() => mutation.mutate()}
      disabled={mutation.isPending}
      activeOpacity={0.7}
    >
      <Text style={qa.icon}>{icon}</Text>
      <Text style={[qa.label, danger && { color: T.dangerHi }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const qa = StyleSheet.create({
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    borderRadius: 16, padding: 14, ...T.shadow,
  },
  icon: { fontSize: 18 },
  label: { fontSize: 13.5, fontWeight: '600', color: T.text, letterSpacing: -0.1 },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  content: { paddingBottom: 110 },
  header: { paddingHorizontal: 22, paddingTop: 60, paddingBottom: 14 },
  kicker: { fontFamily: 'Courier New', fontSize: 11, color: T.text3, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 4 },
  title: { fontSize: 30, fontWeight: '600', color: T.text, letterSpacing: -0.8 },
  section: { paddingHorizontal: 18, marginBottom: 14 },
  sectionLabel: { fontFamily: 'Courier New', fontSize: 10.5, color: T.text3, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  scenesGrid: { flexDirection: 'row', gap: 8 },
  sceneCard: {
    flex: 1, alignItems: 'center', gap: 6,
    paddingVertical: 12, paddingHorizontal: 6,
    backgroundColor: T.surface, borderRadius: 16,
    borderWidth: 1, borderColor: T.border, ...T.shadow,
  },
  sceneCardActive: { backgroundColor: T.accentSoft, borderColor: T.accentLine },
  sceneIcon: { fontSize: 20 },
  sceneLabel: { fontSize: 11.5, fontWeight: '600', color: T.text, letterSpacing: -0.1 },
  sceneLabelActive: { color: T.accent },
  quickRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, marginTop: 2 },
});
