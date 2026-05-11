import React, { useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAppStore } from '../store';
import { SensorCard } from '../components/SensorCard';

const NODE_ORDER = ['esp32_node_a', 'esp32_node_b'];

export default function DashboardScreen() {
  const latestReadings = useAppStore((s) => s.latestReadings);
  const nodeStatus     = useAppStore((s) => s.nodeStatus);
  const setLatest      = useAppStore((s) => s.setLatestReading);
  const connected      = useAppStore((s) => s.connected);

  // Fetch inițial — WebSocket-ul ține restul live
  const { data: nodes, isLoading, refetch } = useQuery({
    queryKey: ['nodes'],
    queryFn: api.sensors.nodes,
    staleTime: 30_000,
  });

  const { data: latest, refetch: refetchLatest } = useQuery({
    queryKey: ['latest'],
    queryFn: api.sensors.latest,
    staleTime: 10_000,
    onSuccess: (data) => {
      Object.values(data).forEach((r) => setLatest(r));
    },
  });

  function handleRefresh() {
    refetch();
    refetchLatest();
  }

  const sortedNodes = nodes
    ? [...nodes].sort((a, b) =>
        NODE_ORDER.indexOf(a.nodeId) - NODE_ORDER.indexOf(b.nodeId),
      )
    : [];

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Dashboard</Text>
        <View style={[s.wsBadge, connected ? s.wsOn : s.wsOff]}>
          <Text style={s.wsBadgeText}>{connected ? '● live' : '○ reconectare…'}</Text>
        </View>
      </View>

      {isLoading && (
        <ActivityIndicator color="#38bdf8" style={{ marginTop: 40 }} />
      )}

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor="#38bdf8" />
        }
      >
        {sortedNodes.map((node) => (
          <SensorCard
            key={node.nodeId}
            nodeId={node.nodeId}
            location={node.location}
            reading={latestReadings[node.nodeId] ?? null}
            online={nodeStatus[node.nodeId] ?? node.online}
          />
        ))}

        {sortedNodes.length === 0 && !isLoading && (
          <Text style={s.empty}>
            Niciun nod găsit.{'\n'}Verifică că backend-ul rulează.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#f1f5f9' },
  wsBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  wsOn:    { backgroundColor: '#14532d' },
  wsOff:   { backgroundColor: '#431407' },
  wsBadgeText: { fontSize: 12, color: '#86efac', fontWeight: '600' },
  content: { padding: 16 },
  empty: {
    color: '#475569', textAlign: 'center',
    fontSize: 15, marginTop: 60, lineHeight: 24,
  },
});
