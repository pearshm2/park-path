/**
 * Shown once, right after Google sign-in makes a new account: Google gave
 * us a name but no username, so the server made one from the email. This
 * shows them both and lets them change either before carrying on, so the
 * account ends up like any other.
 */

import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { BodyText, Heading } from '../components/Typography';
import { colors, radius, shadow, space } from '../theme';
import type { User } from '../types/auth';
import { useAuth } from './AuthContext';
import { UsernameField } from './UsernameField';
import { normalizeUsername, usernameRuleProblem, useUsernameCheck } from './useUsernameCheck';

export function UsernamePrompt() {
  const { user, welcomeGoogleAccount } = useAuth();
  if (!welcomeGoogleAccount || !user) return null;
  // Keyed by account, so its fields start from that account's values.
  return <Prompt key={user.id} user={user} />;
}

function Prompt({ user }: { user: User }) {
  const insets = useSafeAreaInsets();
  const { updateProfile, dismissGoogleWelcome } = useAuth();
  const [first, setFirst] = useState(user.first_name);
  const [last, setLast] = useState(user.last_name);
  const [username, setUsername] = useState(user.username);
  const status = useUsernameCheck(username, user.username);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const handle = normalizeUsername(username);
    const problem = !first.trim()
      ? 'Enter your first name.'
      : !last.trim()
        ? 'Enter your last name.'
        : (usernameRuleProblem(handle) ?? (status.state === 'problem' ? status.message : null));
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        first_name: first.trim(),
        last_name: last.trim(),
        ...(handle !== user.username ? { username: handle } : {}),
      });
      dismissGoogleWelcome();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { marginBottom: insets.bottom + 14 }]}>
          <Heading size={21} style={styles.title}>
            Welcome to ParkPath
          </Heading>
          <BodyText size={13} lineHeightRatio={1.45} color={colors.neutral[700]}>
            Here&apos;s how friends will see you. Change anything you like; you can also do it later
            in Settings.
          </BodyText>
          <View style={styles.row}>
            <TextField label="First name" value={first} onChangeText={setFirst} autoCapitalize="words" containerStyle={styles.grow} />
            <TextField label="Last name" value={last} onChangeText={setLast} autoCapitalize="words" containerStyle={styles.grow} />
          </View>
          <UsernameField value={username} onChangeText={setUsername} status={status} />
          {error ? (
            <BodyText size={12.5} weight="medium" color={colors.accentRamp[800]}>
              {error}
            </BodyText>
          ) : null}
          <Button label="Looks good" block onPress={() => void save()} loading={saving} />
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
  title: {
    letterSpacing: 0,
  },
  row: {
    flexDirection: 'row',
    gap: space[2],
  },
  grow: {
    flex: 1,
  },
});
