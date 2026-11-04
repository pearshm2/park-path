/**
 * Notices what's changed among your friends while the app is open, and
 * says so with a notification at the top (CelebrationBanner):
 *
 *  - someone sent you a friend request (by QR code, username or email);
 *  - someone accepted the request you sent them;
 *  - a new friend earned a friends achievement (First friend, Trail crew);
 *  - a friend commented on one of your trips (friends/activity.ts).
 *
 * The lists are checked every POLL_MS while the app is in front, and again
 * whenever it comes back to the front. What's already been seen is kept
 * per account, so reopening the app doesn't announce old requests again;
 * the first look on a phone just takes note of everything there is.
 *
 * Renders nothing.
 */

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { displayName } from '../api/friends';
import { useAuth } from '../auth/AuthContext';
import { useCelebrations, type NewNotice } from '../celebrations/CelebrationsContext';
import { friendAchievements } from '../data/achievements';
import { readText, writeText } from '../lib/fileStore';
import { firstLookCutoff, useActivity } from './activity';
import { useFriends } from './useFriends';

/** How often to look for new requests while the app is open. */
const POLL_MS = 20_000;

type Seen = { requests: number[]; friends: number[] };

export function FriendWatcher() {
  const { userId, status } = useAuth();
  const { friends, incoming, outgoing, refetch, loaded } = useFriends({ pollMs: POLL_MS });
  const { notify } = useCelebrations();
  const activity = useActivity({ pollMs: POLL_MS });
  // The newest comment announced, for this account.
  const announced = useRef<{ for: string; id: number | null } | null>(null);

  // What's been seen, for this account: loaded from the phone, then kept here.
  const seen = useRef<Seen | null>(null);
  const seenFor = useRef<string | null>(null);
  // Requests I sent, by the person they went to, so an acceptance can say so.
  const sentTo = useRef<Set<number>>(new Set());
  // Requests sent to me, so one I accepted myself isn't announced again.
  const askedBy = useRef<Set<number>>(new Set());

  // Look again as soon as the app comes back to the front.
  const refetchActivity = activity.refetch;
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active' && status === 'signedIn') {
        void refetch();
        void refetchActivity();
      }
    });
    return () => listener.remove();
  }, [refetch, refetchActivity, status]);

  // Friends' comments on your trips: each new one, said once.
  const comments = activity.items;
  const commentsLoaded = activity.loaded;
  useEffect(() => {
    if (status !== 'signedIn' || !userId || !commentsLoaded) return;
    let cancelled = false;
    const key = `parkpath.activityAnnounced.${userId}`;
    (async () => {
      if (announced.current?.for !== userId) {
        const saved = await readText(key).catch(() => null);
        if (cancelled) return;
        const id = saved ? Number(saved) : NaN;
        announced.current = { for: userId, id: Number.isFinite(id) ? id : null };
      }
      // A first look at this account on this phone: only the last day's.
      const before = announced.current.id ?? firstLookCutoff(comments);
      const newest = comments[0]?.id;
      if (newest === undefined || (before !== null && newest <= before)) return;
      if (before !== null) {
        // One comment says who and what; more than one, a single notice.
        const fresh = comments.filter((c) => c.id > before);
        const [only] = fresh;
        if (fresh.length === 1 && only) {
          notify([
            {
              kind: 'friend',
              title: `${displayName(only.author)} commented on your ${only.park_name} trip`,
              body: only.body.length > 90 ? `${only.body.slice(0, 89)}…` : only.body,
            },
          ]);
        } else if (fresh.length > 1) {
          notify([
            {
              kind: 'friend',
              title: `${fresh.length} new comments on your trips`,
              body: 'Tap to see them in Friends.',
            },
          ]);
        }
      }
      announced.current = { for: userId, id: newest };
      writeText(key, String(newest));
    })();
    return () => {
      cancelled = true;
    };
  }, [status, userId, commentsLoaded, comments, notify]);

  useEffect(() => {
    if (status !== 'signedIn' || !userId || !loaded) return;
    let cancelled = false;
    const key = `parkpath.friendsSeen.${userId}`;

    (async () => {
      if (seenFor.current !== userId) {
        const saved = await readText(key).catch(() => null);
        if (cancelled) return;
        seenFor.current = userId;
        try {
          seen.current = saved ? (JSON.parse(saved) as Seen) : null;
        } catch {
          seen.current = null;
        }
      }

      const before = seen.current;
      const notices: NewNotice[] = [];
      if (before) {
        const knownRequests = new Set(before.requests);
        const knownFriends = new Set(before.friends);
        for (const req of incoming) {
          if (knownRequests.has(req.id)) continue;
          notices.push({
            kind: 'friend',
            title: `${displayName(req.requester)} wants to be friends`,
            body: 'Tap to see the request in Friends.',
          });
        }
        const newFriends = friends.filter((f) => !knownFriends.has(f.user.id));
        for (const friend of newFriends) {
          // One I accepted myself needs no telling.
          if (askedBy.current.has(friend.user.id)) continue;
          notices.push({
            kind: 'friend',
            title: sentTo.current.has(friend.user.id)
              ? `${displayName(friend.user)} accepted your friend request`
              : `You and ${displayName(friend.user)} are now friends`,
            body: "Tap to see their trips in Friends.",
          });
        }
        // Friends achievements reached with these new friends.
        const countBefore = friends.length - newFriends.length;
        for (const tier of friendAchievements()) {
          if (tier.need > countBefore && tier.need <= friends.length) {
            notices.push({
              kind: 'achievement',
              title: `Achievement earned: ${tier.title}`,
              body: `${tier.body} Tap to see it in your Passport.`,
              need: tier.need,
            });
          }
        }
      }

      sentTo.current = new Set(outgoing.map((r) => r.addressee.id));
      askedBy.current = new Set(incoming.map((r) => r.requester.id));
      const now: Seen = {
        requests: [...new Set([...(before?.requests ?? []), ...incoming.map((r) => r.id)])].slice(-200),
        friends: friends.map((f) => f.user.id),
      };
      seen.current = now;
      writeText(key, JSON.stringify(now));
      if (notices.length > 0) notify(notices);
    })();

    return () => {
      cancelled = true;
    };
  }, [status, userId, loaded, friends, incoming, outgoing, notify]);

  return null;
}
