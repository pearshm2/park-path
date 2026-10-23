/**
 * Edit profile (from Settings): your first and last name and your
 * username, which is what friends see and find you by.
 */

import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import { UsernameField } from '../auth/UsernameField';
import { normalizeUsername, usernameRuleProblem, useUsernameCheck } from '../auth/useUsernameCheck';
import type { User } from '../types/auth';
import { colors, radius, shadow, space } from '../theme';
import { Button } from './Button';
import { TextField } from './TextField';
import { BodyText, Heading } from './Typography';

export function ProfileSheet({ user, onClose }: { user: User; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { updateProfile } = useAuth();
  const [firstName, setFirstName] = useState(user.first_name);
  const [lastName, setLastName] = useState(user.last_name);
  const [username, setUsername] = useState(user.username);
  const status = useUsernameCheck(username, user.username);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const handle = normalizeUsername(username);
    const problem =
      !firstName.trim()
        ? 'Enter your first name.'
        : !lastName.trim()
          ? 'Enter your last name.'
          : (usernameRuleProblem(handle) ?? (status.state === 'problem' ? status.message : null));
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        ...(handle !== user.username ? { username: handle } : {}),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { marginBottom: insets.bottom + 14 }]}>
          <Heading size={19}>Edit profile</Heading>
          <BodyText size={12.5} lineHeightRatio={1.45} color={colors.neutral[700]}>
            Friends see your name and @username. Your email stays private.
          </BodyText>
          <View style={styles.row}>
            <TextField
              label="First name"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              autoComplete="given-name"
              containerStyle={styles.grow}
            />
            <TextField
              label="Last name"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              autoComplete="family-name"
              containerStyle={styles.grow}
            />
          </View>
          <UsernameField value={username} onChangeText={setUsername} status={status} />
          {error ? (
            <BodyText size={12.5} weight="medium" color={colors.accentRamp[800]}>
              {error}
            </BodyText>
          ) : null}
          <View style={styles.row}>
            <Button label="Cancel" variant="secondary" onPress={onClose} />
            <Button label="Save" block onPress={save} loading={saving} style={styles.grow} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(32, 30, 29, 0.32)',
  },
  sheet: {
    gap: space[3],
    marginHorizontal: 14,
    padding: space[4],
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    ...shadow.lg,
  },
  row: {
    flexDirection: 'row',
    gap: space[2],
  },
  grow: {
    flex: 1,
  },
});
