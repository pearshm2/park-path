/**
 * The signed-in person's friends and pending requests, and the actions on
 * them. Every action refreshes all three lists afterwards, since accepting
 * a request (say) moves someone from one list to another.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  acceptRequest,
  dismissRequest,
  fetchFriends,
  fetchRequests,
  removeFriend,
  sendRequest, type FriendTarget } from '../api/friends';
import { useAuth } from '../auth/AuthContext';

export function useFriends() {
  const { token, userId } = useAuth();
  const queryClient = useQueryClient();
  const enabled = token !== null;

  const friends = useQuery({
    queryKey: ['friends', userId],
    queryFn: () => fetchFriends(token!),
    enabled,
  });
  const incoming = useQuery({
    queryKey: ['friendRequests', 'incoming', userId],
    queryFn: () => fetchRequests(token!, 'incoming'),
    enabled,
  });
  const outgoing = useQuery({
    queryKey: ['friendRequests', 'outgoing', userId],
    queryFn: () => fetchRequests(token!, 'outgoing'),
    enabled,
  });

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['friends', userId] }),
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] }),
    ]);

  const send = useMutation({
    mutationFn: (target: FriendTarget) => sendRequest(token!, target),
    onSuccess: refresh,
  });
  const accept = useMutation({
    mutationFn: (id: number) => acceptRequest(token!, id),
    onSettled: refresh,
  });
  const dismiss = useMutation({
    mutationFn: (id: number) => dismissRequest(token!, id),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: (friendUserId: number) => removeFriend(token!, friendUserId),
    onSettled: refresh,
  });

  return {
    friends: friends.data ?? [],
    incoming: incoming.data ?? [],
    outgoing: outgoing.data ?? [],
    loading: friends.isPending,
    error: friends.error ?? incoming.error ?? outgoing.error,
    send,
    accept,
    dismiss,
    remove,
  };
}
