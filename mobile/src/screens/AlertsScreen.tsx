import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAppStore } from '../store';
import { AlertItem } from '../types';
import { T, F, FONT } from '../theme';
import { GlassCard, Chip, Icon, Dot } from '../components/ui';

/* ── Severity config ─────────────────────────────────────── */
const SEV_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  low:      { color: T.text3,    bg: T.glass,       border: T.glassBorder, label: 'Scăzut',  icon: 'information-circle-outline' },
  medium:   { color: T.warning,  bg: T.warningSoft, border: 'rgba(251,191,36,0.30)', label: 'Mediu',   icon: 'warning-outline' },
  high:     { color: T.accent,   bg: T.accentSoft,  border: T.borderWarm,             label: 'Ridicat', icon: 'alert-circle-outline' },
  critical: { color: T.danger,   bg: T.dangerSoft,  border: T.dangerLine,             label: 'Critic',  icon: 'alert-circle' },
};

type IonName = keyof typeof Ionicons.glyphMap;

const ALERT_META: Record<string, { title: string; icon: IonName }> = {
  GAS_DETECTED: { title: 'Gaz detectat',             icon: 'flame-outline' },
  MOTION_NIGHT: { title: 'Mișcare nocturnă',          icon: 'eye-outline' },
  ML_ANOMALY:   { title: 'Comportament neobișnuit',   icon: 'analytics-outline' },
  ALERT_HEAT:   { title: 'Temperatură ridicată',      icon: 'thermometer-outline' },
  ALERT_COLD:   { title: 'Temperatură scăzută',       icon: 'snow-outline' },
};

type FilterKey = 'all' | 'unread' | 'critical';

export default function AlertsScreen() {
  const qc          = useQueryClient();
  const clearUnread = useAppStore((s) => s.clearUnread);
  const ackAlert    = useAppStore((s) => s.acknowledgeAlert);
  const [filter, setFilter] = React.useState<FilterKey>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.alerts.list(100),
    refetchInterval: 10_000,
  });

  useEffect(() => { clearUnread(); }, []);

  const ackMutation = useMutation({
    mutationFn: (id: number) => api.alerts.acknowledge(id),
    onSuccess: (updated) => {
      ackAlert(updated.id);
      qc.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const allAlerts   = data ?? [];
  const unreadCount = allAlerts.filter(a => !a.acknowledged).length;

  const filtered = allAlerts.filter(a => {
    if (filter === 'unread')   return !a.acknowledged;
    if (filter === 'critical') return a.severity === 'critical';
    return true;
  });

  const FILTERS: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: 'all',      label: 'Toate',    count: allAlerts.length },
    { key: 'unread',   label: 'Necitite', count: unreadCount },
    { key: 'critical', label: 'Critice',  count: allAlerts.filter(a => a.severity === 'critical').length },
  ];

  return (
    <View style={s.root}>

      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.kicker}>Siguranță</Text>
          <Text style={s.title}>Alerte</Text>
        </View>
        {unreadCount > 0 && (
          <View style={s.unreadBadge}>
            <Dot color={T.danger} size={7} glow />
            <Text style={s.unreadText}>{unreadCount} necitite</Text>
          </View>
        )}
      </View>

      {/* ── Filter chips ── */}
      <View style={s.filterWrap}>
        <View style={s.filterRow}>
          {FILTERS.map(f => (
            <Chip
              key={f.key}
              label={f.label}
              active={filter === f.key}
              onPress={() => setFilter(f.key)}
              count={f.count}
              color={f.key === 'critical' ? T.danger : T.accent}
            />
          ))}
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={T.accent} style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <AlertRow
              item={item}
              isLast={index === filtered.length - 1}
              onAck={() => ackMutation.mutate(item.id)}
            />
          )}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Icon name="shield-checkmark-outline" size={40} color={T.success} />
              <Text style={s.emptyText}>
                Nicio alertă. Sistemul funcționează normal.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

