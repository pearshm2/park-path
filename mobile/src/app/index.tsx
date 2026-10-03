/**
 * Entry route. Sends the user to whichever group they belong in; the
 * root layout has already waited for the session and quiz state to
 * settle, so this never has to render a loading state of its own.
 */

import { Redirect } from 'expo-router';

import { useAuth } from '../auth/AuthContext';
import { useQuiz } from '../quiz/QuizContext';

export default function Index() {
  const { status } = useAuth();
  const { completed } = useQuiz();

  if (status !== 'signedIn') return <Redirect href="/sign-in" />;
  return <Redirect href={completed ? '/explore' : '/quiz'} />;
}
