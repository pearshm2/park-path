/**
 * The design system's `.btn` in its three variants.
 *
 * Two details worth not "fixing": the label is set in the *heading*
 * face (Caprasimo) at 14px, which is what the stylesheet specifies, and
 * every non-ghost button has a 44px floor so it stays a real tap target.
 */

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, fonts, MIN_TAP_TARGET, radius, space } from '../theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** Stretches to fill its container — the stylesheet's `.btn-block`. */
  block?: boolean;
  disabled?: boolean;
  /** Swaps the label for a spinner and blocks presses. */
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  block = false,
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const inert = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy: loading }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.base,
        variant === 'ghost' ? styles.ghost : styles.solid,
        variantStyles[variant],
        pressed && !inert && pressedStyles[variant],
        block && styles.block,
        inert && styles.inert,
        style,
      ]}
    >
      {loading ? (
        // Sized to the label's line box so swapping in the spinner does
        // not change the button's height.
        <View style={styles.spinner}>
          <ActivityIndicator
            size="small"
            color={variant === 'primary' ? colors.bg : colors.accent}
          />
        </View>
      ) : (
        <Text style={[styles.label, labelStyles[variant]]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  /** Prototype override: non-ghost buttons get the 44px touch floor. */
  solid: {
    minHeight: MIN_TAP_TARGET,
    paddingVertical: space[2],
    paddingHorizontal: space[3] * 1.2,
  },
  ghost: {
    paddingVertical: space[1],
    paddingHorizontal: space[1],
  },
  block: {
    alignSelf: 'stretch',
    flex: 1,
  },
  inert: {
    opacity: 0.45,
  },
  label: {
    fontFamily: fonts.heading,
    fontSize: 14,
    lineHeight: 14 * 1.2,
  },
  spinner: {
    height: 14 * 1.2,
    justifyContent: 'center',
  },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.accent },
  secondary: { borderColor: colors.divider },
  ghost: {},
});

const pressedStyles = StyleSheet.create({
  primary: { backgroundColor: colors.accentRamp[700] },
  secondary: { backgroundColor: colors.tintText14 },
  ghost: { backgroundColor: colors.tintAccent18 },
});

const labelStyles = StyleSheet.create({
  primary: { color: colors.bg },
  secondary: { color: colors.text },
  ghost: { color: colors.accent },
});
