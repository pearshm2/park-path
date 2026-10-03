/**
 * Holds the quiz answers and whether the quiz has been completed.
 *
 * There is no backend for this yet — api/app/main.py mounts only the
 * auth router — so answers live here and persist locally. When a /quiz
 * endpoint lands, `save` is the single place that needs to also POST.
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

import { EMPTY_ANSWERS, type QuizAnswers } from '../data/quizSpec';
import { getItem, removeItem, setItem } from '../lib/storage';

const ANSWERS_KEY = 'parkpath.quizAnswers';

type QuizContextValue = {
  /** False until the stored answers have been read back on launch. */
  ready: boolean;
  answers: QuizAnswers;
  /** True once the quiz has been finished at least once. */
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

export function QuizProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [answers, setAnswers] = useState<QuizAnswers>(EMPTY_ANSWERS);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = parseAnswers(await getItem(ANSWERS_KEY));
      if (cancelled) return;
      if (stored) {
        setAnswers(stored);
        setCompleted(true);
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (next: QuizAnswers) => {
    setAnswers(next);
    setCompleted(true);
    await setItem(ANSWERS_KEY, JSON.stringify(next));
  }, []);

  const reset = useCallback(async () => {
    setAnswers(EMPTY_ANSWERS);
    setCompleted(false);
    await removeItem(ANSWERS_KEY);
  }, []);

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
