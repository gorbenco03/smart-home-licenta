import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { T, F, FONT } from '../theme';

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

/* ─── Step indicator ─────────────────────────────────────── */
const STEPS: { key: Step; label: string }[] = [
  { key: 'scan',       label: 'Rețele' },
  { key: 'password',   label: 'Parolă' },
  { key: 'connecting', label: 'Conectare' },
  { key: 'done',       label: 'Gata' },
];

function StepIndicator({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <View style={si.row}>
      {STEPS.map((s, i) => {
        const done   = i < idx;
        const active = i === idx;
        return (
          <React.Fragment key={s.key}>
            <View style={si.item}>
              <View style={[
                si.dot,
                done   && { backgroundColor: T.accent, borderColor: T.accent },
                active && { borderColor: T.accent, backgroundColor: T.accentSoft },
                !done && !active && { borderColor: T.glassBorder },
              ]}>
                {done
                  ? <Ionicons name="checkmark" size={11} color="#fff" />
                  : <Text style={[si.dotNum, { color: active ? T.accent : T.text4 }]}>{i + 1}</Text>
                }
              </View>
              <Text style={[si.dotLabel, { color: active ? T.text2 : T.text4 }]}>{s.label}</Text>
            </View>
            {i < STEPS.length - 1 && (
              <View style={[si.line, { backgroundColor: done ? T.accentLine : T.glassBorder }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const si = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  item: { alignItems: 'center', gap: 5 },
  dot: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  dotNum: { fontSize: 11, fontFamily: FONT.semibold },
  dotLabel: { fontSize: 10.5, fontFamily: FONT.medium, letterSpacing: 0.2 },
  line: { flex: 1, height: 1.5, marginBottom: 18, marginHorizontal: 6 },
});

/* ─── Signal icon helper ─────────────────────────────────── */
function signalIcon(signal: number): keyof typeof Ionicons.glyphMap {
  if (signal >= 66) return 'cellular';
  if (signal >= 33) return 'cellular-outline';
  return 'cellular-outline';
}

function signalColor(signal: number): string {
  if (signal >= 45) return T.success;
  if (signal >= 20) return T.warning;
  return T.text3;
}

/* ─── Main component ─────────────────────────────────────── */
export default function SetupScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep]           = useState<Step>('scan');
  const [networks, setNetworks]   = useState<WifiNetwork[]>([]);
  const [loading, setLoading]     = useState(false);
  const [selected, setSelected]   = useState<WifiNetwork | null>(null);
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
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

  /* ── Header comun ─────────────────────────────────────── */
  function Header({ title, sub }: { title: string; sub: string }) {
    return (
      <View style={s.header}>
        {/* Glow decorativ */}
        <View style={s.headerGlow} pointerEvents="none" />
        <View style={s.headerInner}>
          <LinearGradient
            colors={T.grad.accent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.headerIcon}
          >
            <Ionicons name="settings-outline" size={20} color="#fff" />
          </LinearGradient>
          <View style={s.headerTexts}>
            <Text style={s.kicker}>Configurare sistem</Text>
            <Text style={s.title}>{title}</Text>
            <Text style={s.sub}>{sub}</Text>
          </View>
        </View>
        <StepIndicator current={step} />
      </View>
    );
  }

  /* ── GlassCard inline (fără import separat, pentru overflow) */
  function GCard({ children, style }: { children: React.ReactNode; style?: object }) {
    return (
      <View style={[gc.wrap, style]}>
        <BlurView intensity={22} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: T.glass }]} />
        <View style={gc.inner}>{children}</View>
      </View>
    );
  }

  /* ── ECRAN SCANARE ──────────────────────────────────────── */
  if (step === 'scan') {
    return (
      <View style={s.root}>
        <View style={s.glowAccent} pointerEvents="none" />
        <Header
          title="Alege rețeaua WiFi"
          sub="Selectează rețeaua la care să se conecteze sistemul"
        />

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
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={s.emptyWrap}>
                  <Ionicons name="wifi-outline" size={40} color={T.text4} />
                  <Text style={s.emptyText}>Nicio rețea găsită</Text>
                  <Text style={s.emptyHint}>Asigură-te că ești conectat la SmartHome-Setup</Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  activeOpacity={0.78}
                  onPress={() => { setSelected(item); setStep('password'); }}
                  style={s.netOuter}
                >
                  <View style={[
                    s.netCard,
                    item.connected && { borderColor: T.accentLine },
                  ]}>
                    <BlurView intensity={18} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: item.connected ? T.accentSoft : T.glass }]} />
                    <View style={s.netContent}>
                      <View style={s.netLeft}>
                        <View style={s.netSsidRow}>
                          <Text style={s.netSsid}>{item.ssid}</Text>
                          {item.secured && (
                            <Ionicons name="lock-closed" size={13} color={T.text3} />
                          )}
                          {item.connected && (
                            <View style={s.connectedBadge}>
                              <Text style={s.connectedBadgeText}>Conectat</Text>
                            </View>
                          )}
                        </View>
                        <Text style={s.netMeta}>
                          {item.connected ? 'Rețeaua curentă' : `Semnal ${item.signal}%`}
                        </Text>
                      </View>
                      <View style={s.netRight}>
                        <Ionicons
                          name={signalIcon(item.signal)}
                          size={20}
                          color={signalColor(item.signal)}
                        />
                        <Ionicons name="chevron-forward" size={16} color={T.text4} />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />

            {error ? (
              <View style={s.errorWrap}>
                <Ionicons name="alert-circle-outline" size={15} color={T.danger} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={s.btnSecondary}
              onPress={scanNetworks}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh-outline" size={16} color={T.text2} />
              <Text style={s.btnSecondaryText}>Rescanare rețele</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  /* ── ECRAN PAROLĂ ───────────────────────────────────────── */
  if (step === 'password') {
    return (
      <KeyboardAvoidingView
        style={s.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.glowAccent} pointerEvents="none" />
        <Header
          title={selected?.ssid ?? ''}
          sub={selected?.secured ? 'Introdu parola rețelei WiFi' : 'Rețea deschisă — apasă Conectare'}
        />

        <View style={s.form}>
          {selected?.secured && (
            <GCard>
              <Text style={s.inputLabel}>Parolă WiFi</Text>
              <View style={[
                s.inputRow,
                { borderColor: T.glassBorder },
              ]}>
                <Ionicons name="lock-closed-outline" size={17} color={T.text3} />
                <TextInput
                  style={s.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  autoFocus
                  placeholderTextColor={T.text3}
                  placeholder="Parola rețelei"
                  returnKeyType="done"
                  onSubmitEditing={handleConnect}
                  textContentType="password"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => setShowPass((v) => !v)}
                  accessibilityLabel={showPass ? 'Ascunde parola' : 'Arată parola'}
                >
                  <Ionicons
                    name={showPass ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={T.text3}
                  />
                </TouchableOpacity>
              </View>
            </GCard>
          )}

          {!selected?.secured && (
            <GCard>
              <View style={s.openNetRow}>
                <Ionicons name="wifi-outline" size={20} color={T.success} />
                <Text style={s.openNetText}>Rețea deschisă — nu este nevoie de parolă</Text>
              </View>
            </GCard>
          )}

          {error ? (
            <View style={s.errorWrap}>
              <Ionicons name="alert-circle-outline" size={15} color={T.danger} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>

        <View style={s.btnRow}>
          <TouchableOpacity
            style={s.btnBack}
            onPress={() => { setStep('scan'); setError(''); }}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={16} color={T.text2} />
            <Text style={s.btnBackText}>Înapoi</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.btnPrimaryOuter, (selected?.secured && !password) && { opacity: 0.5 }]}
            onPress={handleConnect}
            disabled={!!(selected?.secured && !password)}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={T.grad.accent}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.btnPrimary}
            >
              <Text style={s.btnPrimaryText}>Conectare</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  /* ── ECRAN CONECTARE ─────────────────────────────────────── */
  if (step === 'connecting') {
    return (
      <View style={[s.root, s.center]}>
        <View style={s.glowAccent} pointerEvents="none" />
        <View style={s.connectingIconWrap}>
          <ActivityIndicator color={T.accent} size="large" />
        </View>
        <Text style={s.connectingTitle}>Se conectează...</Text>
        <Text style={s.connectingSub}>
          Sistemul se mută pe rețeaua{'\n'}
          <Text style={{ color: T.accentHi }}>{selected?.ssid}</Text>
          {'\n'}Aplicația se va reconecta automat.
        </Text>
      </View>
    );
  }

  /* ── ECRAN DONE ──────────────────────────────────────────── */
  return (
    <View style={[s.root, s.center]}>
      <View style={s.doneIconWrap}>
        <LinearGradient
          colors={T.grad.success}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.doneIconGrad}
        >
          <Ionicons name="checkmark" size={40} color="#fff" />
        </LinearGradient>
      </View>
      <Text style={s.doneTitle}>Conectat cu succes!</Text>
      <Text style={s.doneSub}>
        Sistemul este acum pe rețeaua{'\n'}
        <Text style={{ color: T.accentHi }}>{selected?.ssid}</Text>
        {'\n'}Reconectare în curs...
      </Text>
    </View>
  );
}

/* ─── GlassCard styles ───────────────────────────────────── */
const gc = StyleSheet.create({
  wrap: {
    borderRadius: T.r.md,
    borderWidth: 1,
    borderColor: T.glassBorder,
    overflow: 'hidden',
    backgroundColor: 'rgba(18,26,46,0.55)',
    ...T.shadow,
    marginBottom: 16,
  },
  inner: { padding: T.s.lg },
});

/* ─── Main styles ────────────────────────────────────────── */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  glowAccent: {
    position: 'absolute',
    top: -80, left: -60,
    width: 300, height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(109,139,255,0.12)',
  },

  /* Header */
  header: {
    paddingTop: 60,
    paddingBottom: 0,
    backgroundColor: 'transparent',
  },
  headerGlow: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 180,
    backgroundColor: 'rgba(109,139,255,0.04)',
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: T.s.md,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  headerIcon: {
    width: 44, height: 44,
    borderRadius: T.r.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
    ...T.glow,
  },
  headerTexts: { flex: 1 },
  kicker: {
    ...F.kicker,
    color: T.accent,
    marginBottom: 4,
  },
  title: {
    ...F.title,
    lineHeight: 32,
    marginBottom: 6,
  },
  sub: {
    ...F.body,
    color: T.text3,
    lineHeight: 21,
  },

  /* List */
  list: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4 },

  netOuter: { marginBottom: 10 },
  netCard: {
    borderRadius: T.r.md,
    borderWidth: 1,
    borderColor: T.glassBorder,
    overflow: 'hidden',
    backgroundColor: 'rgba(18,26,46,0.55)',
  },
  netContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  netLeft: { flex: 1 },
  netSsidRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  netSsid: {
    ...F.body,
    color: T.text,
    fontSize: 16,
    fontFamily: FONT.medium,
  },
  netMeta: {
    ...F.caption,
    color: T.text3,
    marginTop: 3,
  },
  netRight: { flexDirection: 'row', alignItems: 'center', gap: T.s.sm },

  connectedBadge: {
    backgroundColor: T.accentSoft,
    borderRadius: T.r.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: T.accentLine,
  },
  connectedBadgeText: {
    fontSize: 11,
    fontFamily: FONT.semibold,
    color: T.accentHi,
  },

  /* Loading */
  loadingText: {
    ...F.caption,
    color: T.text3,
    marginTop: 16,
  },

  /* Empty */
  emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText: {
    ...F.body,
    color: T.text3,
    fontFamily: FONT.medium,
  },
  emptyHint: {
    ...F.caption,
    color: T.text4,
    textAlign: 'center',
    lineHeight: 18,
  },

  /* Error */
  errorWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: T.s.sm,
    backgroundColor: T.dangerSoft,
    borderRadius: T.r.sm,
    borderWidth: 1,
    borderColor: T.dangerLine,
    padding: T.s.md,
    marginHorizontal: 16,
    marginBottom: T.s.md,
  },
  errorText: {
    ...F.label,
    color: T.dangerHi,
    flex: 1,
    lineHeight: 19,
  },

  /* Secondary button */
  btnSecondary: {
    margin: 16,
    marginTop: 4,
    height: 50,
    borderRadius: T.r.md,
    backgroundColor: T.glass2,
    borderWidth: 1,
    borderColor: T.glassBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.s.sm,
  },
  btnSecondaryText: {
    ...F.label,
    color: T.text2,
    fontFamily: FONT.medium,
  },

  /* Form */
  form: { paddingHorizontal: 16, flex: 1, paddingTop: 4 },
  inputLabel: {
    ...F.label,
    color: T.text2,
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.glass2,
    borderRadius: T.r.sm,
    borderWidth: 1,
    paddingHorizontal: T.s.lg,
    minHeight: 50,
    gap: T.s.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: FONT.regular,
    color: T.text,
    paddingVertical: 0,
  },

  openNetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.s.md,
  },
  openNetText: {
    ...F.body,
    color: T.text2,
    flex: 1,
  },

  /* Button row */
  btnRow: { flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 32 },

  btnBack: {
    height: 52,
    paddingHorizontal: 18,
    borderRadius: T.r.md,
    backgroundColor: T.glass2,
    borderWidth: 1,
    borderColor: T.glassBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  btnBackText: {
    ...F.label,
    color: T.text2,
    fontFamily: FONT.medium,
  },

  btnPrimaryOuter: {
    flex: 1,
    borderRadius: T.r.md,
    overflow: 'hidden',
    ...T.glow,
  },
  btnPrimary: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnPrimaryText: {
    fontSize: 16,
    fontFamily: FONT.semibold,
    color: '#fff',
    letterSpacing: -0.2,
  },

  /* Connecting */
  connectingIconWrap: {
    width: 80, height: 80,
    borderRadius: 40,
    backgroundColor: T.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: T.accentLine,
  },
  connectingTitle: {
    ...F.heading,
    fontSize: 22,
    marginBottom: 12,
  },
  connectingSub: {
    ...F.body,
    color: T.text3,
    textAlign: 'center',
    lineHeight: 24,
  },

  /* Done */
  doneIconWrap: { marginBottom: 28, ...T.glow },
  doneIconGrad: {
    width: 88, height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: {
    ...F.title,
    marginBottom: 12,
  },
  doneSub: {
    ...F.body,
    color: T.text3,
    textAlign: 'center',
    lineHeight: 24,
  },
});
