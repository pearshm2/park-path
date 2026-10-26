/**
 * The number on the Friends tab: requests waiting for an answer, plus
 * friends made since you last opened Friends (someone accepting the request
 * you sent, say).
 *
 * Requests count until they're answered; new friends count until the
 * Friends tab is opened. Who's been seen there is kept per account, so the
 * number survives closing the app; the first time on a phone, everyone
 * already a friend counts as seen.
 *
 * The lists come from the same queries FriendWatcher keeps fresh, so the
 * number moves when its notifications do.
 */

import { useEffect, useSyncExternalStore } from 'react';

import { useAuth } from '../auth/AuthContext';
import { readText, writeText } from '../lib/fileStore';
import { useFriends } from './useFriends';

/** Friends seen in Friends, for one account; `ids` null = nothing saved yet. */
type Viewed = { for: string; ids: Set<number> | null };

let viewed: Viewed | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setViewed(next: Viewed) {
  viewed = next;
  listeners.forEach((listener) => listener());
}

const keyFor = (userId: string) => `parkpath.friendsViewed.${userId}`;

/** Loads what this account had seen, once per account. */
async function loadViewed(userId: string) {
  const saved = await readText(keyFor(userId));
  if (viewed?.for === userId) return;
  let ids: number[] | null = null;
  try {
    ids = saved ? (JSON.parse(saved) as number[]) : null;
  } catch {
    ids = null;
  }
  setViewed({ for: userId, ids: ids ? new Set(ids) : null });
}

/** Everyone in `ids` has now been seen, saved for next time. */
function markViewed(userId: string, ids: number[]) {
  const before = viewed?.for === userId ? viewed.ids : null;
  if (before && before.size === ids.length && ids.every((id) => before.has(id))) return;
  setViewed({ for: userId, ids: new Set(ids) });
  writeText(keyFor(userId), JSON.stringify(ids));
}

export function useFriendsBadge(friendsOpen: boolean): number {
  const { userId, status } = useAuth();
  const { friends, incoming, loaded } = useFriends();
  const snapshot = useSyncExternalStore(subscribe, () => viewed);
  const current = snapshot && snapshot.for === userId ? snapshot : null;

  useEffect(() => {
    if (status === 'signedIn' && userId && !current) void loadViewed(userId);
  }, [status, userId, current]);

  // Friends open (or a first look on this phone): everyone there now is seen.
  useEffect(() => {
    if (!loaded || !current || !userId) return;
    if (friendsOpen || !current.ids) markViewed(userId, friends.map((f) => f.user.id));
  }, [loaded, current, friendsOpen, friends, userId]);

  if (status !== 'signedIn' || !loaded) return 0;
  const seen = current?.ids;
  const unseen = seen ? friends.filter((f) => !seen.has(f.user.id)).length : 0;
  return incoming.length + unseen;
}
