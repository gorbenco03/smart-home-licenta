import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import axios from 'axios';
import { T } from '../theme';

// Client dedicat pentru setup — mereu vorbește cu hotspot-ul RPi
// indiferent de ce e setat în config.ts
const setupClient = axios.create({ baseURL: 'http://192.168.4.1:3000/api' });

interface WifiNetwork {
  ssid: string;
  signal: number;
  secured: boolean;
  connected: boolean;
}

type Step = 'scan' | 'password' | 'connecting' | 'done';

export default function SetupScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep]           = useState<Step>('scan');
  const [networks, setNetworks]   = useState<WifiNetwork[]>([]);
  const [loading, setLoading]     = useState(false);
  const [selected, setSelected]   = useState<WifiNetwork | null>(null);
  const [password, setPassword]   = useState('');
  const [error, setError]         = useState('');
  const doneTimerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    scanNetworks();
    return () => { if (doneTimerRef.current) clearTimeout(doneTimerRef.current); };
  }, []);

  async function scanNetworks() {
    setLoading(true);
    setError('');
    try {
      const { data } = await setupClient.get('/setup/networks');
      setNetworks(data);
    } catch {
      setError('Nu s-au putut scana rețelele. Verifică că ești conectat la SmartHome-Setup.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    if (!selected) return;
    setStep('connecting');
    setError('');
    try {
      const { data: result } = await setupClient.post('/setup/connect', {
        ssid: selected.ssid,
        password,
      });
      if (result.success) {
        setStep('done');
        doneTimerRef.current = setTimeout(() => onDone(), 5000);
      } else {
        setError(result.message);
        setStep('password');
      }
    } catch {
      setError('Eroare de conexiune. Încearcă din nou.');
      setStep('password');
    }
  }

  function signalIcon(signal: number) {
    if (signal >= 70) return '▂▄▆█';
    if (signal >= 45) return '▂▄▆_';
    if (signal >= 20) return '▂▄__';
    return '▂___';
  }

  // ── ECRAN SCANARE ──────────────────────────────────────
  if (step === 'scan') {
    return (
      <View style={s.root}>
        <View style={s.header}>
          <Text style={s.kicker}>CONFIGURARE</Text>
          <Text style={s.title}>Alege rețeaua WiFi</Text>
          <Text style={s.sub}>Selectează rețeaua la care să se conecteze sistemul</Text>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator color={T.accent} size="large" />
            <Text style={s.loadingText}>Scanare rețele...</Text>
          </View>
        ) : (
          <>
            <FlatList
              data={networks}
              keyExtractor={(item) => item.ssid}
              contentContainerStyle={s.list}
              ListEmptyComponent={
                <Text style={s.emptyText}>Nicio rețea găsită</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.networkItem, item.connected && s.networkConnected]}
                  onPress={() => { setSelected(item); setStep('password'); }}
                  activeOpacity={0.75}
                >
                  <View style={s.networkLeft}>
                    <Text style={s.networkSsid}>{item.ssid}</Text>
                    <Text style={s.networkMeta}>
                      {item.secured ? '🔒 ' : '🔓 '}
                      {item.connected ? 'Conectat acum' : `${item.signal}%`}
                    </Text>
                  </View>
                  <Text style={s.signalIcon}>{signalIcon(item.signal)}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={s.btnSecondary} onPress={scanNetworks}>
              <Text style={s.btnSecondaryText}>↻ Rescanare</Text>
            </TouchableOpacity>
          </>
        )}

        {error ? <Text style={s.error}>{error}</Text> : null}
      </View>
    );
  }

  // ── ECRAN PAROLĂ ───────────────────────────────────────
  if (step === 'password') {
    return (
      <KeyboardAvoidingView
        style={s.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.header}>
          <Text style={s.kicker}>CONFIGURARE</Text>
          <Text style={s.title}>{selected?.ssid}</Text>
          <Text style={s.sub}>
            {selected?.secured ? 'Introdu parola rețelei' : 'Rețea deschisă — apasă Conectare'}
          </Text>
        </View>

        <View style={s.form}>
          {selected?.secured && (
            <View style={s.inputWrap}>
              <Text style={s.inputLabel}>PAROLĂ WiFi</Text>
              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoFocus
                placeholderTextColor={T.text4}
                placeholder="parola rețelei"
              />
            </View>
          )}
          {error ? <Text style={s.error}>{error}</Text> : null}
        </View>

        <View style={s.btnRow}>
          <TouchableOpacity style={s.btnBack} onPress={() => { setStep('scan'); setError(''); }}>
            <Text style={s.btnBackText}>← Înapoi</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, (!password && selected?.secured) && { opacity: 0.5 }]}
            onPress={handleConnect}
            disabled={!!(selected?.secured && !password)}
          >
            <Text style={s.btnText}>Conectare →</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── ECRAN CONECTARE ────────────────────────────────────
  if (step === 'connecting') {
    return (
      <View style={[s.root, s.center]}>
        <ActivityIndicator color={T.accent} size="large" />
        <Text style={s.connectingTitle}>Se conectează...</Text>
        <Text style={s.connectingSub}>
          Sistemul se mută pe rețeaua {selected?.ssid}.{'\n'}
          Aplicația se va reconecta automat.
        </Text>
      </View>
    );
  }

  // ── ECRAN DONE ─────────────────────────────────────────
  return (
    <View style={[s.root, s.center]}>
      <Text style={s.doneIcon}>✓</Text>
      <Text style={s.doneTitle}>Conectat!</Text>
      <Text style={s.doneSub}>
        Sistemul este acum pe rețeaua {selected?.ssid}.{'\n'}
        Reconectare în curs...
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 24 },
  kicker: { fontFamily: 'Courier New', fontSize: 11, color: T.text3, letterSpacing: 1.4, marginBottom: 6 },
  title: { fontSize: 28, fontWeight: '600', color: T.text, letterSpacing: -0.6 },
  sub: { fontSize: 14, color: T.text3, marginTop: 8, lineHeight: 20 },
  list: { paddingHorizontal: 16, paddingBottom: 16 },
  networkItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: T.surface, borderRadius: 16, borderWidth: 1, borderColor: T.border,
    padding: 16, marginBottom: 10,
  },
  networkConnected: { borderColor: T.accent },
  networkLeft: { flex: 1 },
  networkSsid: { fontSize: 16, fontWeight: '500', color: T.text },
  networkMeta: { fontSize: 12, color: T.text3, marginTop: 3, fontFamily: 'Courier New' },
  signalIcon: { fontFamily: 'Courier New', fontSize: 12, color: T.accent, marginLeft: 12 },
  form: { paddingHorizontal: 24, flex: 1 },
  inputWrap: {
    backgroundColor: T.surface, borderRadius: 16, borderWidth: 1,
    borderColor: T.border, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14,
  },
  inputLabel: { fontFamily: 'Courier New', fontSize: 11, color: T.text3, letterSpacing: 1.2, marginBottom: 6 },
  input: { fontSize: 17, color: T.text, fontFamily: 'Courier New' },
  btnRow: { flexDirection: 'row', gap: 12, padding: 24 },
  btn: {
    flex: 1, height: 52, borderRadius: 16, backgroundColor: T.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '600', color: T.accentOn },
  btnBack: {
    height: 52, paddingHorizontal: 20, borderRadius: 16,
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    alignItems: 'center', justifyContent: 'center',
  },
  btnBackText: { fontSize: 15, color: T.text2 },
  btnSecondary: {
    margin: 16, height: 48, borderRadius: 14,
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    alignItems: 'center', justifyContent: 'center',
  },
  btnSecondaryText: { fontSize: 14, color: T.text2, fontFamily: 'Courier New' },
  error: { color: T.danger, fontSize: 13, textAlign: 'center', margin: 16 },
  emptyText: { color: T.text3, textAlign: 'center', marginTop: 40, fontFamily: 'Courier New' },
  loadingText: { color: T.text3, marginTop: 16, fontFamily: 'Courier New' },
  connectingTitle: { fontSize: 22, fontWeight: '600', color: T.text, marginTop: 20 },
  connectingSub: { fontSize: 14, color: T.text3, textAlign: 'center', marginTop: 12, lineHeight: 22 },
  doneIcon: { fontSize: 64, color: T.success },
  doneTitle: { fontSize: 26, fontWeight: '600', color: T.text, marginTop: 16 },
  doneSub: { fontSize: 14, color: T.text3, textAlign: 'center', marginTop: 10, lineHeight: 22 },
});
