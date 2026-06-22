import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Modal, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { T, F, FONT } from '../theme';
import { GlassCard, Icon, Chip, IosSwitch, SectionHeader } from '../components/ui';
import type { Schedule } from '../types';

/* ─── Constante ────────────────────────────────────── */

const DEFAULT_NODE = 'esp32_node_a';

interface ActionPreset {
  label: string;
  action: string;
  params?: Record<string, unknown>;
}

const ACTION_PRESETS: ActionPreset[] = [
  { label: 'Jaluzele — Deschide',       action: 'servo_move', params: { servoAngle: 0 } },
  { label: 'Jaluzele — Inchide',        action: 'servo_move', params: { servoAngle: 90 } },
  { label: 'Ventilator — Pornit',       action: 'fan_on' },
  { label: 'Ventilator — Oprit',        action: 'fan_off' },
  { label: 'Ventilator — Mod automat',  action: 'fan_auto' },
  { label: 'LED living — Pornit',       action: 'led_on',  params: { led: 0 } },
  { label: 'LED living — Oprit',        action: 'led_off', params: { led: 0 } },
  { label: 'Oprire totala',             action: 'all_off' },
];

interface DayDef { index: number; short: string }

const DAYS: DayDef[] = [
  { index: 1, short: 'Lu' },
  { index: 2, short: 'Ma' },
  { index: 3, short: 'Mi' },
  { index: 4, short: 'Jo' },
  { index: 5, short: 'Vi' },
  { index: 6, short: 'Sa' },
  { index: 0, short: 'Du' },
];

function parseDays(csv: string): Set<number> {
  if (!csv) return new Set();
  return new Set(csv.split(',').map(Number).filter((n) => !isNaN(n)));
}

function serializeDays(set: Set<number>): string {
  return Array.from(set).sort((a, b) => a - b).join(',');
}

function friendlyAction(action: string, params?: Record<string, unknown>): string {
  const preset = ACTION_PRESETS.find(
    (p) =>
      p.action === action &&
      (p.params == null ||
        Object.entries(p.params).every(([k, v]) => params?.[k] === v)),
  );
  return preset?.label ?? action;
}

function friendlyDays(csv: string): string {
  if (!csv) return 'Nicio zi';
  const set = parseDays(csv);
  if (set.size === 7) return 'In fiecare zi';
  if ([1, 2, 3, 4, 5].every((d) => set.has(d)) && set.size === 5) return 'Luni–Vineri';
  return DAYS.filter((d) => set.has(d.index))
    .map((d) => d.short)
    .join(', ');
}

/* ─── Main screen ──────────────────────────────────── */

export default function ProgramScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [formVisible, setFormVisible] = useState(false);

  const { data: schedules = [], isLoading } = useQuery<Schedule[]>({
    queryKey: ['schedules'],
    queryFn: () => api.schedules.list(),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      api.schedules.update(id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedules'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.schedules.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedules'] }),
  });

  function confirmDelete(id: number) {
    Alert.alert(
      'Sterge programare',
      'Esti sigur ca vrei sa stergi aceasta programare?',
      [
        { text: 'Anuleaza', style: 'cancel' },
        { text: 'Sterge', style: 'destructive', onPress: () => deleteMut.mutate(id) },
      ],
    );
  }

  return (
    <View style={s.root}>
      {/* ── Glow decorativ ─────────────────────── */}
      <View style={s.glowAccent} pointerEvents="none" />

      {/* ── Header ─────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <View style={s.backBtnInner}>
            <Ionicons name="chevron-back" size={20} color={T.text} />
          </View>
        </TouchableOpacity>
        <View style={s.headerTexts}>
          <Text style={s.kicker}>Automatizare</Text>
          <Text style={s.title}>Programari</Text>
        </View>
      </View>

      {/* ── Lista ──────────────────────────────── */}
      <ScrollView
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={s.center}>
            <ActivityIndicator color={T.accent} size="large" />
            <Text style={s.loadingText}>Se incarca...</Text>
          </View>
        ) : schedules.length === 0 ? (
          <EmptyState onAdd={() => setFormVisible(true)} />
        ) : (
          schedules.map((sc) => (
            <ScheduleItem
              key={sc.id}
              schedule={sc}
              onToggle={(enabled) => toggleMut.mutate({ id: sc.id, enabled })}
              onDelete={() => confirmDelete(sc.id)}
              toggling={toggleMut.isPending}
              deleting={deleteMut.isPending}
            />
          ))
        )}

        <View style={s.bottomSpacer} />
      </ScrollView>

      {/* ── Buton „Adauga" ─────────────────────── */}
      {!isLoading && (
        <View style={s.fabWrap}>
          <TouchableOpacity
            style={s.fabOuter}
            onPress={() => setFormVisible(true)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={T.grad.accent}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.fab}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={s.fabText}>Adauga program</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Form modal ─────────────────────────── */}
      <AddProgramModal
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        onSaved={() => {
          setFormVisible(false);
          queryClient.invalidateQueries({ queryKey: ['schedules'] });
        }}
      />
    </View>
  );
}

