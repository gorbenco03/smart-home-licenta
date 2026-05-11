import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAppStore } from '../store';

const NODES = [
  { id: 'esp32_node_a', label: 'Living / Bucătărie' },
  { id: 'esp32_node_b', label: 'Dormitor / Baie' },
];

const RELAYS = [
  { index: 0, label: 'Lumină principală', icon: '💡' },
  { index: 1, label: 'Ventilator',        icon: '🌀' },
  { index: 2, label: 'Priză 1',           icon: '🔌' },
  { index: 3, label: 'Priză 2',           icon: '🔌' },
];

function RelayButton({ nodeId, relay, label, icon }: {
  nodeId: string; relay: number; label: string; icon: string;
}) {
  const [active, setActive] = useState(false);

  const mutation = useMutation({
    mutationFn: (action: 'relay_on' | 'relay_off') =>
      api.commands.send(nodeId, action, relay),
    onSuccess: (_, action) => setActive(action === 'relay_on'),
  });

  return (
    <View style={r.row}>
      <Text style={r.icon}>{icon}</Text>
      <Text style={r.label}>{label}</Text>
      <View style={r.controls}>
        <TouchableOpacity
          style={[r.btn, active && r.btnOn]}
          onPress={() => mutation.mutate('relay_on')}
          disabled={mutation.isPending}
        >
          <Text style={r.btnText}>ON</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[r.btn, !active && r.btnOff]}
          onPress={() => mutation.mutate('relay_off')}
          disabled={mutation.isPending}
        >
          <Text style={r.btnText}>OFF</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ControlScreen() {
  const nodeStatus = useAppStore((s) => s.nodeStatus);

  const buzzerMutation = useMutation({
    mutationFn: (nodeId: string) => api.commands.send(nodeId, 'buzzer_beep'),
  });

  const allOffMutation = useMutation({
    mutationFn: (nodeId: string) => api.commands.send(nodeId, 'all_off'),
  });

  return (
    <View style={s.container}>
      <Text style={s.title}>Control</Text>

      <ScrollView contentContainerStyle={s.content}>
        {NODES.map((node) => (
          <View key={node.id} style={s.card}>
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>{node.label}</Text>
              <View style={[s.dot, nodeStatus[node.id] ? s.dotOn : s.dotOff]} />
            </View>

            {RELAYS.map((relay) => (
              <RelayButton
                key={relay.index}
                nodeId={node.id}
                relay={relay.index}
                label={relay.label}
                icon={relay.icon}
              />
            ))}

            <View style={s.actionRow}>
              <TouchableOpacity
                style={s.actionBtn}
                onPress={() => buzzerMutation.mutate(node.id)}
                disabled={buzzerMutation.isPending}
              >
                <Text style={s.actionBtnText}>🔔 Test buzzer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, s.actionBtnDanger]}
                onPress={() => allOffMutation.mutate(node.id)}
                disabled={allOffMutation.isPending}
              >
                <Text style={s.actionBtnText}>⛔ Oprire totală</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  title: {
    fontSize: 24, fontWeight: '700', color: '#f1f5f9',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12,
  },
  content: { padding: 16 },
  card: {
    backgroundColor: '#1e293b', borderRadius: 16,
    padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#f1f5f9' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOn: { backgroundColor: '#22c55e' },
  dotOff: { backgroundColor: '#334155' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtn: {
    flex: 1, backgroundColor: '#334155', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  actionBtnDanger: { backgroundColor: '#7f1d1d' },
  actionBtnText: { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
});

const r = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#334155',
  },
  icon:  { fontSize: 20, marginRight: 10 },
  label: { flex: 1, color: '#cbd5e1', fontSize: 14 },
  controls: { flexDirection: 'row', gap: 6 },
  btn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: '#475569',
  },
  btnOn:  { backgroundColor: '#14532d', borderColor: '#22c55e' },
  btnOff: { backgroundColor: '#450a0a', borderColor: '#ef4444' },
  btnText: { color: '#e2e8f0', fontSize: 12, fontWeight: '700' },
});
