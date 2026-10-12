/**
 * The signed-in user's wishlist, and a toggle for the save button.
 *
 * The toggle updates the cached list straight away so the button and the
 * map respond on tap, then sends the change; if the request fails the
 * cache is put back and `error` says so. Either way the list is re-read
 * from the server afterwards so it can't drift.
 *
 * Cached per account, so switching accounts never shows the previous
 * person's saves.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { fetchWishlist, removeFromWishlist, saveToWishlist } from '../api/wishlist';
import { useAuth } from '../auth/AuthContext';

type Change = { siteId: string; save: boolean };

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
    onError: (_error, _change, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
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

  return { ids, toggle, error: mutation.error };
}
