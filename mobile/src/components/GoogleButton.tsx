/**
 * "Continue with Google" button.
 *
 * Styled to sit inside the Organic system — pill shape, 44px tap target,
 * the same metrics as the primary action — while keeping the Google mark
 * unmodified and on a near-white surface, which Google's branding rules
 * require. neutral-100 is the lightest step in the palette, so the button
 * reads as the system's own without recolouring the logo.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, fonts, MIN_TAP_TARGET, radius, space } from '../theme';

/** The four-colour Google "G", unmodified, as the brand rules require. */
function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.58v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.01c-1.08.72-2.45 1.16-4.05 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.11A11.99 11.99 0 0 0 12 24z"
      />
      <Path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.61H1.29a12 12 0 0 0 0 10.78l3.98-3.11z"
      />
      <Path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.61l3.98 3.11C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </Svg>
  );
}

export function GoogleButton({
  label = 'Continue with Google',
  onPress,
  disabled = false,
}: {
  label?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <GoogleMark />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The "or" rule between the social button and the email form. The design
 * system prefers whitespace to rules, so this is kept hairline-light and
 * is the one place a divider earns its place — it separates two ways of
 * doing the same thing, which whitespace alone reads as ambiguous.
 */
export function OrDivider({ label = 'or' }: { label?: string }) {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerLabel}>{label}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    minHeight: MIN_TAP_TARGET,
    paddingVertical: space[2],
    paddingHorizontal: space[3] * 1.2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.neutral[100],
  },
  pressed: {
    backgroundColor: colors.neutral[200],
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    // Buttons in this system are set in the heading face at 14px.
    fontFamily: fonts.heading,
    fontSize: 14,
    lineHeight: 14 * 1.2,
    color: colors.text,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.divider,
  },
  dividerLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
});