/* ── ALERT ROW ─────────────────────────────────────────────── */
function AlertRow({
  item, isLast, onAck,
}: { item: AlertItem; isLast: boolean; onAck: () => void }) {
  const meta    = ALERT_META[item.alertType] ?? { title: item.alertType, icon: 'alert-circle-outline' as IonName };
  const sev     = SEV_CONFIG[item.severity] ?? SEV_CONFIG.low;
  const isAcked = item.acknowledged;

  const details = item.details
    ? Object.values(item.details).join(' · ')
    : null;

  return (
    <View style={[ar.wrap, isAcked && ar.wrapAcked]}>

      {/* Timeline dot + line */}
      <View style={ar.timelineCol}>
        <View style={[ar.dot, { borderColor: isAcked ? T.text4 : sev.color,
          shadowColor: isAcked ? 'transparent' : sev.color }]} />
        {!isLast && <View style={ar.line} />}
      </View>

      {/* Card */}
      <GlassCard
        style={[ar.card, { borderColor: isAcked ? T.glassBorder : sev.border }]}
        padding={12}
        tone={item.severity === 'critical' ? 'danger' : 'default'}
      >
        {/* Card header row */}
        <View style={ar.cardHead}>
          {/* Severity icon + title */}
          <View style={[ar.sevBadge, { backgroundColor: sev.bg }]}>
            <Ionicons name={sev.icon} size={14} color={sev.color} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name={meta.icon} size={15} color={isAcked ? T.text3 : sev.color} />
              <Text style={[ar.cardTitle, { color: isAcked ? T.text2 : sev.color }]}>
                {meta.title}
              </Text>
            </View>
            <Text style={ar.meta}>
              {item.location
                ? item.location.charAt(0).toUpperCase() + item.location.slice(1) + ' · '
                : ''}
              {new Date(item.time).toLocaleString('ro-RO', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </Text>
          </View>

          {/* Right side: acked badge or ack button */}
          {isAcked ? (
            <View style={ar.ackedBadge}>
              <Ionicons name="checkmark-circle" size={13} color={T.success} />
              <Text style={ar.ackedLabel}>Citit</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={ar.ackBtn}
              onPress={onAck}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="checkmark" size={15} color={T.success} />
            </TouchableOpacity>
          )}
        </View>

        {/* Severity label + details */}
        <View style={ar.cardBody}>
          <View style={[ar.sevLabel, { backgroundColor: sev.bg, borderColor: sev.border }]}>
            <Text style={[ar.sevText, { color: sev.color }]}>{sev.label}</Text>
          </View>
          {details && (
            <Text style={[ar.details, isAcked && { color: T.text3 }]}>{details}</Text>
          )}
        </View>
      </GlassCard>
    </View>
  );
}

const ar = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: T.s.md,
    paddingBottom: T.s.md,
  },
  wrapAcked: {
    opacity: 0.72,
  },

  timelineCol: {
    alignItems: 'center',
    paddingTop: 10,
    flexShrink: 0,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: T.bg,
    borderWidth: 2,
    zIndex: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 7,
    elevation: 4,
  },
  line: {
    flex: 1,
    width: 1,
    backgroundColor: T.borderStrong,
    marginTop: 4,
  },

  card: {
    flex: 1,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: T.s.sm,
  },
  sevBadge: {
    width: 32,
    height: 32,
    borderRadius: T.r.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: 14.5,
    fontFamily: FONT.semibold,
    letterSpacing: -0.1,
    lineHeight: 20,
  },
  meta: {
    fontSize: 12,
    fontFamily: FONT.medium,
    color: T.text3,
    marginTop: 2,
  },

  ackBtn: {
    width: 32,
    height: 32,
    borderRadius: T.r.sm,
    backgroundColor: T.successSoft,
    borderWidth: 1,
    borderColor: T.successLine,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  ackedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: T.r.pill,
    backgroundColor: T.successSoft,
    flexShrink: 0,
  },
  ackedLabel: {
    fontSize: 11.5,
    fontFamily: FONT.semibold,
    color: T.success,
  },

  cardBody: {
    marginTop: T.s.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: T.s.sm,
  },
  sevLabel: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: T.r.pill,
    borderWidth: 1,
  },
  sevText: {
    fontSize: 11.5,
    fontFamily: FONT.semibold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  details: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONT.regular,
    color: T.text2,
    lineHeight: 18,
  },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
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
  unreadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: T.r.pill,
    backgroundColor: T.dangerSoft,
    borderWidth: 1,
    borderColor: T.dangerLine,
    marginTop: 8,
  },
  unreadText: {
    fontSize: 12,
    fontFamily: FONT.semibold,
    color: T.dangerHi,
  },

  filterWrap: {
    paddingHorizontal: T.s.lg,
    marginBottom: T.s.lg,
  },
  filterRow: {
    flexDirection: 'row',
    gap: T.s.sm,
    flexWrap: 'wrap',
  },

  list: {
    paddingHorizontal: T.s.xl,
    paddingBottom: 110,
  },

  emptyWrap: {
    alignItems: 'center',
    marginTop: 64,
    gap: T.s.md,
    paddingHorizontal: 30,
  },
  emptyText: {
    ...F.body,
    color: T.text3,
    textAlign: 'center',
  },
});
