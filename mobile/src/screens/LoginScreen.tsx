import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useAppStore } from '../store';
import { connectSocket } from '../services/socket';
import { T, F, FONT } from '../theme';

export default function LoginScreen() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [showPass, setShowPass] = useState(false);
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
      {/* Glow decorativ accent — stânga sus */}
      <View style={s.glowAccent} pointerEvents="none" />
      {/* Glow decorativ cyan — dreapta jos */}
      <View style={s.glowCyan} pointerEvents="none" />
      {/* Glow violet — centru */}
      <View style={s.glowViolet} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand mark — logo cu gradient */}
        <View style={s.brand}>
          <LinearGradient
            colors={T.grad.accent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.logoGrad}
          >
            <Ionicons name="home" size={22} color="#fff" />
          </LinearGradient>
          <View style={s.brandText}>
            <Text style={s.brandName}>SmartHome</Text>
            <Text style={s.brandTagline}>Sistem local</Text>
          </View>
        </View>

        {/* Title block */}
        <View style={s.titleBlock}>
          <Text style={s.title}>Bun venit</Text>
          <Text style={s.subtitle}>
            Autentifică-te pentru a controla{'\n'}sistemul casei tale
          </Text>
        </View>

        {/* Card glass cu câmpuri */}
        <View style={s.cardWrap}>
          <BlurView
            intensity={28}
            tint="dark"
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: T.glass }]} />

          <View style={s.cardInner}>
            <FieldInput
              label="Utilizator"
              value={username}
              onChangeText={setUsername}
              icon="person-outline"
              autoCapitalize="none"
              returnKeyType="next"
              textContentType="username"
            />
            <FieldInput
              label="Parolă"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              icon="lock-closed-outline"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              textContentType="password"
              trailingNode={
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
              }
            />

            {error ? (
              <View style={s.errorWrap}>
                <Ionicons name="alert-circle-outline" size={15} color={T.danger} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Buton principal cu gradient + glow */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.88}
              style={[s.btnOuter, loading && { opacity: 0.7 }]}
            >
              <LinearGradient
                colors={T.grad.accent}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.btnGrad}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : (
                    <View style={s.btnRow}>
                      <Text style={s.btnText}>Conectare</Text>
                      <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </View>
                  )
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer info */}
        <View style={s.footer}>
          <Ionicons name="wifi-outline" size={13} color={T.text4} />
          <Text style={s.footerText}>
            Asigură-te că ești pe aceeași rețea WiFi cu sistemul
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ─── Field Input ─────────────────────────────────────────── */

function FieldInput({
  label, value, onChangeText, secureTextEntry, icon, trailingNode,
  autoCapitalize, returnKeyType, onSubmitEditing, textContentType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  trailingNode?: React.ReactNode;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  returnKeyType?: 'done' | 'next' | 'go' | 'search' | 'send';
  onSubmitEditing?: () => void;
  textContentType?: 'username' | 'password' | 'emailAddress';
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={fi.wrap}>
      <Text style={fi.label}>{label}</Text>
      <View style={[
        fi.inputRow,
        { borderColor: focused ? T.accentLine : T.glassBorder },
      ]}>
        <Ionicons name={icon} size={17} color={focused ? T.accent : T.text3} style={fi.icon} />
        <TextInput
          style={fi.input}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize ?? 'none'}
          placeholderTextColor={T.text3}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          textContentType={textContentType}
          autoCorrect={false}
        />
        {trailingNode}
      </View>
    </View>
  );
}

const fi = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: {
    ...F.label,
    color: T.text2,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.glass2,
    borderRadius: T.r.md,
    borderWidth: 1,
    paddingHorizontal: T.s.lg,
    minHeight: 52,
    gap: T.s.sm,
  },
  icon: { flexShrink: 0 },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: FONT.regular,
    color: T.text,
    letterSpacing: -0.2,
    paddingVertical: 0,
  },
});

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg,
  },

  /* Glow-uri decorative */
  glowAccent: {
    position: 'absolute',
    top: -100, left: -60,
    width: 340, height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(109,139,255,0.13)',
  },
  glowCyan: {
    position: 'absolute',
    bottom: -120, right: -80,
    width: 300, height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(34,211,238,0.09)',
  },
  glowViolet: {
    position: 'absolute',
    top: '38%', left: '25%',
    width: 250, height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(124,92,255,0.07)',
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 48,
  },

  /* Brand */
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.s.md,
    marginBottom: 2,
  },
  logoGrad: {
    width: 48, height: 48,
    borderRadius: T.r.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...T.glow,
  },
  brandText: { gap: 2 },
  brandName: {
    ...F.heading,
    color: T.text,
    letterSpacing: -0.4,
  },
  brandTagline: {
    ...F.caption,
    color: T.text3,
  },

  /* Title */
  titleBlock: {
    marginTop: 52,
    marginBottom: 36,
  },
  title: {
    ...F.display,
    letterSpacing: -1,
    lineHeight: 40,
  },
  subtitle: {
    ...F.body,
    color: T.text3,
    marginTop: 10,
    lineHeight: 22,
  },

  /* Card */
  cardWrap: {
    borderRadius: T.r.lg,
    borderWidth: 1,
    borderColor: T.glassBorder,
    overflow: 'hidden',
    backgroundColor: 'rgba(18,26,46,0.55)',
    ...T.shadow,
  },
  cardInner: {
    padding: T.s.xl,
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
    marginBottom: T.s.lg,
  },
  errorText: {
    ...F.label,
    color: T.dangerHi,
    flex: 1,
    lineHeight: 19,
  },

  /* Buton */
  btnOuter: {
    borderRadius: T.r.md,
    overflow: 'hidden',
    ...T.glow,
    marginTop: T.s.sm,
  },
  btnGrad: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.s.sm,
  },
  btnText: {
    fontSize: 16,
    fontFamily: FONT.semibold,
    color: '#fff',
    letterSpacing: -0.2,
  },

  /* Footer */
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 28,
    justifyContent: 'center',
  },
  footerText: {
    ...F.caption,
    color: T.text4,
    textAlign: 'center',
    lineHeight: 18,
  },
});
