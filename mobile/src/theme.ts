// Design tokens — VIBRANT GLASSMORPHISM (dark)
// Fundal navy profund, suprafețe „glass" translucide, accente vii
// (indigo → cyan), text conform WCAG AA. Fonturi: Space Grotesk
// (titluri/cifre) + Inter (corp).

import { TextStyle } from 'react-native';

export const T = {
  // ── Surfaces (navy profund) ──────────────────────────────
  bg:         '#070A14',
  bgElev:     '#0B1020',
  surface:    '#121A2E',   // fallback opac pentru glass
  surface2:   '#172139',
  surface3:   '#1E2A47',
  surfaceHi:  '#26345A',

  // ── Glass (translucid peste fundal/gradient) ─────────────
  glass:        'rgba(255,255,255,0.055)',
  glass2:       'rgba(255,255,255,0.09)',
  glassStrong:  'rgba(255,255,255,0.13)',
  glassBorder:  'rgba(255,255,255,0.12)',
  glassBorderHi:'rgba(255,255,255,0.20)',

  // ── Borders ──────────────────────────────────────────────
  border:       'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.16)',
  borderWarm:   'rgba(109,124,255,0.30)',

  // ── Text — reci, contrast AA pe navy ─────────────────────
  text:  '#F4F7FF',
  text2: '#C4CCE2',   // ~9:1
  text3: '#97A1BE',   // ~5:1
  text4: '#717D9C',   // decorativ / large only (~3.2:1)

  // ── Accent — indigo vibrant + cyan secundar ──────────────
  accent:     '#6D8BFF',
  accentHi:   '#9AB0FF',
  accentSoft: 'rgba(109,139,255,0.18)',
  accentLine: 'rgba(109,139,255,0.55)',
  accentOn:   '#06101F',

  cyan:       '#22D3EE',
  cyanSoft:   'rgba(34,211,238,0.16)',
  indigo:     '#7C5CFF',
  violet:     '#A855F7',
  violetSoft: 'rgba(168,85,247,0.18)',

  // ── Semantic (vibrant) ───────────────────────────────────
  success:     '#34D399',
  successSoft: 'rgba(52,211,153,0.16)',
  successLine: 'rgba(52,211,153,0.45)',

  warning:     '#FBBF24',
  warningSoft: 'rgba(251,191,36,0.16)',

  danger:     '#FB5E72',
  dangerHi:   '#FF8A98',
  dangerSoft: 'rgba(251,94,114,0.16)',
  dangerLine: 'rgba(251,94,114,0.50)',

  info:     '#38BDF8',
  infoSoft: 'rgba(56,189,248,0.16)',

  // ── Gradients (pentru LinearGradient: colors={T.grad.x}) ──
  grad: {
    accent:  ['#6D8BFF', '#22D3EE'] as const,
    violet:  ['#7C5CFF', '#A855F7'] as const,
    success: ['#22D3EE', '#34D399'] as const,
    danger:  ['#FB5E72', '#F0883E'] as const,
    bg:      ['#0B1224', '#070A14'] as const,
  },

  // ── Radii ────────────────────────────────────────────────
  r: { xs: 10, sm: 14, md: 18, lg: 24, xl: 30, pill: 999 },

  // ── Spacing (ritm 4/8) ───────────────────────────────────
  s: { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 30 },

  // ── Umbră card ───────────────────────────────────────────
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 22,
    elevation: 10,
  } as const,

  // ── Glow de accent (sub butoane/elemente active) ─────────
  glow: {
    shadowColor: '#6D8BFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 8,
  } as const,
};

// ── Familii de fonturi (încărcate în App.tsx) ───────────────
export const FONT = {
  regular:  'Inter_400Regular',
  medium:   'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold:     'Inter_700Bold',
  display:  'SpaceGrotesk_700Bold',
  displaySemi: 'SpaceGrotesk_600SemiBold',
  num:      'SpaceGrotesk_600SemiBold',
  numBold:  'SpaceGrotesk_700Bold',
};

// ── Scară tipografică ───────────────────────────────────────
// La fonturi custom folosim fontFamily pentru greutate (NU
// fontWeight, ca să nu derapeze pe Android). Cifrele de senzori
// folosesc Space Grotesk + tabular-nums pentru aliniere.
export const F: Record<string, TextStyle> = {
  display: { fontSize: 34, fontFamily: FONT.display,     letterSpacing: -0.8, color: T.text },
  title:   { fontSize: 26, fontFamily: FONT.display,     letterSpacing: -0.6, color: T.text },
  heading: { fontSize: 18, fontFamily: FONT.displaySemi, letterSpacing: -0.2, color: T.text },
  body:    { fontSize: 15, fontFamily: FONT.regular,     color: T.text2 },
  label:   { fontSize: 13.5, fontFamily: FONT.medium,    color: T.text2 },
  caption: { fontSize: 12.5, fontFamily: FONT.medium,    color: T.text3 },
  kicker:  {
    fontSize: 12, fontFamily: FONT.semibold, color: T.text3,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  num:     { fontFamily: FONT.num,     fontVariant: ['tabular-nums'], color: T.text },
  numBold: { fontFamily: FONT.numBold, fontVariant: ['tabular-nums'], color: T.text },
};
