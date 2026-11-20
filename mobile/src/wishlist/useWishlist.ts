/**
 * The signed-in user's wishlist, and a toggle for the save button.
 *
 * The toggle updates the cached list straight away so the button and the
 * map respond on tap, then sends the change; if the request fails the
 * cache is put back, and `notice` holds a short message saying the save
 * didn't happen (shown with ToastOverlay) for a few seconds. Without it,
 * the heart just quietly emptied again and people thought it was saved.
 * Either way the list is re-read from the server afterwards so it can't
 * drift.
 *
 * Cached per account, so switching accounts never shows the previous
 * person's saves.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { NetworkError } from '../api/client';
import { fetchWishlist, removeFromWishlist, saveToWishlist } from '../api/wishlist';
import { useAuth } from '../auth/AuthContext';

type Change = { siteId: string; save: boolean };

/** How long the "didn't save" message stays up. */
const NOTICE_MS = 3200;

/** What to tell someone whose save (or unsave) just failed. */
function failureNotice(error: unknown, save: boolean): string {
  if (error instanceof NetworkError) {
    return save
      ? "You're offline, so that park wasn't saved. Try again with signal."
      : "You're offline, so that park is still saved. Try again with signal.";
  }
  return save ? "Couldn't save that park. Try again." : "Couldn't remove that park. Try again.";
}

export function useWishlist() {
  const { token, userId } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['wishlist', userId], [userId]);

  const { data: saved = [] } = useQuery({
    queryKey,
    queryFn: () => fetchWishlist(token!),
    enabled: token !== null,
  });
  const ids = useMemo(() => new Set(saved), [saved]);

  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  const mutation = useMutation({
    mutationFn: ({ siteId, save }: Change) =>
      save ? saveToWishlist(token!, siteId) : removeFromWishlist(token!, siteId),
    onMutate: async ({ siteId, save }: Change) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<string[]>(queryKey);
      queryClient.setQueryData<string[]>(queryKey, (current = []) => {
        const rest = current.filter((id) => id !== siteId);
        return save ? [siteId, ...rest] : rest;
      });
      return { previous };
    },
    onError: (error, { save }, context) => {
      // Undo the optimistic change, and say so.
      queryClient.setQueryData(queryKey, context?.previous);
      setNotice(failureNotice(error, save));
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const { mutate } = mutation;
  const toggle = useCallback(
    (siteId: string) => {
      if (token === null) return;
      mutate({ siteId, save: !ids.has(siteId) });
    },
    [token, ids, mutate],
  );

  return { ids, toggle, error: mutation.error, notice };
}
