/**
 * Activity: friends' comments on your trips (GET /trips/activity), newest
 * first. Shown at the top of Friends, counted on the Friends tab until you
 * open it, and announced by FriendWatcher as they arrive.
 *
 * Each comment is also unread until you look at it: opening its trip's
 * comments (from Activity, or the count in Trips) reads all of that
 * trip's, and "Mark all as read" reads everything. Read comments older
 * than a week drop out of the strip in Friends; all stay in "See all".
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
 * The newest comment seen in Friends, for the tab's count (`id` null =
 * nothing saved yet; `before`, what it was before the last look).
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


// --- read and unread ----------------------------------------------------------

/**
 * Which comments have been read, for one account: everything up to
 * `upTo` (a first look, or "Mark all as read"), and each id in `ids` (a
 * trip's comments, opened). Null until it's loaded from the phone.
 */
type Read = { for: string; upTo: number | null; ids: Set<number>; saved: boolean };

let read: Read | null = null;
const readListeners = new Set<() => void>();

function subscribeRead(listener: () => void) {
  readListeners.add(listener);
  return () => readListeners.delete(listener);
}

function setRead(next: Read) {
  read = next;
  readListeners.forEach((listener) => listener());
  writeText(
    readKeyFor(next.for),
    JSON.stringify({ upTo: next.upTo, ids: [...next.ids].slice(-300) }),
  );
}

const readKeyFor = (userId: string) => `parkpath.activityRead.${userId}`;

async function loadRead(userId: string) {
  const saved = await readText(readKeyFor(userId)).catch(() => null);
  if (read?.for === userId) return;
  let upTo: number | null = null;
  let ids: number[] = [];
  try {
    const parsed = saved ? (JSON.parse(saved) as { upTo?: unknown; ids?: unknown }) : null;
    if (parsed && typeof parsed.upTo === 'number') upTo = parsed.upTo;
    if (parsed && Array.isArray(parsed.ids)) ids = parsed.ids.filter((id): id is number => typeof id === 'number');
  } catch {
    // Unreadable: start afresh.
  }
  read = { for: userId, upTo, ids: new Set(ids), saved: saved !== null };
  readListeners.forEach((listener) => listener());
}

/** Read these comments (a trip's, when its comments open). */
export function markRead(userId: string, ids: number[]) {
  if (!read || read.for !== userId) return;
  const unread = ids.filter((id) => !isReadIn(read!, id));
  if (unread.length === 0) return;
  setRead({ ...read, ids: new Set([...read.ids, ...unread]) });
}

/** Read everything up to the newest comment. */
export function markAllRead(userId: string, newest: number) {
  if (!read || read.for !== userId) return;
  setRead({ ...read, upTo: newest, ids: new Set() });
}

function isReadIn(state: Read, id: number): boolean {
  return (state.upTo !== null && id <= state.upTo) || state.ids.has(id);
}

/**
 * Whether a comment's been read, for this account; undefined while that's
 * loaded. A first look on a phone reads everything but the last day's.
 */
export function useRead(): ((item: TripActivity) => boolean) | undefined {
  const { userId, status } = useAuth();
  const { items, loaded } = useActivity();
  const snapshot = useSyncExternalStore(subscribeRead, () => read);
  const current = snapshot && snapshot.for === userId ? snapshot : null;

  useEffect(() => {
    if (status === 'signedIn' && userId && !current) void loadRead(userId);
  }, [status, userId, current]);

  // Nothing saved yet: the first look decides what counts as new.
  useEffect(() => {
    if (!userId || !current || current.saved || !loaded) return;
    setRead({ ...current, upTo: firstLookCutoff(items), saved: true });
  }, [userId, current, loaded, items]);

  if (!current || !current.saved) return undefined;
  return (item) => isReadIn(current, item.id);
}

/** Read comments older than this drop out of the strip in Friends. */
const KEEP_READ_MS = 7 * 24 * 60 * 60 * 1000;

/** At most this many in the strip; the rest are in "See all". */
export const STRIP_MAX = 3;

/** What the strip in Friends shows: unread first, then the week's read ones, newest first. */
export function stripItems(items: TripActivity[], isRead: (item: TripActivity) => boolean): TripActivity[] {
  const since = Date.now() - KEEP_READ_MS;
  const unread = items.filter((item) => !isRead(item));
  const recent = items.filter((item) => isRead(item) && new Date(item.created_at).getTime() >= since);
  return [...unread, ...recent].slice(0, STRIP_MAX);
}
