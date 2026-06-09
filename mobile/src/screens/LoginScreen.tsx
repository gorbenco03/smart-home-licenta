import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { api } from '../services/api';
import { useAppStore } from '../store';
import { connectSocket } from '../services/socket';
import { T } from '../theme';

export default function LoginScreen() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const setAuth = useAppStore((s) => s.setAuth);

  async function handleLogin() {
    if (!username || !password) return;
    setLoading(true);
    setError('');
    try {
      const { access_token, user } = await api.auth.login(username, password);
      setAuth(access_token, user);
      connectSocket();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Eroare de conectare. Verifică IP-ul serverului.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Ambient glow top */}
      <View style={s.glowTop} pointerEvents="none" />
      {/* Ambient glow bottom */}
      <View style={s.glowBottom} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand mark */}
        <View style={s.brand}>
          <View style={s.logoBox}>
            <Text style={s.logoIcon}>⌂</Text>
          </View>
          <Text style={s.version}>v2.6.1</Text>
        </View>

        {/* Title block */}
        <View style={s.titleBlock}>
          <Text style={s.title}>Smart Home</Text>
          <View style={s.titleMeta}>
            <Text style={s.tagAccent}>LOCAL·FIRST</Text>
            <View style={s.dot3} />
            <Text style={s.tagMuted}>2 NODURI · 12 SENZORI</Text>
          </View>
        </View>

        {/* Inputs */}
        <View style={s.inputs}>
          <FieldInput label="UTILIZATOR" value={username} onChangeText={setUsername} />
          <FieldInput label="PAROLĂ" value={password} onChangeText={setPassword} secureTextEntry />
        </View>

        {error ? <Text style={s.errorText}>{error}</Text> : null}

        {/* CTA */}
        <TouchableOpacity
          style={[s.btn, loading && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={T.accentOn} />
            : <Text style={s.btnText}>Conectare →</Text>
          }
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        {/* Gateway status */}
        <View style={s.footer}>
          <View style={s.footerDot} />
          <Text style={s.footerText}>GATEWAY · 192.168.1.42 · ONLINE</Text>
        </View>
        <Text style={s.hint}>demo: admin / admin123</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldInput({
  label, value, onChangeText, secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
}) {
  return (
    <View style={fi.wrap}>
      <Text style={fi.label}>{label}</Text>
      <TextInput
        style={fi.input}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        placeholderTextColor={T.text4}
      />
    </View>
  );
}

const fi = StyleSheet.create({
  wrap: {
    backgroundColor: T.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 12,
    marginBottom: 14,
  },
  label: {
    fontFamily: 'Courier New',
    fontSize: 11,
    color: T.text3,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  input: {
    fontSize: 17,
    color: T.text,
    letterSpacing: -0.2,
    fontFamily: 'Courier New',
    padding: 0,
  },
});

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg,
  },
  glowTop: {
    position: 'absolute',
    top: -120, left: -80,
    width: 400, height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(251,146,60,0.10)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -140, right: -80,
    width: 360, height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(135,168,195,0.07)',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 40,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 0,
  },
  logoBox: {
    width: 34, height: 34,
    borderRadius: 10,
    backgroundColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: T.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  logoIcon: { fontSize: 18, color: T.accentOn },
  version: {
    fontFamily: 'Courier New',
    fontSize: 11,
    color: T.text3,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  titleBlock: { marginTop: 72, marginBottom: 48 },
  title: {
    fontSize: 38,
    fontWeight: '600',
    letterSpacing: -1.3,
    color: T.text,
    lineHeight: 42,
  },
  titleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  tagAccent: {
    fontFamily: 'Courier New',
    fontSize: 11,
    color: T.accent,
    letterSpacing: 0.4,
  },
  dot3: {
    width: 3, height: 3,
    borderRadius: 1.5,
    backgroundColor: T.text4,
  },
  tagMuted: {
    fontFamily: 'Courier New',
    fontSize: 11,
    color: T.text3,
    letterSpacing: 0.4,
  },
  inputs: { marginBottom: 6 },
  errorText: {
    color: T.danger,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
    marginTop: -4,
  },
  btn: {
    height: 56,
    borderRadius: 18,
    backgroundColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 32,
    shadowColor: T.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 8,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '600',
    color: T.accentOn,
    letterSpacing: -0.2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
  },
  footerDot: {
    width: 5, height: 5,
    borderRadius: 2.5,
    backgroundColor: T.success,
    shadowColor: T.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 3,
  },
  footerText: {
    fontFamily: 'Courier New',
    fontSize: 11,
    color: T.text3,
    letterSpacing: 0.4,
  },
  hint: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    color: T.text4,
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.3,
  },
});
