/**
 * Parks set aside with "Not for now": left out of your recommendations for
 * SNOOZE_DAYS, then back. Not a dislike; nothing is marked against the
 * park for good.
 *
 * Kept on the device for now, per account (like the quiz answers), until
 * the backend has somewhere to keep them; when it does, this is the one
 * place that changes.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '../auth/AuthContext';
import { getItem, setItem } from '../lib/storage';

export const SNOOZE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Park id -> when it comes back (ms since epoch). */
type Snoozes = Record<string, number>;

function storageKey(userId: string): string {
  return `parkpath.snoozed.${userId}`;
}

/** Stored JSON is untrusted: anything unexpected reads as nothing set aside. */
function parse(raw: string | null): Snoozes {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, until]) => typeof until === 'number'),
    ) as Snoozes;
  } catch {
    return {};
  }
}

export function useSnoozed() {
  const { userId } = useAuth();
  const [loaded, setLoaded] = useState<{ userId: string; snoozes: Snoozes } | null>(null);
  const snoozes = useMemo(
    () => (loaded && loaded.userId === userId ? loaded.snoozes : {}),
    [loaded, userId],
  );

  // Read back this account's set-aside parks, dropping any that are due back.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const now = Date.now();
      const stored = parse(await getItem(storageKey(userId)));
      const current = Object.fromEntries(Object.entries(stored).filter(([, until]) => until > now));
      if (!cancelled) setLoaded({ userId, snoozes: current });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const write = useCallback(
    (next: Snoozes) => {
      if (!userId) return;
      setLoaded({ userId, snoozes: next });
      setItem(storageKey(userId), JSON.stringify(next)).catch(() => {});
    },
    [userId],
  );

  /** The ids set aside right now. */
  const ids = useMemo(() => new Set(Object.keys(snoozes)), [snoozes]);

  const snooze = useCallback(
    (siteId: string) => write({ ...snoozes, [siteId]: Date.now() + SNOOZE_DAYS * DAY_MS }),
    [snoozes, write],
  );

  const unsnooze = useCallback(
    (siteId: string) => {
      const { [siteId]: _removed, ...rest } = snoozes;
      write(rest);
    },
    [snoozes, write],
  );

  return { ids, snooze, unsnooze };
}
