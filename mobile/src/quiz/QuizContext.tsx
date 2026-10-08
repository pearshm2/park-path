/**
 * Holds the quiz answers and whether the quiz has been completed.
 *
 * There is no backend for this yet — api/app/main.py mounts only the
 * auth router — so answers live here and persist locally. When a /quiz
 * endpoint lands, `save` is the single place that needs to also POST.
 *
 * Answers are stored per account. Signing out leaves them on the device,
 * so signing back in restores them rather than forcing a retake; signing
 * in as a different account reads that account's own key, so answers
 * never leak between users sharing a device.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '../auth/AuthContext';
import { EMPTY_ANSWERS, type QuizAnswers } from '../data/quizSpec';
import { getItem, removeItem, setItem } from '../lib/storage';

/** One key per account — see the note above about shared devices. */
function answersKey(userId: string): string {
  return `parkpath.quizAnswers.${userId}`;
}

type QuizContextValue = {
  /** False while this account's stored answers are being read back. */
  ready: boolean;
  answers: QuizAnswers;
  /** True once this account has finished the quiz at least once. */
  completed: boolean;
  save: (answers: QuizAnswers) => Promise<void>;
  reset: () => Promise<void>;
};

const QuizContext = createContext<QuizContextValue | null>(null);

/** Stored JSON is untrusted input — a stale or hand-edited value should
 *  not crash the app, so anything unexpected falls back to no answers. */
function parseAnswers(raw: string | null): QuizAnswers | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<QuizAnswers>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      terrains: Array.isArray(parsed.terrains) ? parsed.terrains : [],
      season: parsed.season ?? '',
      effort: parsed.effort ?? null,
      needs: parsed.needs ?? '',
      days: parsed.days ?? null,
    };
  } catch {
    return null;
  }
}

/** What was read from storage, and which account it belongs to. */
type LoadedAnswers = {
  userId: string;
  answers: QuizAnswers;
  completed: boolean;
};

export function QuizProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const [loaded, setLoaded] = useState<LoadedAnswers | null>(null);

  // Everything below is derived rather than stored, so switching accounts
  // takes effect on the very next render: a stale `loaded` from the
  // previous account simply stops matching and is ignored. That also
  // keeps the effect free of synchronous setState, which would otherwise
  // cascade an extra render on every sign-in.
  const isCurrent = loaded !== null && loaded.userId === userId;
  const ready = userId === null || isCurrent;
  const answers = isCurrent ? loaded.answers : EMPTY_ANSWERS;
  const completed = isCurrent ? loaded.completed : false;

  // Re-reads whenever the account changes, which covers launch, sign-in,
  // and switching accounts without a reload. Signing out needs no read —
  // `ready` is already true and the derived answers are empty.
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    (async () => {
      const stored = parseAnswers(await getItem(answersKey(userId)));
      if (cancelled) return;
      setLoaded({
        userId,
        answers: stored ?? EMPTY_ANSWERS,
        completed: stored !== null,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const save = useCallback(
    async (next: QuizAnswers) => {
      // The quiz screen is behind an auth guard, so a missing account here
      // only happens if the session ends mid-answer; nothing to write.
      if (!userId) return;
      setLoaded({ userId, answers: next, completed: true });
      await setItem(answersKey(userId), JSON.stringify(next));
    },
    [userId],
  );

  const reset = useCallback(async () => {
    if (!userId) return;
    setLoaded({ userId, answers: EMPTY_ANSWERS, completed: false });
    await removeItem(answersKey(userId));
  }, [userId]);

  const value = useMemo<QuizContextValue>(
    () => ({ ready, answers, completed, save, reset }),
    [ready, answers, completed, save, reset],
  );

  return <QuizContext.Provider value={value}>{children}</QuizContext.Provider>;
}

export function useQuiz(): QuizContextValue {
  const value = useContext(QuizContext);
  if (!value) throw new Error('useQuiz must be used inside a <QuizProvider>');
  return value;
}
