/**
 * "Organic" design tokens, ported from the design handoff bundle at
 * parkpath-recommendation-engine/project/_ds/organic-<id>, file
 * styles.css.
 *
 * That stylesheet is the source of truth for the look. Two things could
 * not come across verbatim:
 *
 *  - `color-mix(in srgb, X n%, transparent)` has no React Native
 *    equivalent, so every mix is resolved here to the literal rgba() it
 *    computes to. The percentage is kept in the constant's name so you
 *    can trace it back.
 *  - The OKLCH-derived 100–900 ramps are already baked to hex in the
 *    stylesheet, so those are copied across unchanged.
 *
 * Use these tokens rather than hard-coding values, exactly as the design
 * system's readme asks.
 */

import { Platform } from 'react-native';

import { activePalette, readAppearance, type DarkPalette } from './appearance';

/* Colour palettes ------------------------------------------------------- */

type Ramp = { 100: string; 200: string; 300: string; 400: string; 500: string; 600: string; 700: string; 800: string; 900: string };

/**
 * Every colour the app draws with, by role. Light is the design system's
 * own; the dark palettes (Settings → Display → Appearance) keep each
 * role but turn the ramps over: what was a pale background is now a deep
 * one, and what was dark ink is now light, so screens built for light
 * read the same way in the dark. The accents keep their hue.
 */
export type Palette = {
  bg: string;
  surface: string;
  text: string;
  accent: string;
  accent2: string;
  divider: string;
  /** 70% text — form field labels */
  textLabel: string;
  /** 55% text — .text-muted, figcaption */
  textMuted: string;
  /** 50% text — .card-meta */
  textFaint: string;
  /** text 7% — .btn-secondary:hover */
  tintText07: string;
  /** text 14% — .btn-secondary:active */
  tintText14: string;
  /** text 45% — .input:hover border */
  tintText45: string;
  /** accent 10% — .btn-ghost:hover */
  tintAccent10: string;
  /** accent 18% — .btn-ghost:active */
  tintAccent18: string;
  /** accent 30% — ::selection */
  tintAccent30: string;
  /**
   * The "glass" behind controls laid over photos (pills, round buttons),
   * at full strength; see `glass()` for it see-through. Light in light
   * mode, dark in dark.
   */
  glassRgb: string;
  /**
   * Light ink for things that stay dark or colourful in every palette:
   * text and icons on photos, on the orange accent, and in Relive. The
   * neutral ramp turns over in the dark palettes, so neutral[100] is no
   * longer light there.
   */
  onColor: string;
  neutral: Ramp;
  accentRamp: Ramp;
  accent2Ramp: Ramp;
};

/** A ramp turned over: 100 swaps with 900, 200 with 800, and so on. */
function flip(ramp: Ramp): Ramp {
  return {
    100: ramp[900], 200: ramp[800], 300: ramp[700], 400: ramp[600], 500: ramp[500],
    600: ramp[400], 700: ramp[300], 800: ramp[200], 900: ramp[100],
  }; // prettier-ignore
}

