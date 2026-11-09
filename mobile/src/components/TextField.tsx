/**
 * The design system's `.field` + `.input` pair: a 12px label above a
 * pill-shaped input on the sand surface.
 *
 * The stylesheet styles focus with a 2px accent ring via :focus-visible.
 * React Native has no such selector, so focus is tracked in state and
 * drawn as an accent border — the same visual weight on a control that
 * is already fully rounded.
 */

import { forwardRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, fonts, MIN_TAP_TARGET, radius, scaleType, space, useTextScale } from '../theme';

type TextFieldProps = TextInputProps & {
  label: string;
  /** Shown under the field in the deep accent step, and ties into a11y. */
  error?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
  /** Keeps the label for screen readers but doesn't show it (the form labels the field itself). */
  hideLabel?: boolean;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, containerStyle, hideLabel = false, onFocus, onBlur, style, ...inputProps },
  ref,
) {
  const [focused, setFocused] = useState(false);

  const scale = useTextScale();
  return (
    <View style={containerStyle}>
      {hideLabel ? null : (
        <Text style={[styles.label, scaleType(styles.label, scale)]}>{label}</Text>
      )}
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        // Announces the message to a screen reader, not just sighted users.
        accessibilityHint={error ?? undefined}
        placeholderTextColor={colors.neutral[500]}
        selectionColor={colors.accent}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          scaleType(styles.input, scale),
          focused && styles.inputFocused,
          // An error outranks focus: the person needs to see what is wrong
          // even while the cursor is still in the field.
          error ? styles.inputError : null,
          style,
        ]}
        {...inputProps}
      />
      {error ? (
        // accent-700 rather than the base accent: the design system notes
        // the accent only clears 3:1 on this ground, so paragraph-size
        // text in it needs a deep ramp step.
        <Text style={[styles.error, scaleType(styles.error, scale)]}>{error}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.body,
    fontSize: 12,
    marginBottom: 5,
    get color() {
      return colors.textLabel;
    },
  },
  input: {
    minHeight: MIN_TAP_TARGET,
    paddingVertical: 6,
    paddingHorizontal: 14,
    fontFamily: fonts.body,
    fontSize: 14,
    get color() {
      return colors.text;
    },
    // Light cream with a clear edge: it reads as a place to type on the
    // sand page and on cards alike.
    get backgroundColor() {
      return colors.neutral[100];
    },
    borderWidth: 1,
    get borderColor() {
      return colors.neutral[300];
    },
    borderRadius: radius.pill,
  },
  inputFocused: {
    get borderColor() {
      return colors.accent;
    },
  },
  inputError: {
    get borderColor() {
      return colors.accentRamp[700];
    },
  },
  error: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 12 * 1.4,
    get color() {
      return colors.accentRamp[700];
    },
    marginTop: space[1],
    paddingHorizontal: 14,
  },
});