/* ─── Empty state ──────────────────────────────────── */

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={es.wrap}>
      <View style={es.iconBox}>
        <Ionicons name="time-outline" size={36} color={T.text4} />
      </View>
      <Text style={es.title}>Nicio programare</Text>
      <Text style={es.sub}>
        Adauga primul program pentru a automatiza actiunile dispozitivelor la o anumita ora.
      </Text>
      <TouchableOpacity style={es.btn} onPress={onAdd} activeOpacity={0.8}>
        <Ionicons name="add-circle-outline" size={17} color={T.accent} />
        <Text style={es.btnText}>Adauga program</Text>
      </TouchableOpacity>
    </View>
  );
}

const es = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 32 },
  iconBox: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: T.glass2, borderWidth: 1, borderColor: T.glassBorder,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: { ...F.heading, marginBottom: 10 },
  sub: {
    ...F.body, color: T.text3, textAlign: 'center', lineHeight: 22, marginBottom: 28,
  },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: T.accentSoft, borderRadius: T.r.md,
    borderWidth: 1, borderColor: T.accentLine,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  btnText: { ...F.label, color: T.accentHi, fontFamily: FONT.semibold },
});

/* ─── Schedule item ────────────────────────────────── */

function ScheduleItem({
  schedule, onToggle, onDelete, toggling, deleting,
}: {
  schedule: Schedule;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
  toggling: boolean;
  deleting: boolean;
}) {
  return (
    <GlassCard style={si.card} padding={0}>
      {/* Ora + actiune */}
      <View style={si.top}>
        <View style={si.timeBlock}>
          <Text style={si.time}>{schedule.time}</Text>
        </View>
        <View style={si.meta}>
          <Text style={si.actionLabel} numberOfLines={1}>
            {friendlyAction(schedule.action, schedule.params)}
          </Text>
          <Text style={si.daysLabel}>{friendlyDays(schedule.days)}</Text>
        </View>
        {/* Toggle */}
        <Pressable
          onPress={() => onToggle(!schedule.enabled)}
          disabled={toggling}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <IosSwitch on={schedule.enabled} />
        </Pressable>
      </View>

      {/* Divider */}
      <View style={si.divider} />

      {/* Chips zile + buton stergere */}
      <View style={si.bottom}>
        <View style={si.chipsRow}>
          {DAYS.map((d) => {
            const active = parseDays(schedule.days).has(d.index);
            return (
              <View
                key={d.index}
                style={[si.dayChip, active ? si.dayChipOn : si.dayChipOff]}
              >
                <Text style={[si.dayChipText, active ? si.dayChipTextOn : si.dayChipTextOff]}>
                  {d.short}
                </Text>
              </View>
            );
          })}
        </View>
        <TouchableOpacity
          onPress={onDelete}
          disabled={deleting}
          style={si.deleteBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={16} color={T.danger} />
        </TouchableOpacity>
      </View>
    </GlassCard>
  );
}

const si = StyleSheet.create({
  card: { marginBottom: 10 },
  top: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: T.s.lg, paddingVertical: T.s.md, gap: 12,
  },
  timeBlock: { alignItems: 'center', justifyContent: 'center' },
  time: {
    fontSize: 28, fontFamily: FONT.numBold, color: T.text,
    fontVariant: ['tabular-nums'], lineHeight: 34,
  },
  meta: { flex: 1 },
  actionLabel: { ...F.body, color: T.text, fontFamily: FONT.semibold },
  daysLabel:   { ...F.caption, marginTop: 3 },
  divider: { height: 1, backgroundColor: T.glassBorder },
  bottom: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: T.s.lg, paddingVertical: 10, gap: 8,
  },
  chipsRow: { flex: 1, flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  dayChip: {
    width: 30, height: 26, borderRadius: T.r.xs,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  dayChipOn:  { backgroundColor: T.accentSoft, borderColor: T.accentLine },
  dayChipOff: { backgroundColor: T.glass, borderColor: T.glassBorder },
  dayChipText: { fontSize: 11, fontFamily: FONT.semibold },
  dayChipTextOn:  { color: T.accentHi },
  dayChipTextOff: { color: T.text4 },
  deleteBtn: {
    width: 34, height: 34, borderRadius: T.r.xs,
    backgroundColor: T.dangerSoft, borderWidth: 1, borderColor: T.dangerLine,
    alignItems: 'center', justifyContent: 'center',
  },
});

/* ─── Add program modal ────────────────────────────── */

function AddProgramModal({
  visible, onClose, onSaved,
}: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [hour, setHour]                 = useState(7);
  const [minute, setMinute]             = useState(0);
  const [selectedPreset, setPreset]     = useState<ActionPreset>(ACTION_PRESETS[0]);
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));

  const createMut = useMutation({
    mutationFn: (body: Partial<Schedule>) => api.schedules.create(body),
    onSuccess: () => onSaved(),
  });

  function pad2(n: number) { return n.toString().padStart(2, '0'); }

  function changeHour(delta: number) {
    setHour((h) => (h + delta + 24) % 24);
  }
  function changeMinute(delta: number) {
    setMinute((m) => {
      const next = m + delta;
      if (next >= 60) return 0;
      if (next < 0)   return 55;
      return next;
    });
  }

  function toggleDay(d: number) {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  }

  function selectAllDays() {
    setSelectedDays(new Set([0, 1, 2, 3, 4, 5, 6]));
  }
  function selectWeekdays() {
    setSelectedDays(new Set([1, 2, 3, 4, 5]));
  }

  function handleSave() {
    const timeStr = `${pad2(hour)}:${pad2(minute)}`;
    const daysStr = serializeDays(selectedDays);
    createMut.mutate({
      nodeId: DEFAULT_NODE,
      time:   timeStr,
      days:   daysStr,
      action: selectedPreset.action,
      params: selectedPreset.params,
      enabled: true,
    });
  }

  const canSave = selectedDays.size > 0 && !createMut.isPending;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={fm.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={fm.sheet}>
          {/* Handle */}
          <View style={fm.handle} />

          {/* Header */}
          <View style={fm.sheetHeader}>
            <Text style={fm.sheetTitle}>Program nou</Text>
            <TouchableOpacity onPress={onClose} style={fm.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color={T.text2} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={fm.body}>

            {/* ── Ora ─────────────────────────── */}
            <View style={fm.section}>
              <SectionHeader title="Ora" icon="time-outline" />
              <View style={fm.timeRow}>
                {/* Ore */}
                <View style={fm.stepper}>
                  <TouchableOpacity style={fm.stepBtn} onPress={() => changeHour(-1)} activeOpacity={0.7}>
                    <Ionicons name="remove" size={20} color={T.text} />
                  </TouchableOpacity>
                  <Text style={fm.stepVal}>{pad2(hour)}</Text>
                  <TouchableOpacity style={fm.stepBtn} onPress={() => changeHour(1)} activeOpacity={0.7}>
                    <Ionicons name="add" size={20} color={T.text} />
                  </TouchableOpacity>
                </View>

                <Text style={fm.timeSep}>:</Text>

                {/* Minute */}
                <View style={fm.stepper}>
                  <TouchableOpacity style={fm.stepBtn} onPress={() => changeMinute(-5)} activeOpacity={0.7}>
                    <Ionicons name="remove" size={20} color={T.text} />
                  </TouchableOpacity>
                  <Text style={fm.stepVal}>{pad2(minute)}</Text>
                  <TouchableOpacity style={fm.stepBtn} onPress={() => changeMinute(5)} activeOpacity={0.7}>
                    <Ionicons name="add" size={20} color={T.text} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* ── Actiune ─────────────────────── */}
            <View style={fm.section}>
              <SectionHeader title="Actiune" icon="flash-outline" />
              <View style={fm.presetList}>
                {ACTION_PRESETS.map((p) => {
                  const active = p === selectedPreset;
                  return (
                    <TouchableOpacity
                      key={`${p.action}-${JSON.stringify(p.params ?? {})}`}
                      style={[fm.presetRow, active && fm.presetRowActive]}
                      onPress={() => setPreset(p)}
                      activeOpacity={0.75}
                    >
                      <View style={[fm.presetDot, active && fm.presetDotActive]} />
                      <Text style={[fm.presetLabel, active && fm.presetLabelActive]}>
                        {p.label}
                      </Text>
                      {active && (
                        <Ionicons name="checkmark-circle" size={18} color={T.accent} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ── Zile ────────────────────────── */}
            <View style={fm.section}>
              <SectionHeader title="Zile" icon="calendar-outline" />

              {/* Scurtaturi */}
              <View style={fm.shortcutsRow}>
                <TouchableOpacity
                  style={fm.shortcutBtn}
                  onPress={selectAllDays}
                  activeOpacity={0.75}
                >
                  <Text style={fm.shortcutText}>In fiecare zi</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={fm.shortcutBtn}
                  onPress={selectWeekdays}
                  activeOpacity={0.75}
                >
                  <Text style={fm.shortcutText}>Luni–Vineri</Text>
                </TouchableOpacity>
              </View>

              {/* Chips zile */}
              <View style={fm.daysRow}>
                {DAYS.map((d) => {
                  const active = selectedDays.has(d.index);
                  return (
                    <TouchableOpacity
                      key={d.index}
                      style={[fm.dayChip, active ? fm.dayChipOn : fm.dayChipOff]}
                      onPress={() => toggleDay(d.index)}
                      activeOpacity={0.75}
                    >
                      <Text style={[fm.dayChipText, active ? fm.dayChipTextOn : fm.dayChipTextOff]}>
                        {d.short}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Eroare */}
            {createMut.isError && (
              <View style={fm.errorWrap}>
                <Ionicons name="alert-circle-outline" size={15} color={T.danger} />
                <Text style={fm.errorText}>Eroare la salvare. Incearca din nou.</Text>
              </View>
            )}

            {/* Buton Salveaza */}
            <TouchableOpacity
              style={[fm.saveBtnOuter, !canSave && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={!canSave}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={T.grad.accent}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={fm.saveBtn}
              >
                {createMut.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={fm.saveBtnText}>Salveaza</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const fm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7,10,20,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: T.bgElev,
    borderTopLeftRadius: T.r.xl,
    borderTopRightRadius: T.r.xl,
    borderWidth: 1,
    borderColor: T.glassBorder,
    maxHeight: '88%',
  },
  handle: {
    alignSelf: 'center',
    width: 40, height: 4, borderRadius: T.r.pill,
    backgroundColor: T.glassBorder, marginTop: 12, marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: T.s.xl, paddingVertical: T.s.lg,
    borderBottomWidth: 1, borderBottomColor: T.glassBorder,
  },
  sheetTitle: { ...F.heading },
  closeBtn: {
    width: 34, height: 34, borderRadius: T.r.sm,
    backgroundColor: T.glass2, borderWidth: 1, borderColor: T.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { paddingHorizontal: T.s.xl, paddingTop: T.s.lg },
  section: { marginBottom: T.s.xl },

  /* Stepper ora */
  timeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  stepper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: T.glass2, borderWidth: 1, borderColor: T.glassBorder,
    borderRadius: T.r.md, overflow: 'hidden',
  },
  stepBtn: {
    width: 46, height: 52,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.glass,
  },
  stepVal: {
    width: 52, textAlign: 'center',
    fontSize: 28, fontFamily: FONT.numBold, color: T.text,
    fontVariant: ['tabular-nums'],
  },
  timeSep: {
    fontSize: 28, fontFamily: FONT.numBold, color: T.text3,
    marginHorizontal: 4, lineHeight: 34,
  },

  /* Preseturi */
  presetList: {
    backgroundColor: T.glass,
    borderWidth: 1, borderColor: T.glassBorder,
    borderRadius: T.r.md, overflow: 'hidden',
  },
  presetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: T.s.lg, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: T.glassBorder,
  },
  presetRowActive: {
    backgroundColor: T.accentSoft,
  },
  presetDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: T.glassBorder, borderWidth: 1, borderColor: T.glassBorder,
  },
  presetDotActive: {
    backgroundColor: T.accent, borderColor: T.accent,
  },
  presetLabel: { ...F.body, color: T.text2, flex: 1 },
  presetLabelActive: { color: T.text, fontFamily: FONT.semibold },

  /* Zile */
  shortcutsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  shortcutBtn: {
    backgroundColor: T.glass2, borderWidth: 1, borderColor: T.glassBorder,
    borderRadius: T.r.pill, paddingHorizontal: 14, paddingVertical: 8,
  },
  shortcutText: { ...F.caption, color: T.text2 },
  daysRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  dayChip: {
    width: 40, height: 40, borderRadius: T.r.sm,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  dayChipOn:  { backgroundColor: T.accentSoft, borderColor: T.accentLine },
  dayChipOff: { backgroundColor: T.glass, borderColor: T.glassBorder },
  dayChipText: { fontSize: 12.5, fontFamily: FONT.semibold },
  dayChipTextOn:  { color: T.accentHi },
  dayChipTextOff: { color: T.text3 },

  /* Eroare */
  errorWrap: {
    flexDirection: 'row', alignItems: 'flex-start', gap: T.s.sm,
    backgroundColor: T.dangerSoft, borderRadius: T.r.sm,
    borderWidth: 1, borderColor: T.dangerLine,
    padding: T.s.md, marginBottom: T.s.lg,
  },
  errorText: { ...F.label, color: T.dangerHi, flex: 1, lineHeight: 19 },

  /* Buton save */
  saveBtnOuter: {
    borderRadius: T.r.md, overflow: 'hidden',
    ...T.glow,
    marginBottom: T.s.sm,
  },
  saveBtn: {
    height: 52, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  saveBtnText: {
    fontSize: 16, fontFamily: FONT.semibold, color: '#fff', letterSpacing: -0.2,
  },
});

/* ─── Screen styles ─────────────────────────────────── */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  glowAccent: {
    position: 'absolute',
    top: -80, left: -60,
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(109,139,255,0.10)',
  },

  header: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingTop: 60, paddingHorizontal: T.s.xl, paddingBottom: T.s.lg, gap: 14,
  },
  backBtn: {},
  backBtnInner: {
    width: 38, height: 38, borderRadius: T.r.sm,
    backgroundColor: T.glass2, borderWidth: 1, borderColor: T.glassBorder,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  headerTexts: { flex: 1 },
  kicker: { ...F.kicker, marginBottom: 4 },
  title:  { ...F.display },

  list: { paddingHorizontal: T.s.xl, paddingTop: 4, paddingBottom: 100 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 16 },
  loadingText: { ...F.caption, color: T.text3 },

  bottomSpacer: { height: 20 },

  fabWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: T.s.xl, paddingBottom: 32, paddingTop: 12,
    backgroundColor: 'rgba(7,10,20,0.88)',
    borderTopWidth: 1, borderTopColor: T.glassBorder,
  },
  fabOuter: {
    borderRadius: T.r.md, overflow: 'hidden',
    ...T.glow,
  },
  fab: {
    height: 52, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  fabText: {
    fontSize: 16, fontFamily: FONT.semibold, color: '#fff', letterSpacing: -0.2,
  },
});
