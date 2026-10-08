/**
 * Password reset request screen.
 *
 * The form is real and validates, but the API route it calls does not
 * exist yet (see requestPasswordReset in src/api/auth.ts). Rather than
 * showing a fake "check your email" confirmation, the screen tells the
 * user plainly that the feature is not switched on. When the route ships,
 * delete the notice and the `pending` branch in onSubmit.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { requestPasswordReset } from '../../api/auth';
import { ApiError, NetworkError } from '../../api/client';
import { BodyText, Button, Heading, Kicker, TextField } from '../../components';
import { colors, radius, shadow, space } from '../../theme';

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    if (submitting) return;
    setResult(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setFieldError('Enter your email address.');
      return;
    }
    if (!EMAIL_SHAPE.test(trimmed)) {
      setFieldError('That does not look like an email address.');
      return;
    }
    setFieldError(null);

    setSubmitting(true);
    try {
      await requestPasswordReset(trimmed);
      // Deliberately does not confirm whether the address is registered.
      setResult('If that address has an account, reset instructions are on their way.');
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        // The route is not built yet — say so instead of implying an email was sent.
        setResult(
          'Password reset is not switched on yet. Ask the ParkPath team to reset your password for now.',
        );
      } else if (error instanceof NetworkError) {
        setResult(error.message);
      } else {
        setResult('Could not request a reset just now. Try again in a moment.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space[8], paddingBottom: insets.bottom + space[8] },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View pointerEvents="none" style={styles.blob} />

        <View>
          <Kicker>ParkPath</Kicker>
          <Heading size={34} style={styles.heading}>
            Reset your password
          </Heading>
          <BodyText size={14} color={colors.neutral[700]} style={styles.sub}>
            Enter the email you signed up with and we will send you a link to choose a new
            password.
          </BodyText>
        </View>

        <View style={styles.form}>
          <TextField
            label="Email"
            value={email}
            onChangeText={(next) => {
              setEmail(next);
              if (fieldError) setFieldError(null);
            }}
            error={fieldError}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
            editable={!submitting}
          />

          {result ? (
            <View style={styles.notice} accessibilityLiveRegion="polite">
              <BodyText size={13} weight="medium" color={colors.accentRamp[800]}>
                {result}
              </BodyText>
            </View>
          ) : null}

          <Button label="Send reset link" onPress={onSubmit} loading={submitting} />
        </View>

        <View style={styles.footer}>
          <BodyText size={13} color={colors.neutral[700]}>
            Remembered it?
          </BodyText>
          <Button label="Back to sign in" variant="ghost" onPress={() => router.replace('/sign-in')} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const BLOB_SIZE = 210;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: space[6],
    gap: space[8],
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  blob: {
    position: 'absolute',
    top: -BLOB_SIZE * 0.4,
    right: -BLOB_SIZE * 0.32,
    width: BLOB_SIZE,
    height: BLOB_SIZE,
    borderRadius: BLOB_SIZE / 2,
    backgroundColor: colors.accent2Ramp[200],
  },
  heading: {
    marginTop: space[2],
  },
  sub: {
    marginTop: space[2],
    maxWidth: 360,
  },
  form: {
    gap: space[4],
  },
  notice: {
    padding: space[3],
    borderRadius: radius.md,
    backgroundColor: colors.accentRamp[100],
    borderWidth: 1,
    borderColor: colors.accentRamp[300],
    ...shadow.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[1],
    marginTop: 'auto',
  },
});
