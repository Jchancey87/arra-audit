// Arra PDF report theme tokens — mirrors client/src/styles/global.js (Bitwig dark studio).
// Font attribution:
//   Roboto Mono — Apache 2.0 (https://fonts.google.com/specimen/Roboto+Mono)
//   Barlow      — SIL OFL 1.1 (https://fonts.google.com/specimen/Barlow)
// Both shipped under client/public/fonts/ for deterministic offline rendering.

import { Font } from '@react-pdf/renderer';

export const FONT_FAMILY = {
  body: 'Barlow',
  bodyBold: 'BarlowBold',
  mono: 'RobotoMono',
  monoBold: 'RobotoMonoBold',
};

let fontsRegistered = false;

export function registerArraFonts() {
  if (fontsRegistered) return;
  Font.register({
    family: FONT_FAMILY.mono,
    fonts: [
      { src: '/fonts/RobotoMono-Regular.ttf', fontWeight: 'normal' },
      { src: '/fonts/RobotoMono-Bold.ttf', fontWeight: 'bold' },
    ],
  });
  Font.register({
    family: FONT_FAMILY.monoBold,
    src: '/fonts/RobotoMono-Bold.ttf',
    fontWeight: 'bold',
  });
  Font.register({
    family: FONT_FAMILY.body,
    fonts: [
      { src: '/fonts/Barlow-Regular.ttf', fontWeight: 'normal' },
      { src: '/fonts/Barlow-SemiBold.ttf', fontWeight: 600 },
      { src: '/fonts/Barlow-Bold.ttf', fontWeight: 'bold' },
    ],
  });
  Font.register({
    family: FONT_FAMILY.bodyBold,
    src: '/fonts/Barlow-Bold.ttf',
    fontWeight: 'bold',
  });
  // Disable unicode-range subsetting; we ship full TTF.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

export const COLORS = {
  surface0: '#111114',
  surface1: '#18181c',
  surface2: '#202024',
  surface3: '#28282e',
  border: '#2a2a30',
  text: '#f2f2f2',
  textMuted: '#9ca0a6',
  textDim: '#5a5d65',
  accent: '#ff6a00',
  accentHover: '#ff8a33',
  cyan: '#00e5ff',
  gold: '#ffd700',
  success: '#35d777',
  error: '#ff5252',
  warning: '#d8a737',
};

// Brandable theme tokens. Defaults match the Bitwig dark studio palette.
// Pass an overrides object to applyBranding to produce a per-tenant theme
// without forking the module-level constants.
const DEFAULT_BRAND = {
  colors: { ...COLORS },
  fonts: { ...FONT_FAMILY },
  footerLabel: 'arra.homma.casa',
  reportKicker: 'Arra · Audit Report',
};

let activeBrand = { ...DEFAULT_BRAND };

function isHex(s) {
  return typeof s === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s);
}

function mergeColors(overrides) {
  if (!overrides || typeof overrides !== 'object') return DEFAULT_BRAND.colors;
  const out = { ...DEFAULT_BRAND.colors };
  for (const [k, v] of Object.entries(overrides)) {
    if (isHex(v) && k in out) out[k] = v;
  }
  return out;
}

function mergeFonts(overrides) {
  if (!overrides || typeof overrides !== 'object') return DEFAULT_BRAND.fonts;
  const out = { ...DEFAULT_BRAND.fonts };
  for (const [k, v] of Object.entries(overrides)) {
    if (typeof v === 'string' && v.length && v.length < 64 && k in out) {
      out[k] = v;
    }
  }
  return out;
}

/**
 * applyBranding(overrides) — shallowly merge brand overrides into the
 * currently active theme. Intended for white-label / per-org PDF variants.
 * Pass null/undefined to reset to the Arra defaults.
 *
 * Recognized keys:
 *   - colors:  { accent, accentHover, surface0..3, border, text, textMuted, textDim,
 *                 cyan, gold, success, error, warning } (all values must be hex)
 *   - fonts:   { body, bodyBold, mono, monoBold } (family names)
 *   - footerLabel: string used in the cover/page footer
 *   - reportKicker: string used in the cover kicker
 *
 * Returns the merged brand object.
 */
export function applyBranding(overrides) {
  if (!overrides) {
    activeBrand = { ...DEFAULT_BRAND, colors: { ...DEFAULT_BRAND.colors }, fonts: { ...DEFAULT_BRAND.fonts } };
    Object.assign(COLORS, activeBrand.colors);
    Object.assign(FONT_FAMILY, activeBrand.fonts);
    return activeBrand;
  }
  const colors = mergeColors(overrides.colors);
  const fonts = mergeFonts(overrides.fonts);
  const footerLabel = typeof overrides.footerLabel === 'string' && overrides.footerLabel.length
    ? overrides.footerLabel.slice(0, 64)
    : DEFAULT_BRAND.footerLabel;
  const reportKicker = typeof overrides.reportKicker === 'string' && overrides.reportKicker.length
    ? overrides.reportKicker.slice(0, 64)
    : DEFAULT_BRAND.reportKicker;
  activeBrand = { colors, fonts, footerLabel, reportKicker };
  Object.assign(COLORS, colors);
  Object.assign(FONT_FAMILY, fonts);
  return activeBrand;
}

export function getActiveBrand() {
  return { ...activeBrand, colors: { ...activeBrand.colors }, fonts: { ...activeBrand.fonts } };
}

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const RADII = {
  sm: 2,
  md: 4,
  lg: 6,
};

export const PAGE = {
  size: 'A4',
  paddingTop: 36,
  paddingBottom: 48,
  paddingHorizontal: 40,
  contentWidth: 515, // A4 (595) - 2*40 padding
};

export const TYPE = {
  display: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 32, lineHeight: 1.1 },
  h1: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 22, lineHeight: 1.2 },
  h2: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 15, lineHeight: 1.3 },
  h3: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 12, lineHeight: 1.3 },
  body: { fontFamily: FONT_FAMILY.body, fontSize: 10.5, lineHeight: 1.45 },
  bodySmall: { fontFamily: FONT_FAMILY.body, fontSize: 9, lineHeight: 1.4 },
  mono: { fontFamily: FONT_FAMILY.mono, fontSize: 9.5, lineHeight: 1.4 },
  monoSmall: { fontFamily: FONT_FAMILY.mono, fontSize: 8, lineHeight: 1.3 },
  caption: { fontFamily: FONT_FAMILY.body, fontSize: 8, lineHeight: 1.3, color: COLORS.textDim },
};

export const LENS_LABELS = {
  rhythm: 'Rhythm',
  texture: 'Texture',
  harmony: 'Harmony',
  arrangement: 'Arrangement',
};

export const LENS_DESCRIPTIONS = {
  rhythm: 'Pulse, groove, timing feel, micro-timing, subdivision and swing.',
  texture: 'Timbre, layering, density, articulation, frequency balance and spatial width.',
  harmony: 'Chord movement, voice leading, modal colour, extensions and substitutions.',
  arrangement: 'Form, structure, section transitions, dynamics, instrumentation and energy arc.',
};
