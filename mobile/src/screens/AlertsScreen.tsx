import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAppStore } from '../store';
import { AlertItem } from '../types';

const SEVERITY_COLOR: Record<string, string> = {
  low:      '#64748b',
  medium:   '#f59e0b',
  high:     '#f97316',
  critical: '#ef4444',
};

const ALERT_LABEL: Record<string, string> = {
  GAS_DETECTED:   '🔥 Gaz detectat',
  MOTION_NIGHT:   '👁 Mișcare nocturnă',
  ML_ANOMALY:     '🤖 Anomalie ML',
  ALERT_HEAT:     '🌡 Temperatură ridicată',
  ALERT_COLD:     '❄️ Temperatură scăzută',
};

function AlertRow({ item, onAck }: { item: AlertItem; onAck: (id: number) => void }) {
  const color = SEVERITY_COLOR[item.severity] ?? '#64748b';
  const label = ALERT_LABEL[item.alertType] ?? item.alertType;

  return (
    <View style={[s.row, item.acknowledged && s.rowAcked]}>
      <View style={[s.severityBar, { backgroundColor: color }]} />
      <View style={s.rowContent}>
        <Text style={[s.alertLabel, { color }]}>{label}</Text>
        <Text style={s.alertMeta}>
          {item.location}  ·  {new Date(item.time).toLocaleString('ro-RO')}
        </Text>
        {item.details && (
          <Text style={s.alertDetails}>
            {Object.entries(item.details).map(([k, v]) => `${k}: ${v}`).join(' | ')}
          </Text>
        )}
      </View>
      {!item.acknowledged && (
        <TouchableOpacity style={s.ackBtn} onPress={() => onAck(item.id)}>
          <Text style={s.ackBtnText}>✓</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function AlertsScreen() {
  const qc          = useQueryClient();
  const clearUnread = useAppStore((s) => s.clearUnread);
  const ackAlert    = useAppStore((s) => s.acknowledgeAlert);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.alerts.list(100),
    refetchInterval: 10_000,
  });

  useEffect(() => {
    clearUnread();
  }, []);

  const ackMutation = useMutation({
    mutationFn: (id: number) => api.alerts.acknowledge(id),
    onSuccess: (updated) => {
      ackAlert(updated.id);
      qc.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const unread = (data ?? []).filter((a) => !a.acknowledged).length;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Alerte</Text>
        {unread > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{unread} necitite</Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator color="#38bdf8" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <AlertRow item={item} onAck={(id) => ackMutation.mutate(id)} />
          )}
          contentContainerStyle={s.list}
          onRefresh={refetch}
          refreshing={false}
          ListEmptyComponent={
            <Text style={s.empty}>Nicio alertă. Sistemul funcționează normal.</Text>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#f1f5f9' },
  badge: { backgroundColor: '#7f1d1d', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeText: { color: '#fca5a5', fontSize: 12, fontWeight: '600' },
  list: { padding: 16 },
  row: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  rowAcked: { opacity: 0.5 },
  severityBar: { width: 4 },
  rowContent: { flex: 1, padding: 14 },
  alertLabel: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  alertMeta: { color: '#64748b', fontSize: 12, marginBottom: 2 },
  alertDetails: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  ackBtn: {
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#14532d20',
  },
  ackBtnText: { color: '#22c55e', fontSize: 20, fontWeight: '700' },
  empty: { color: '#475569', textAlign: 'center', marginTop: 60, fontSize: 15 },
});
