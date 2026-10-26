/**
 * The signed-in user's quiz answers, against api/app/routers/quiz.py.
 *
 * The phone keeps its own copy (quiz/QuizContext.tsx); the server's is so a
 * new phone or a reinstall doesn't ask for the quiz again.
 */

import type { QuizAnswers } from '../data/quizSpec';
import { request } from './client';
import type { components } from './schema';

/** Generated from the API; see src/api/schema.ts. */
type SavedQuiz = components['schemas']['SavedQuiz'];

/** GET /quiz — the saved answers, or null if they haven't taken it. */
export async function fetchQuiz(token: string, signal?: AbortSignal): Promise<QuizAnswers | null> {
  const saved = await request<SavedQuiz | null>('/quiz', { token, signal });
  return saved ? { ...saved, zip: saved.zip ?? null } : null;
}

/** PUT /quiz — save finished answers (see isComplete in data/quizSpec.ts). */
export async function saveQuiz(token: string, answers: QuizAnswers): Promise<void> {
  await request<SavedQuiz>('/quiz', { method: 'PUT', token, body: answers });
}

/** DELETE /quiz — forget them, so the quiz is asked again. */
export async function forgetQuiz(token: string): Promise<void> {
  await request<null>('/quiz', { method: 'DELETE', token });
}
