/**
 * Activity: friends' comments on your trips (GET /trips/activity), newest
 * first. Shown at the top of Friends, counted on the Friends tab until you
 * open it, and announced by FriendWatcher as they arrive.
 *
 * What you've seen is the newest comment's id when you last opened
 * Friends, kept per account so the count survives closing the app. The
 * first look at an account on a phone counts only the last day's comments
 * as new (FIRST_LOOK_MS), so older ones don't all arrive at once.
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';

import { fetchActivity, type TripActivity } from '../api/trips';
import { useAuth } from '../auth/AuthContext';
import { readText, writeText } from '../lib/fileStore';

const NONE: TripActivity[] = [];

/** On a first look at an account, comments from this long ago count as new. */
const FIRST_LOOK_MS = 24 * 60 * 60 * 1000;

/**
 * Where "new" starts on a first look: the newest comment older than a
 * day (or just before the oldest, when all are recent). Null with none.
 */
export function firstLookCutoff(items: TripActivity[]): number | null {
  if (items.length === 0) return null;
  const since = Date.now() - FIRST_LOOK_MS;
  const older = items.find((item) => new Date(item.created_at).getTime() < since);
  return older ? older.id : items[items.length - 1].id - 1;
}

/** Friends' comments on my trips, kept fresh every `pollMs` if given. */
export function useActivity({ pollMs }: { pollMs?: number } = {}) {
  const { token, userId, status } = useAuth();
  const query = useQuery({
    queryKey: ['activity', userId],
    queryFn: () => fetchActivity(token!),
    enabled: status === 'signedIn' && !!token,
    refetchInterval: pollMs,
  });
  return { items: query.data ?? NONE, loaded: query.isSuccess, refetch: query.refetch };
}

/**
 * The newest comment seen in Friends, for one account (`id` null = nothing
 * saved yet), and what it was before Friends was last opened (`before`):
 * comments after that show as new there until it's opened again.
 */
type Seen = { for: string; id: number | null; before: number | null };

let seen: Seen | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setSeen(next: Seen) {
  seen = next;
  listeners.forEach((listener) => listener());
}

const keyFor = (userId: string) => `parkpath.activitySeen.${userId}`;

async function loadSeen(userId: string) {
  const saved = await readText(keyFor(userId)).catch(() => null);
  if (seen?.for === userId) return;
  const id = saved ? Number(saved) : NaN;
  const value = Number.isFinite(id) ? id : null;
  setSeen({ for: userId, id: value, before: value });
}

/** Everything up to comment `id` has been seen. */
export function markActivitySeen(userId: string, id: number) {
  if (seen?.for === userId && seen.id !== null && seen.id >= id) return;
  const previous = seen?.for === userId ? seen.id : null;
  setSeen({ for: userId, id, before: previous });
  writeText(keyFor(userId), String(id));
}

/**
 * The newest comment id seen, for this account: undefined while it's read
 * from the phone, null on a first look (nothing saved yet).
 */
export function useActivitySeen(): number | null | undefined {
  const { userId, status } = useAuth();
  const snapshot = useSyncExternalStore(subscribe, () => seen);
  const current = snapshot && snapshot.for === userId ? snapshot : null;
  useEffect(() => {
    if (status === 'signedIn' && userId && !current) void loadSeen(userId);
  }, [status, userId, current]);
  return current ? current.id : undefined;
}

/** Comments newer than this show as new in Friends; null = none do. */
export function useActivityNewSince(): number | null {
  const { userId } = useAuth();
  const snapshot = useSyncExternalStore(subscribe, () => seen);
  return snapshot && snapshot.for === userId ? snapshot.before : null;
}

/**
 * How many comments haven't been seen in Friends yet, for the tab. Opening
 * Friends (`friendsOpen`) sees them all; so does a first look on a phone.
 */
export function useActivityBadge(friendsOpen: boolean): number {
  const { userId } = useAuth();
  const { items, loaded } = useActivity();
  const seenId = useActivitySeen();
  const newest = items[0]?.id;

  useEffect(() => {
    if (!userId || !loaded || seenId === undefined || newest === undefined) return;
    if (friendsOpen) markActivitySeen(userId, newest);
    // A first look: the last day's comments start as new.
    else if (seenId === null) markActivitySeen(userId, firstLookCutoff(items) ?? newest);
  }, [userId, loaded, seenId, newest, friendsOpen, items]);

  if (!loaded || seenId === undefined || seenId === null) return 0;
  return items.filter((item) => item.id > seenId).length;
}
