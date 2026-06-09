import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
      setError(e.response?.data?.message ?? 'Nu am găsit sistemul. Verifică dacă ești pe aceeași rețea WiFi.');
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
            <Ionicons name="home" size={18} color={T.accentOn} />
          </View>
        </View>

        {/* Title block */}
        <View style={s.titleBlock}>
          <Text style={s.title}>Smart Home</Text>
          <Text style={s.subtitle}>Bun venit acasă</Text>
        </View>

        {/* Inputs */}
        <View style={s.inputs}>
          <FieldInput label="Utilizator" value={username} onChangeText={setUsername} />
          <FieldInput label="Parolă" value={password} onChangeText={setPassword} secureTextEntry />
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
            : <Text style={s.btnText}>Conectare</Text>
          }
        </TouchableOpacity>
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
    paddingTop: 12,
    paddingBottom: 13,
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: T.text3,
    marginBottom: 5,
  },
  input: {
    fontSize: 17,
    color: T.text,
    letterSpacing: -0.2,
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
  },
  logoBox: {
    width: 40, height: 40,
    borderRadius: 12,
    backgroundColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: T.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  titleBlock: { marginTop: 64, marginBottom: 44 },
  title: {
    fontSize: 38,
    fontWeight: '700',
    letterSpacing: -1.2,
    color: T.text,
    lineHeight: 44,
  },
  subtitle: {
    fontSize: 16,
    color: T.text2,
    marginTop: 8,
  },
  inputs: { marginBottom: 6 },
  errorText: {
    color: T.danger,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
    marginTop: -2,
    lineHeight: 20,
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
    fontSize: 17,
    fontWeight: '600',
    color: T.accentOn,
    letterSpacing: -0.2,
  },
});
