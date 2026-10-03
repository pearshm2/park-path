/**
 * Sign-in / create-account form.
 *
 * The design prototype opens straight into the quiz and has no auth
 * screen, so this is built from the Organic design system rather than
 * translated from a mockup: flush-left heading in Caprasimo, soft
 * circular accents, pill fields on the sand surface, a solid terracotta
 * primary action.
 *
 * Both modes share everything but the heading, the endpoint and the
 * confirm-password field, so they share one component.
 */

import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, NetworkError } from '../api/client';
import { Button, BodyText, Heading, Kicker, TextField } from '../components';
import { colors, radius, shadow, space } from '../theme';
import { useAuth } from './AuthContext';

export type AuthMode = 'sign-in' | 'sign-up';

/**
 * Deliberately permissive: the real check is Pydantic's EmailStr on the
 * server. This only catches obvious typos before spending a round trip.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Applied on sign-up only. The API does not enforce a minimum
 * (api/app/schemas.py has a bare `password: str`), so this is a
 * client-side floor — and it must not apply when signing in, or anyone
 * with a shorter existing password would be locked out of their account.
 */
const MIN_PASSWORD_LENGTH = 8;

type FieldErrors = {
  email?: string;
  password?: string;
  confirm?: string;
};

const COPY: Record<AuthMode, { heading: string; sub: string; cta: string; switchTo: string }> = {
  'sign-in': {
    heading: 'Welcome back',
    sub: 'Sign in to pick up your trips, stamps and recommendations where you left off.',
    cta: 'Sign in',
    switchTo: 'Create an account',
  },
  'sign-up': {
    heading: 'Start your passport',
    sub: 'Answer five questions and we will point you at the park that actually fits your next trip.',
    cta: 'Create account',
    switchTo: 'I already have an account',
  },
};

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const copy = COPY[mode];
  const isSignUp = mode === 'sign-up';

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) errors.email = 'Enter your email address.';
    else if (!EMAIL_SHAPE.test(trimmedEmail)) errors.email = 'That does not look like an email address.';

    if (!password) errors.password = 'Enter your password.';
    else if (isSignUp && password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }

    if (isSignUp && confirm !== password) errors.confirm = 'Those passwords do not match.';

    return errors;
  }

  async function onSubmit() {
    if (submitting) return;

    setFormError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const credentials = { email: email.trim(), password };
      if (isSignUp) await signUp(credentials);
      else await signIn(credentials);
      // The root layout's groups react to the session change, so there is
      // nothing to navigate to here — (tabs) and quiz guard themselves.
    } catch (error) {
      setFormError(describeAuthError(error, mode));
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
        {/* Soft circular accents — the design system asks for round
            decoration, and they sit behind the content at low contrast. */}
        <View pointerEvents="none" style={styles.blobSage} />
        <View pointerEvents="none" style={styles.blobTerracotta} />

        <View style={styles.header}>
          <Kicker>ParkPath</Kicker>
          <Heading size={38} style={styles.heading}>
            {copy.heading}
          </Heading>
          <BodyText size={14} color={colors.neutral[700]} style={styles.sub}>
            {copy.sub}
          </BodyText>
        </View>

        <View style={styles.form}>
          <TextField
            label="Email"
            value={email}
            onChangeText={(next) => {
              setEmail(next);
              if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
            }}
            error={fieldErrors.email}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            editable={!submitting}
          />

          <TextField
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={(next) => {
              setPassword(next);
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            error={fieldErrors.password}
            placeholder={isSignUp ? `At least ${MIN_PASSWORD_LENGTH} characters` : 'Your password'}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            returnKeyType={isSignUp ? 'next' : 'go'}
            onSubmitEditing={() => (isSignUp ? confirmRef.current?.focus() : onSubmit())}
            editable={!submitting}
          />

          {isSignUp ? (
            <TextField
              ref={confirmRef}
              label="Confirm password"
              value={confirm}
              onChangeText={(next) => {
                setConfirm(next);
                if (fieldErrors.confirm) setFieldErrors((prev) => ({ ...prev, confirm: undefined }));
              }}
              error={fieldErrors.confirm}
              placeholder="Type it again"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
              editable={!submitting}
            />
          ) : null}

          {formError ? (
            <View style={styles.formError} accessibilityLiveRegion="polite">
              <BodyText size={13} weight="medium" color={colors.accentRamp[800]}>
                {formError}
              </BodyText>
            </View>
          ) : null}

          <Button
            label={copy.cta}
            onPress={onSubmit}
            loading={submitting}
            style={styles.submit}
          />
        </View>

        <View style={styles.footer}>
          <BodyText size={13} color={colors.neutral[700]}>
            {isSignUp ? 'Already have an account?' : 'New to ParkPath?'}
          </BodyText>
          <Button
            label={copy.switchTo}
            variant="ghost"
            onPress={() => router.replace(isSignUp ? '/sign-in' : '/sign-up')}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * Turns an API failure into something worth reading. The backend already
 * returns good copy for the cases that matter — a 401 from /auth/login is
 * deliberately vague about whether the email exists — so those come
 * through as-is.
 */
function describeAuthError(error: unknown, mode: AuthMode): string {
  if (error instanceof NetworkError) return error.message;

  if (error instanceof ApiError) {
    if (error.status === 409) {
      return 'An account with that email already exists. Try signing in instead.';
    }
    if (error.status === 401) return 'Incorrect email or password.';
    if (error.status === 422) return error.message;
    if (error.status >= 500) {
      return 'The ParkPath API had a problem handling that. Try again in a moment.';
    }
    return error.message;
  }

  return mode === 'sign-up'
    ? 'Could not create that account. Try again.'
    : 'Could not sign you in. Try again.';
}

const BLOB_SIZE = 230;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: space[6],
    gap: space[8],
    // Content hugs the left edge with air on the right, per the design
    // system's layout direction, but stays readable on a wide browser.
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  blobSage: {
    position: 'absolute',
    top: -BLOB_SIZE * 0.42,
    right: -BLOB_SIZE * 0.3,
    width: BLOB_SIZE,
    height: BLOB_SIZE,
    borderRadius: BLOB_SIZE / 2,
    backgroundColor: colors.accent2Ramp[200],
  },
  blobTerracotta: {
    position: 'absolute',
    top: BLOB_SIZE * 0.3,
    right: -BLOB_SIZE * 0.52,
    width: BLOB_SIZE * 0.72,
    height: BLOB_SIZE * 0.72,
    borderRadius: (BLOB_SIZE * 0.72) / 2,
    backgroundColor: colors.accentRamp[200],
  },
  header: {
    gap: space[1],
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
  formError: {
    padding: space[3],
    borderRadius: radius.md,
    backgroundColor: colors.accentRamp[100],
    borderWidth: 1,
    borderColor: colors.accentRamp[300],
  },
  submit: {
    marginTop: space[1],
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
