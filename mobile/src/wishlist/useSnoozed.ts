/**
 * Parks set aside with "Not for now": left out of your recommendations for
 * SNOOZE_DAYS, then back. Not a dislike; nothing is marked against the
 * park for good.
 *
 * Kept on the server (GET/PUT/DELETE /snoozes), so they follow you to a new
 * phone. Like the wishlist, a change shows straight away and is put back if
 * the server turns it down. Snoozes this phone kept before the server could
 * are sent up once, then forgotten here.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { fetchSnoozes, snoozeSite, unsnoozeSite, type Snoozes } from '../api/snoozes';
import { useAuth } from '../auth/AuthContext';
import { getItem, removeItem } from '../lib/storage';

export const SNOOZE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const NONE: Snoozes = {};

/** Where this phone kept an account's snoozes before the server did. */
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

/** Send up this phone's own snoozes (still due back) that the server lacks. */
async function carryOver(token: string, userId: string, remote: Snoozes): Promise<Snoozes> {
  const raw = await getItem(storageKey(userId));
  if (raw === null) return remote;
  const now = Date.now();
  const local = Object.entries(parse(raw)).filter(([id, until]) => until > now && !(id in remote));
  // A park the server doesn't know (404) is dropped; nothing else to do.
  const sent = await Promise.all(
    local.map(([id, until]) =>
      snoozeSite(token, id, until).then(
        () => [id, until] as const,
        () => null,
      ),
    ),
  );
  await removeItem(storageKey(userId));
  return { ...remote, ...Object.fromEntries(sent.filter((entry) => entry !== null)) };
}

type Change = { siteId: string; until: number | null };

export function useSnoozed() {
  const { token, userId } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['snoozes', userId], [userId]);

  const { data: snoozes = NONE } = useQuery({
    queryKey,
    queryFn: async () => carryOver(token!, userId!, await fetchSnoozes(token!)),
    enabled: token !== null && userId !== null,
  });

  const mutation = useMutation({
    mutationFn: ({ siteId, until }: Change) =>
      until === null ? unsnoozeSite(token!, siteId) : snoozeSite(token!, siteId),
    onMutate: async ({ siteId, until }: Change) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Snoozes>(queryKey);
      queryClient.setQueryData<Snoozes>(queryKey, (current = NONE) => {
        const { [siteId]: _removed, ...rest } = current;
        return until === null ? rest : { ...rest, [siteId]: until };
      });
      return { previous };
    },
    onError: (_error, _change, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  /** The ids set aside right now. */
  const ids = useMemo(() => new Set(Object.keys(snoozes)), [snoozes]);

  const { mutate } = mutation;
  const snooze = useCallback(
    (siteId: string) => {
      if (token === null) return;
      mutate({ siteId, until: Date.now() + SNOOZE_DAYS * DAY_MS });
    },
    [token, mutate],
  );

  const unsnooze = useCallback(
    (siteId: string) => {
      if (token === null) return;
      mutate({ siteId, until: null });
    },
    [token, mutate],
  );

  return {
    ids,
    /** Each set-aside park's id and when it comes back (ms since epoch). */
    snoozes,
    snooze,
    unsnooze,
  };
}
