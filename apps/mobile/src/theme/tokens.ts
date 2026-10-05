import type { BscPerspective, IndicatorType, Severity } from '@kpi/shared';

/** Design tokens. Spacing on a 4pt grid; touch targets ≥ 44pt. */
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;
export const touch = { min: 44 } as const;

export const type = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const, letterSpacing: -0.4 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.2 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.3 },
  mono: { fontSize: 14, lineHeight: 20, fontWeight: '500' as const },
};

export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  elevated: string;
  border: string;
  text: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  onPrimary: string;
  accent: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  success: string;
  successSoft: string;
  info: string;
  infoSoft: string;
  overlay: string;
  perspective: Record<BscPerspective, { fg: string; bg: string }>;
  indicator: Record<IndicatorType, { fg: string; bg: string }>;
  mapGrid: string;
}

export const light: Palette = {
  bg: '#F4F6FA',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F6',
  elevated: '#FFFFFF',
  border: '#DFE4EC',
  text: '#0E1726',
  textMuted: '#5B6678',
  textInverse: '#FFFFFF',
  primary: '#1C3F94',
  primaryPressed: '#15306F',
  primarySoft: '#E5ECFA',
  onPrimary: '#FFFFFF',
  accent: '#0E9F8E',
  danger: '#C2362F',
  dangerSoft: '#FCE9E8',
  warning: '#B26B00',
  warningSoft: '#FFF2DB',
  success: '#1F8A4C',
  successSoft: '#E3F5EA',
  info: '#2563EB',
  infoSoft: '#E6EEFE',
  overlay: 'rgba(8, 15, 30, 0.45)',
  perspective: {
    financial: { fg: '#1C3F94', bg: '#E5ECFA' },
    customer: { fg: '#0B7F72', bg: '#DFF5F1' },
    internal: { fg: '#9A5B00', bg: '#FFF0D6' },
    learning: { fg: '#6B3FB5', bg: '#EFE7FB' },
  },
  indicator: {
    leading: { fg: '#1F8A4C', bg: '#E3F5EA' },
    lagging: { fg: '#475569', bg: '#ECEFF4' },
  },
  mapGrid: '#E4E8F0',
};

export const dark: Palette = {
  bg: '#0A0F1A',
  surface: '#121A29',
  surfaceAlt: '#1A2436',
  elevated: '#1C2740',
  border: '#27334A',
  text: '#E8EDF6',
  textMuted: '#97A3B8',
  textInverse: '#0A0F1A',
  primary: '#7EA2FF',
  primaryPressed: '#5F87F0',
  primarySoft: '#1C2A4D',
  onPrimary: '#0A1430',
  accent: '#3CCFBC',
  danger: '#FF7A70',
  dangerSoft: '#3A1B1B',
  warning: '#FFB547',
  warningSoft: '#3A2A10',
  success: '#5BD38D',
  successSoft: '#123222',
  info: '#7EA2FF',
  infoSoft: '#1C2A4D',
  overlay: 'rgba(0, 0, 0, 0.6)',
  perspective: {
    financial: { fg: '#9DB8FF', bg: '#1C2A4D' },
    customer: { fg: '#5FE0CC', bg: '#0F3330' },
    internal: { fg: '#FFC267', bg: '#382810' },
    learning: { fg: '#C6A4FF', bg: '#2A1F45' },
  },
  indicator: {
    leading: { fg: '#5BD38D', bg: '#123222' },
    lagging: { fg: '#B3BFD1', bg: '#222D40' },
  },
  mapGrid: '#1A2436',
};

export const severityColors = (p: Palette, s: Severity = 'info') =>
  ({
    info: { fg: p.info, bg: p.infoSoft },
    warning: { fg: p.warning, bg: p.warningSoft },
    critical: { fg: p.danger, bg: p.dangerSoft },
    positive: { fg: p.success, bg: p.successSoft },
  })[s];
