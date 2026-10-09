/**
 * Type primitives for the Caprasimo/Figtree pairing.
 *
 * The stylesheet's heading rules carry a 1.12 line height and -0.015em
 * tracking at every size; both are derived from the size here so a
 * heading never needs those numbers restated at the call site.
 */

import {
  StyleSheet,
  Text,
  type StyleProp,
  type TextProps,
  type TextStyle,
} from 'react-native';

import {
  BODY_LINE_HEIGHT_RATIO,
  bodySize,
  colors,
  fonts,
  HEADING_LETTER_SPACING_RATIO,
  HEADING_LINE_HEIGHT_RATIO,
  headingSize,
  scaleType,
  useTextScale,
} from '../theme';

type HeadingLevel = keyof typeof headingSize;

type HeadingProps = TextProps & {
  /** Maps to the stylesheet's h1–h6 sizes. */
  level?: HeadingLevel;
  /** Overrides the size from `level` — the prototype's screens use a few
   *  in-between sizes (26px tab titles, 30px quiz questions). */
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
};

export function Heading({
  level = 'h2',
  size,
  color = colors.text,
  style,
  children,
  ...rest
}: HeadingProps) {
  // Scaled by the in-app text size (Settings); the phone's own setting
  // is applied on top by React Native.
  const fontSize = (size ?? headingSize[level]) * useTextScale();

  return (
    <Text
      accessibilityRole="header"
      style={[
        {
          fontFamily: fonts.heading,
          fontSize,
          lineHeight: fontSize * HEADING_LINE_HEIGHT_RATIO,
          letterSpacing: fontSize * HEADING_LETTER_SPACING_RATIO,
          color,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

type BodyWeight = 'regular' | 'medium' | 'semibold' | 'bold';

const WEIGHT_FAMILY: Record<BodyWeight, string> = {
  regular: fonts.body,
  medium: fonts.bodyMedium,
  semibold: fonts.bodySemibold,
  bold: fonts.bodyBold,
};

type BodyTextProps = TextProps & {
  size?: number;
  weight?: BodyWeight;
  color?: string;
  /** Tighter leading for dense rows — meta lines, tags, captions. */
  lineHeightRatio?: number;
  style?: StyleProp<TextStyle>;
};

export function BodyText({
  size = bodySize,
  weight = 'regular',
  color = colors.text,
  lineHeightRatio = BODY_LINE_HEIGHT_RATIO,
  style,
  children,
  ...rest
}: BodyTextProps) {
  const fontSize = size * useTextScale();
  return (
    <Text
      style={[
        {
          fontFamily: WEIGHT_FAMILY[weight],
          fontSize,
          lineHeight: fontSize * lineHeightRatio,
          color,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

/**
 * The stylesheet's `h6`: 13px, uppercase, wide tracking. Used as a
 * section kicker above headings.
 */
export function Kicker({ style, children, ...rest }: TextProps & { style?: StyleProp<TextStyle> }) {
  const scale = useTextScale();
  return (
    <Text style={[styles.kicker, scaleType(styles.kicker, scale), style]} {...rest}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    letterSpacing: 11 * 0.14,
    textTransform: 'uppercase',
    color: colors.accentRamp[700],
  },
});
