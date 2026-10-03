/**
 * "Organic" design tokens, ported from the Claude Design handoff bundle
 * at parkpath-recommendation-engine/project/_ds/organic-<id>, file
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

/* Base roles ------------------------------------------------------------ */

const BG = '#f5ead8';
const SURFACE = '#ebddc5';
const TEXT = '#201e1d';
const ACCENT = '#c67139';
const ACCENT_2 = '#7a8a5e';

/** Ink used for elevation, from the stylesheet's shadow definitions. */
const SHADOW_INK = '#2e2b25';

export const colors = {
  bg: BG,
  surface: SURFACE,
  text: TEXT,
  accent: ACCENT,
  accent2: ACCENT_2,

  /** color-mix(in srgb, #201e1d 16%, transparent) */
  divider: 'rgba(32, 30, 29, 0.16)',

  /* Text at reduced opacity — the stylesheet's .text-muted and friends. */
  /** 70% — form field labels */
  textLabel: 'rgba(32, 30, 29, 0.7)',
  /** 55% — .text-muted, figcaption */
  textMuted: 'rgba(32, 30, 29, 0.55)',
  /** 50% — .card-meta */
  textFaint: 'rgba(32, 30, 29, 0.5)',

  /* Interaction tints, from the component layer's :hover / :active rules. */
  /** color-mix(text 7%) — .btn-secondary:hover */
  tintText07: 'rgba(32, 30, 29, 0.07)',
  /** color-mix(text 14%) — .btn-secondary:active */
  tintText14: 'rgba(32, 30, 29, 0.14)',
  /** color-mix(text 45%) — .input:hover border */
  tintText45: 'rgba(32, 30, 29, 0.45)',
  /** color-mix(accent 10%) — .btn-ghost:hover */
  tintAccent10: 'rgba(198, 113, 57, 0.1)',
  /** color-mix(accent 18%) — .btn-ghost:active */
  tintAccent18: 'rgba(198, 113, 57, 0.18)',
  /** color-mix(accent 30%) — ::selection */
  tintAccent30: 'rgba(198, 113, 57, 0.3)',

  neutral: {
    100: '#f9f4ed',
    200: '#eee7db',
    300: '#dcd3c4',
    400: '#c0b6a5',
    500: '#a19786',
    600: '#82796a',
    700: '#645c50',
    800: '#474238',
    900: '#2e2b25',
  },

  accentRamp: {
    100: '#fff2eb',
    200: '#ffe1d0',
    300: '#ffc6a5',
    400: '#f6a06b',
    500: '#d67f48',
    600: '#b2622d',
    700: '#8c491a',
    800: '#643312',
    900: '#402310',
  },

  accent2Ramp: {
    100: '#f0fae1',
    200: '#e1eecc',
    300: '#ccdbb2',
    400: '#aebf92',
    500: '#8fa073',
    600: '#728157',
    700: '#56633f',
    800: '#3d472b',
    900: '#272e1b',
  },
} as const;

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
