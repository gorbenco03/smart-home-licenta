// Design tokens — warm dark stone + amber accent
// Translated from tokens.css (Claude Design handoff)

import { TextStyle } from 'react-native';

export const T = {
  // Surfaces
  bg:         '#0c0a09',
  bgElev:     '#110f0d',
  surface:    '#1c1917',
  surface2:   '#232020',
  surface3:   '#2c2826',
  surfaceHi:  '#3a3633',

  // Borders
  border:       'rgba(255, 246, 230, 0.06)',
  borderStrong: 'rgba(255, 246, 230, 0.10)',
  borderWarm:   'rgba(251, 146, 60, 0.22)',

  // Text — warm whites
  text:  '#f5f4f1',
  text2: '#b7b0a8',
  text3: '#807872',
  text4: '#57534e',

  // Accent — warm amber
  accent:     '#fb923c',
  accentHi:   '#fdba74',
  accentSoft: 'rgba(251, 146, 60, 0.14)',
  accentLine: 'rgba(251, 146, 60, 0.45)',
  accentOn:   '#1a0f06',

  // Semantic
  success:     '#7da76b',
  successSoft: 'rgba(125, 167, 107, 0.16)',
  successLine: 'rgba(125, 167, 107, 0.40)',

  warning:     '#e0a449',
  warningSoft: 'rgba(224, 164, 73, 0.16)',

  danger:     '#db6a5e',
  dangerHi:   '#e98c80',
  dangerSoft: 'rgba(219, 106, 94, 0.16)',
  dangerLine: 'rgba(219, 106, 94, 0.45)',

  info:     '#87a8c3',
  infoSoft: 'rgba(135, 168, 195, 0.16)',

  violet:     '#a896c5',
  violetSoft: 'rgba(168, 150, 197, 0.16)',

  // Radii shortcuts
  r: { xs: 8, sm: 12, md: 18, lg: 24, xl: 32 },

  // Card shadow (iOS)
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  } as const,
};

// ── Scară tipografică — system font, nimic sub 12px ──────
// Valorile numerice de senzori folosesc tabular-nums pentru
// cifre aliniate, fără font monospace.
export const F: Record<string, TextStyle> = {
  display: { fontSize: 34, fontWeight: '700', letterSpacing: -1,   color: T.text },
  title:   { fontSize: 28, fontWeight: '700', letterSpacing: -0.7, color: T.text },
  heading: { fontSize: 17, fontWeight: '600', letterSpacing: -0.3, color: T.text },
  body:    { fontSize: 15, fontWeight: '400', color: T.text2 },
  label:   { fontSize: 13, fontWeight: '500', color: T.text2 },
  caption: { fontSize: 12, fontWeight: '500', color: T.text3 },
  kicker:  {
    fontSize: 12, fontWeight: '600', color: T.text3,
    letterSpacing: 1, textTransform: 'uppercase',
  },
  num: { fontVariant: ['tabular-nums'], fontWeight: '600', color: T.text },
};