/** "r, g, b" of a hex colour. */
function rgbOf(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** rgba() of a hex colour at an opacity. */
function alpha(hex: string, a: number): string {
  return `rgba(${rgbOf(hex)}, ${a})`;
}

const ACCENT_RAMP: Ramp = {
  100: '#fff2eb', 200: '#ffe1d0', 300: '#ffc6a5', 400: '#f6a06b', 500: '#d67f48',
  600: '#b2622d', 700: '#8c491a', 800: '#643312', 900: '#402310',
}; // prettier-ignore
const ACCENT2_RAMP: Ramp = {
  100: '#f0fae1', 200: '#e1eecc', 300: '#ccdbb2', 400: '#aebf92', 500: '#8fa073',
  600: '#728157', 700: '#56633f', 800: '#3d472b', 900: '#272e1b',
}; // prettier-ignore

/** Shadow ink, from the stylesheet's shadow definitions. Dark in every palette. */
const SHADOW_INK = '#2e2b25';

const LIGHT: Palette = {
  bg: '#f5ead8',
  surface: '#ebddc5',
  text: '#201e1d',
  accent: '#c67139',
  accent2: '#7a8a5e',
  /** color-mix(in srgb, #201e1d 16%, transparent) */
  divider: 'rgba(32, 30, 29, 0.16)',
  textLabel: 'rgba(32, 30, 29, 0.7)',
  textMuted: 'rgba(32, 30, 29, 0.55)',
  textFaint: 'rgba(32, 30, 29, 0.5)',
  tintText07: 'rgba(32, 30, 29, 0.07)',
  tintText14: 'rgba(32, 30, 29, 0.14)',
  tintText45: 'rgba(32, 30, 29, 0.45)',
  tintAccent10: 'rgba(198, 113, 57, 0.1)',
  tintAccent18: 'rgba(198, 113, 57, 0.18)',
  tintAccent30: 'rgba(198, 113, 57, 0.3)',
  glassRgb: '249, 244, 237',
  onColor: '#f9f4ed',
  neutral: {
    100: '#f9f4ed', 200: '#eee7db', 300: '#dcd3c4', 400: '#c0b6a5', 500: '#a19786',
    600: '#82796a', 700: '#645c50', 800: '#474238', 900: '#2e2b25',
  }, // prettier-ignore
  accentRamp: ACCENT_RAMP,
  accent2Ramp: ACCENT2_RAMP,
};

/**
 * A dark palette from its background and neutral ramp (100 = cards, the
 * darkest raised surface; 900 = the lightest ink). The accent is a step
 * brighter than light mode's, to hold its own on a dark ground.
 */
function dark(bg: string, surface: string, neutral: Ramp): Palette {
  const text = neutral[900];
  const accent = '#d67f48';
  return {
    bg,
    surface,
    text,
    accent,
    accent2: '#8fa073',
    divider: alpha(text, 0.16),
    textLabel: alpha(text, 0.72),
    textMuted: alpha(text, 0.58),
    textFaint: alpha(text, 0.5),
    tintText07: alpha(text, 0.08),
    tintText14: alpha(text, 0.15),
    tintText45: alpha(text, 0.45),
    tintAccent10: alpha(accent, 0.14),
    tintAccent18: alpha(accent, 0.22),
    tintAccent30: alpha(accent, 0.34),
    glassRgb: rgbOf(neutral[100]),
    onColor: '#f9f4ed',
    neutral,
    accentRamp: flip(ACCENT_RAMP),
    accent2Ramp: flip(ACCENT2_RAMP),
  };
}

const PALETTES: Record<'light' | DarkPalette, Palette> = {
  light: LIGHT,
  // Deep navy, cool ink: a sky after dark.
  night: dark('#0e1320', '#161d2e', {
    100: '#182033', 200: '#212a40', 300: '#2d374f', 400: '#46506a', 500: '#69738e',
    600: '#8f98ae', 700: '#b5bccc', 800: '#d8dce6', 900: '#eef0f5',
  }), // prettier-ignore
  // Warm charcoal and cream: the light palette's own browns, in the dark.
  campfire: dark('#16120e', '#1f1a15', {
    100: '#221d18', 200: '#2c2620', 300: '#3a332b', 400: '#554c41', 500: '#7a7062',
    600: '#a0968a', 700: '#c2b9ab', 800: '#e0d8cc', 900: '#f6efe4',
  }), // prettier-ignore
  // Deep forest green with soft green-grey ink.
  pine: dark('#0d1510', '#141e18', {
    100: '#17211b', 200: '#202c25', 300: '#2b3a31', 400: '#44554a', 500: '#67786c',
    600: '#8e9e92', 700: '#b4c2b7', 800: '#d7e1da', 900: '#eef3ef',
  }), // prettier-ignore
};

/** The palette in use (theme/appearance.ts), read as the app starts. */
export let palette: 'light' | DarkPalette = activePalette(readAppearance());
/** Whether the app is drawn in one of the dark palettes. */
export let isDark = palette !== 'light';

/**
 * Every colour, by role, for the palette in use. One object for the whole
 * app, changed in place by `applyPalette` (so code holding `colors` or one
 * of its ramps always sees the current palette). Styles read it when
 * they're drawn: colour entries in StyleSheet.create are getters.
 */
export const colors: Palette = clone(PALETTES[palette]);

function clone(from: Palette): Palette {
  return {
    ...from,
    neutral: { ...from.neutral },
    accentRamp: { ...from.accentRamp },
    accent2Ramp: { ...from.accent2Ramp },
  };
}

/** Switch every colour to another palette, in place. Screens then redraw (theme/appearance.ts). */
export function applyPalette(next: 'light' | DarkPalette) {
  const from = PALETTES[next];
  const { neutral, accentRamp, accent2Ramp, ...roles } = from;
  Object.assign(colors, roles);
  Object.assign(colors.neutral, neutral);
  Object.assign(colors.accentRamp, accentRamp);
  Object.assign(colors.accent2Ramp, accent2Ramp);
  palette = next;
  isDark = next !== 'light';
}

/** The see-through "glass" behind controls on photos, at an opacity. */
export function glass(opacity: number): string {
  return `rgba(${colors.glassRgb}, ${opacity})`;
}

/* Spacing --------------------------------------------------------------- */

/**
 * The stylesheet's --space-* scale, which has a 1.10x density multiplier
 * already applied — hence the fractional values. React Native accepts
 * fractional dp, so they are kept exact rather than rounded.
 */
export const space = {
  1: 4.4,
  2: 8.8,
  3: 13.2,
  4: 17.6,
  6: 26.4,
  8: 35.2,
} as const;

/* Radii ----------------------------------------------------------------- */

export const radius = {
  sm: 8,
  md: 16,
  lg: 28,
  /**
   * The stylesheet's "rounded frame" layer overrides .card and .dialog to
   * radius-lg * 1.15, and sends every small control to a 999px pill.
   */
  card: 28 * 1.15,
  pill: 999,
} as const;

/* Typography ------------------------------------------------------------ */

/**
 * Font family names as registered with expo-font in src/theme/fonts.ts.
 * Caprasimo is the only display voice; Figtree carries everything else.
 */
export const fonts = {
  heading: 'Caprasimo_400Regular',
  body: 'Figtree_400Regular',
  bodyMedium: 'Figtree_500Medium',
  bodySemibold: 'Figtree_600SemiBold',
  bodyBold: 'Figtree_700Bold',
} as const;

/** Heading sizes from the stylesheet, with its 1.12 line-height ratio. */
export const headingSize = {
  h1: 42,
  h2: 32,
  h3: 25,
  h4: 20,
  h5: 16,
  h6: 13,
} as const;

export const HEADING_LINE_HEIGHT_RATIO = 1.12;
export const HEADING_LETTER_SPACING_RATIO = -0.015;

/** Body default: 15px / 1.55 from the stylesheet's `body` rule. */
export const bodySize = 15;
export const BODY_LINE_HEIGHT_RATIO = 1.55;

/* Elevation ------------------------------------------------------------- */

/**
 * The CSS shadows translated per platform.
 *
 * React Native Web deprecates the `shadow*` props in favour of
 * `boxShadow` and warns on every use, so web gets the CSS string
 * directly — which is also closer to the original stylesheet. Native
 * keeps `shadow*` for iOS and `elevation` for Android, since Android
 * honours nothing else.
 */
function elevation(offsetY: number, blur: number, opacity: number, androidElevation: number) {
  if (Platform.OS === 'web') {
    return { boxShadow: `0 ${offsetY}px ${blur}px rgba(46, 43, 37, ${opacity})` } as const;
  }
  return {
    shadowColor: SHADOW_INK,
    shadowOffset: { width: 0, height: offsetY },
    shadowOpacity: opacity,
    shadowRadius: blur,
    elevation: androidElevation,
  } as const;
}

export const shadow = {
  /** 0 1px 2px rgba(46,43,37,0.14) */
  sm: elevation(1, 2, 0.14, 1),
  /** 0 3px 10px rgba(46,43,37,0.16) */
  md: elevation(3, 10, 0.16, 4),
  /** 0 12px 32px rgba(46,43,37,0.22) */
  lg: elevation(12, 32, 0.22, 12),
} as const;

/**
 * Minimum tap target. The prototype's own stylesheet raises every
 * non-ghost button to 44px for touch, so that floor is kept here.
 */
export const MIN_TAP_TARGET = 44;
