/**
 * Signed-out group. A user who already has a session has no business
 * here, so the guard bounces them on — which also handles the case where
 * signing in succeeds while this screen is still mounted.
 */

import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../auth/AuthContext';
import { useQuiz } from '../../quiz/QuizContext';
import { colors } from '../../theme';

export default function AuthLayout() {
  const { status } = useAuth();
  const { completed } = useQuiz();

  if (status === 'signedIn') return <Redirect href={completed ? '/explore' : '/quiz'} />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
