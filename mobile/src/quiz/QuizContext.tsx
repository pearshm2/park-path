/**
 * Holds the quiz answers and whether the quiz has been completed.
 *
 * Answers are kept on the phone and on the server (GET/PUT /quiz). The
 * phone's copy is used straight away, so the app opens without waiting on
 * the network and works offline; the server's copy fills in a new phone or
 * a reinstall, and replaces the phone's when they differ (answers changed
 * on another phone). A save that couldn't reach the server is marked
 * pending and sent on the next launch, so it isn't overwritten by the
 * older copy there.
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

import { fetchQuiz, forgetQuiz, saveQuiz } from '../api/quiz';
import { useAuth } from '../auth/AuthContext';
import { EMPTY_ANSWERS, isComplete, type QuizAnswers } from '../data/quizSpec';
import { getItem, removeItem, setItem } from '../lib/storage';

/** One key per account — see the note above about shared devices. */
function answersKey(userId: string): string {
  return `parkpath.quizAnswers.${userId}`;
}

/** Set while this account's latest answers haven't reached the server. */
function pendingKey(userId: string): string {
  return `parkpath.quizPending.${userId}`;
}

/** How long a phone with no answers of its own waits on the server before
 *  showing the quiz (a sleeping Render server can take most of a minute). */
const FETCH_TIMEOUT_MS = 10_000;

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
 *  not crash the app, so anything unexpected falls back to no answers.
 *
 *  Answers saved by the earlier five-question quiz carry over what still
 *  applies (terrains, and the single season as a one-season ranking) but
 *  have no crowds answer, so they come back incomplete and the person is
 *  sent through the quiz again with those pre-filled. */
function parseAnswers(raw: string | null): QuizAnswers | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<QuizAnswers> & { season?: unknown };
    if (!parsed || typeof parsed !== 'object') return null;
    const legacySeason = typeof parsed.season === 'string' && parsed.season ? [parsed.season] : null;
    return {
      zip: typeof parsed.zip === 'string' ? parsed.zip : null,
      terrains: Array.isArray(parsed.terrains) ? parsed.terrains : [],
      seasons: (Array.isArray(parsed.seasons) ? parsed.seasons : legacySeason) as QuizAnswers['seasons'],
      crowds: parsed.crowds ?? null,
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
  const { token, userId } = useAuth();
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
    const timeout = new AbortController();

    function apply(found: QuizAnswers | null) {
      if (cancelled || !userId) return;
      setLoaded({
        userId,
        answers: found ?? EMPTY_ANSWERS,
        completed: found !== null && isComplete(found),
      });
    }

    (async () => {
      const stored = parseAnswers(await getItem(answersKey(userId)));
      if (stored) apply(stored);
      if (!token) {
        if (!stored) apply(null);
        return;
      }
      const timer = stored ? null : setTimeout(() => timeout.abort(), FETCH_TIMEOUT_MS);
      try {
        const local = stored && isComplete(stored) ? stored : null;
        if (local && (await getItem(pendingKey(userId))) !== null) {
          await saveQuiz(token, local);
          await removeItem(pendingKey(userId));
          return;
        }
        const remote = await fetchQuiz(token, timeout.signal);
        if (remote) {
          apply(remote);
          await setItem(answersKey(userId), JSON.stringify(remote));
        } else if (local) {
          // Taken before the server kept answers: give it this phone's.
          await saveQuiz(token, local);
        } else if (!stored) {
          apply(null);
        }
      } catch {
        // Offline or slow: go on with what this phone has.
        if (!stored) apply(null);
      } finally {
        if (timer) clearTimeout(timer);
      }
    })();

    return () => {
      cancelled = true;
      timeout.abort();
    };
  }, [userId, token]);

  const save = useCallback(
    async (next: QuizAnswers) => {
      // The quiz screen is behind an auth guard, so a missing account here
      // only happens if the session ends mid-answer; nothing to write.
      if (!userId) return;
      setLoaded({ userId, answers: next, completed: true });
      await setItem(answersKey(userId), JSON.stringify(next));
      if (!token) return;
      await setItem(pendingKey(userId), '1');
      try {
        await saveQuiz(token, next);
        await removeItem(pendingKey(userId));
      } catch {
        // Still pending: sent on the next launch (see the effect above).
      }
    },
    [userId, token],
  );

  const reset = useCallback(async () => {
    if (!userId) return;
    setLoaded({ userId, answers: EMPTY_ANSWERS, completed: false });
    await removeItem(answersKey(userId));
    await removeItem(pendingKey(userId));
    if (token) await forgetQuiz(token).catch(() => {});
  }, [userId, token]);

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
