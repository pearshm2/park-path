/**
 * The username field, for sign-up and Edit profile: says as you type
 * whether the name is free (see useUsernameCheck).
 */

import { forwardRef } from 'react';
import { StyleSheet, View, type TextInput, type TextInputProps } from 'react-native';

import { BodyText, TextField } from '../components';
import { colors } from '../theme';
import { normalizeUsername, type UsernameStatus } from './useUsernameCheck';

type Props = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  value: string;
  onChangeText: (text: string) => void;
  status: UsernameStatus;
  /** A problem found on save (outranks the live check). */
  error?: string;
};

export const UsernameField = forwardRef<TextInput, Props>(function UsernameField(
  { value, onChangeText, status, error, ...inputProps },
  ref,
) {
  const shown = normalizeUsername(value);
  const problem = error ?? (status.state === 'problem' ? status.message : undefined);
  return (
    <View>
      <TextField
        ref={ref}
        label="Username"
        value={value}
        // Usernames are lowercase; show them that way as they're typed.
        onChangeText={(text) => onChangeText(text.toLowerCase())}
        error={problem}
        placeholder="e.g. jane.doe"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        {...inputProps}
      />
      {!problem && (status.state === 'available' || status.state === 'checking') ? (
        <BodyText
          size={12}
          weight="semibold"
          color={status.state === 'available' ? colors.accent2Ramp[800] : colors.neutral[600]}
          style={styles.status}
          accessibilityLiveRegion="polite"
        >
          {status.state === 'available' ? `✓ @${shown} is available` : `Checking @${shown}…`}
        </BodyText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  status: {
    marginTop: 6,
    marginLeft: 4,
  },
});
