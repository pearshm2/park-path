/**
 * The account switcher (Settings: tap your name). Lists every
 * account signed in on this phone (auth/accounts.ts): tap one to switch to
 * it at once, or, when its sign-in has run out (after a day), sign in to
 * it again right here. "Add an account" signs in to another without
 * signing out of this one. Made for demos and testing friend features
 * with two accounts on one phone.
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardLift } from '../lib/useKeyboardLift';
import Svg, { Path } from 'react-native-svg';

import { displayName, handle, type Person } from '../api/friends';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { BodyText, Heading } from '../components/Typography';
import { colors, radius, shadow, space } from '../theme';
import { forgetAccount, listAccounts, type SavedAccount } from './accounts';
import { AccountExpired, useAuth } from './AuthContext';

/** A remembered account as a person, for its name and initials (no photo: that needs its own sign-in). */
function asPerson(account: SavedAccount): Person {
  return {
    id: account.id,
    email: account.email,
    username: account.username ?? undefined,
    first_name: account.first_name ?? undefined,
    last_name: account.last_name ?? undefined,
  } as Person;
}

export function AccountSwitcher({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardLift();
  const { user, switchAccount, signIn, signInWithGoogle } = useAuth();
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  /** The account being switched to, while it's checked. */
  const [busyId, setBusyId] = useState<number | null>(null);
  /** Signing in: to a remembered account that ran out, or a new one ("new"). */
  const [signingIn, setSigningIn] = useState<SavedAccount | 'new' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    void listAccounts().then(setAccounts);
  }, []);

  async function choose(account: SavedAccount) {
    if (account.id === user?.id || busyId !== null) return;
    setProblem(null);
    setBusyId(account.id);
    try {
      await switchAccount(account.id);
      onClose();
    } catch (error) {
      if (error instanceof AccountExpired) {
        // A day since it was used: sign in again, email filled in.
        setSigningIn(account);
        setEmail(account.email);
        setPassword('');
        setProblem(account.google ? null : 'That sign-in ran out. Enter the password to switch.');
      } else {
        setProblem("Couldn't reach ParkPath. Check your connection and try again.");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function forget(account: SavedAccount) {
    await forgetAccount(account.id);
    setAccounts((list) => list.filter((a) => a.id !== account.id));
  }

  async function submit() {
    if (!email.trim() || !password) {
      setProblem('Enter the email and password.');
      return;
    }
    setSending(true);
    setProblem(null);
    try {
      await signIn({ email: email.trim(), password });
      onClose();
    } catch (error) {
      setProblem(error instanceof Error && error.message ? error.message : "Couldn't sign in. Try again.");
    } finally {
      setSending(false);
    }
  }

  async function google() {
    setSending(true);
    setProblem(null);
    try {
      await signInWithGoogle();
      onClose();
    } catch (error) {
      setProblem(error instanceof Error && error.message ? error.message : "Couldn't sign in with Google.");
    } finally {
      setSending(false);
    }
  }

  const expiredGoogle = signingIn !== null && signingIn !== 'new' && signingIn.google;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {/* iOS moves the sheet up for the keyboard here; Android by `lift`. */}
      <KeyboardAvoidingView
        style={[styles.overlay, { paddingBottom: keyboard.lift }]}
        onLayout={keyboard.onLayout}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: (keyboard.lift > 0 ? 0 : insets.bottom) + space[4] }]}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Heading size={19} style={styles.grow}>
              Switch account
            </Heading>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
              <Svg width={16} height={16} viewBox="0 0 24 24">
                <Path d="M6 6l12 12M18 6L6 18" stroke={colors.neutral[800]} strokeWidth={2.6} strokeLinecap="round" />
              </Svg>
            </Pressable>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
            {accounts.map((account) => {
              const current = account.id === user?.id;
              const person = asPerson(account);
              return (
                <Pressable
                  key={account.id}
                  onPress={() => void choose(account)}
                  disabled={current}
                  accessibilityRole="button"
                  accessibilityLabel={current ? `${displayName(person)}, signed in` : `Switch to ${displayName(person)}`}
                  style={({ pressed }) => [styles.account, current && styles.accountCurrent, pressed && styles.pressed]}
                >
                  <Avatar person={person} size={40} />
                  <View style={styles.grow}>
                    <BodyText size={14} weight="semibold" numberOfLines={1}>
                      {displayName(person)}
                    </BodyText>
                    <BodyText size={12} color={colors.neutral[600]} numberOfLines={1}>
                      {handle(person) || account.email}
                    </BodyText>
                  </View>
                  {current ? (
                    <BodyText size={11.5} weight="bold" color={colors.accentRamp[700]}>
                      SIGNED IN
                    </BodyText>
                  ) : busyId === account.id ? (
                    <ActivityIndicator color={colors.accent} />
                  ) : (
                    <Pressable
                      onPress={() => void forget(account)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${displayName(person)} from this phone`}
                    >
                      <Svg width={12} height={12} viewBox="0 0 24 24">
                        <Path d="M6 6l12 12M18 6L6 18" stroke={colors.neutral[500]} strokeWidth={2.6} strokeLinecap="round" />
                      </Svg>
                    </Pressable>
                  )}
                </Pressable>
              );
            })}

            {signingIn === null ? (
              <Pressable
                onPress={() => {
                  setSigningIn('new');
                  setEmail('');
                  setPassword('');
                  setProblem(null);
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.account, pressed && styles.pressed]}
              >
                <View style={styles.plus}>
                  <BodyText size={20} weight="bold" color={colors.accentRamp[700]}>
                    +
                  </BodyText>
                </View>
                <BodyText size={14} weight="semibold" color={colors.accentRamp[800]}>
                  Add an account
                </BodyText>
              </Pressable>
            ) : (
              <View style={styles.form}>
                <BodyText size={12.5} weight="semibold" color={colors.neutral[700]}>
                  {signingIn === 'new' ? 'Sign in to another account' : `Sign in to ${displayName(asPerson(signingIn))} again`}
                </BodyText>
                {expiredGoogle ? null : (
                  <>
                    <TextField
                      label="Email"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      editable={signingIn === 'new'}
                    />
                    <TextField
                      label="Password"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      autoComplete="password"
                      onSubmitEditing={() => void submit()}
                      returnKeyType="go"
                    />
                    <Button label="Sign in" onPress={() => void submit()} loading={sending} />
                  </>
                )}
                {signingIn === 'new' || expiredGoogle ? (
                  <Button
                    label="Continue with Google"
                    variant="secondary"
                    onPress={() => void google()}
                    loading={sending && expiredGoogle}
                  />
                ) : null}
                <Button label="Cancel" variant="ghost" onPress={() => setSigningIn(null)} />
              </View>
            )}
            {problem ? (
              <BodyText size={12.5} color={colors.accentRamp[800]}>
                {problem}
              </BodyText>
            ) : null}
          </ScrollView>
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
    maxHeight: '85%',
    paddingHorizontal: space[4],
    paddingTop: space[2],
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    ...shadow.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[300],
    marginBottom: space[2],
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingBottom: space[2],
  },
  close: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[200],
  },
  grow: {
    flex: 1,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: space[2],
    paddingVertical: space[2],
  },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[2],
    borderRadius: radius.md,
  },
  accountCurrent: {
    backgroundColor: colors.accentRamp[100],
  },
  pressed: {
    opacity: 0.6,
  },
  plus: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accentRamp[400],
  },
  form: {
    gap: space[3],
    paddingTop: space[2],
  },
});
