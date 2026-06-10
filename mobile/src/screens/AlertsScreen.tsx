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
import { T } from '../theme';

const SEV_COLOR: Record<string, string> = {
  low:      T.text3,
  medium:   T.warning,
  high:     T.accent,
  critical: T.danger,
};

type IonName = keyof typeof Ionicons.glyphMap;

const ALERT_META: Record<string, { title: string; icon: IonName }> = {
  GAS_DETECTED: { title: 'Gaz detectat',          icon: 'flame' },
  MOTION_NIGHT: { title: 'Mișcare nocturnă',       icon: 'eye' },
  ML_ANOMALY:   { title: 'Comportament neobișnuit', icon: 'analytics' },
  ALERT_HEAT:   { title: 'Temperatură ridicată',   icon: 'thermometer' },
  ALERT_COLD:   { title: 'Temperatură scăzută',    icon: 'snow' },
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
    { key: 'all',      label: 'Toate',   count: allAlerts.length },
    { key: 'unread',   label: 'Necitite',count: unreadCount },
    { key: 'critical', label: 'Critice', count: allAlerts.filter(a => a.severity === 'critical').length },
  ];

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.kicker}>Siguranță</Text>
          <Text style={s.title}>Alerte</Text>
        </View>
        {unreadCount > 0 && (
          <View style={s.unreadBadge}>
            <Text style={s.unreadText}>{unreadCount} necitite</Text>
          </View>
        )}
      </View>

      {/* Filter chips */}
      <View style={s.filterWrap}>
        <View style={s.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[s.filterChip, filter === f.key && s.filterChipActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.7}
            >
              <Text style={[s.filterText, filter === f.key && s.filterTextActive]}>{f.label}</Text>
              <View style={[s.filterCount, filter === f.key && s.filterCountActive]}>
                <Text style={[s.filterCountText, filter === f.key && s.filterCountTextActive]}>
                  {f.count}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={T.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={s.list}
          renderItem={({ item, index }) => (
            <AlertRow
              item={item}
              isLast={index === filtered.length - 1}
              onAck={() => ackMutation.mutate(item.id)}
            />
          )}
          ListEmptyComponent={
            <Text style={s.empty}>Nicio alertă. Sistemul funcționează normal.</Text>
          }
        />
      )}
    </View>
  );
}

function AlertRow({
  item, isLast, onAck,
}: { item: AlertItem; isLast: boolean; onAck: () => void }) {
  const meta = ALERT_META[item.alertType] ?? { title: item.alertType, icon: 'alert-circle' as IonName };
  const c    = SEV_COLOR[item.severity] ?? T.text3;
  const details = item.details
    ? Object.values(item.details).join(' · ')
    : null;

  return (
    <View style={[ar.wrap, item.acknowledged && ar.acked]}>
      {/* Timeline dot */}
      <View style={[ar.timelineDot, { borderColor: c, shadowColor: item.acknowledged ? 'transparent' : c }]} />
      {/* Vertical line */}
      {!isLast && <View style={ar.timelineLine} />}

      {/* Card */}
      <View style={[ar.card, { borderLeftColor: c }]}>
        <View style={ar.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name={meta.icon} size={15} color={c} />
            <Text style={[ar.cardTitle, { color: c }]}>{meta.title}</Text>
          </View>
          {!item.acknowledged && (
            <TouchableOpacity style={ar.ackBtn} onPress={onAck} activeOpacity={0.7}>
              <Ionicons name="checkmark" size={15} color={T.success} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={ar.meta}>
          {item.location ? item.location.charAt(0).toUpperCase() + item.location.slice(1) + ' · ' : ''}
          {new Date(item.time).toLocaleString('ro-RO', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
          })}
        </Text>
        {details && <Text style={ar.details}>{details}</Text>}
      </View>
    </View>
  );
}

const ar = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 16,
    paddingBottom: 14,
    position: 'relative',
  },
  acked: { opacity: 0.5 },
  timelineDot: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: T.bg,
    borderWidth: 2,
    marginTop: 10,
    flexShrink: 0,
    zIndex: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  timelineLine: {
    position: 'absolute',
    left: 7, top: 26, bottom: 0,
    width: 1, backgroundColor: T.borderStrong,
  },
  card: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    borderLeftWidth: 3,
    padding: 12,
    ...T.shadow,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle: { fontSize: 14.5, fontWeight: '600', letterSpacing: -0.1 },
  meta: { fontSize: 12, color: T.text3, marginTop: 6 },
  details: { fontSize: 13, color: T.text2, marginTop: 6, lineHeight: 18 },
  ackBtn: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: T.successSoft,
    borderWidth: 1, borderColor: T.successLine,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 60,
    paddingBottom: 14,
  },
  kicker: { fontSize: 12, fontWeight: '600', color: T.text3, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  title: { fontSize: 30, fontWeight: '700', color: T.text, letterSpacing: -0.8 },
  unreadBadge: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: T.dangerSoft,
    borderWidth: 1, borderColor: T.dangerLine,
    marginTop: 8,
  },
  unreadText: { fontSize: 12, fontWeight: '600', color: T.dangerHi },

  filterWrap: { paddingHorizontal: 18, marginBottom: 14 },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: T.surface,
    borderRadius: 12,
    borderWidth: 1, borderColor: T.border,
    padding: 4, gap: 4,
  },
  filterChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8, borderRadius: 8,
  },
  filterChipActive: { backgroundColor: T.surface3 },
  filterText: { fontSize: 13, fontWeight: '500', color: T.text2 },
  filterTextActive: { color: T.text, fontWeight: '600' },
  filterCount: {
    paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: T.surface2,
  },
  filterCountActive: { backgroundColor: T.accentSoft },
  filterCountText: { fontSize: 12, fontWeight: '600', color: T.text3 },
  filterCountTextActive: { color: T.accent },

  list: { paddingHorizontal: 22, paddingBottom: 110 },
  empty: { color: T.text4, textAlign: 'center', marginTop: 60, fontSize: 15, paddingHorizontal: 20 },
});
