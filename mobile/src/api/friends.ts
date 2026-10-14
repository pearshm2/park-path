/**
 * Friends, against api/app/routers/friends.py. Every call needs a token.
 *
 * Friendship is mutual and needs consent: a request by email, accepted by
 * the other person. Profiles are just an id and an email for now, so the
 * app makes a display name and initials from the email.
 */

import { request } from './client';

export type Person = { id: number; email: string };

export type Friend = { friendshipId: number; user: Person; since: string | null };

export type FriendRequest = {
  id: number;
  status: 'pending' | 'accepted';
  createdAt: string;
  requester: Person;
  addressee: Person;
};

type FriendshipOut = {
  id: number;
  status: 'pending' | 'accepted';
  created_at: string;
  accepted_at: string | null;
  requester: Person;
  addressee: Person;
};

function toRequest(raw: FriendshipOut): FriendRequest {
  return {
    id: raw.id,
    status: raw.status,
    createdAt: raw.created_at,
    requester: raw.requester,
    addressee: raw.addressee,
  };
}

/** GET /friends — newest friendship first. */
export async function fetchFriends(token: string): Promise<Friend[]> {
  const rows = await request<{ friendship_id: number; user: Person; since: string | null }[]>(
    '/friends',
    { token },
  );
  return rows.map((row) => ({ friendshipId: row.friendship_id, user: row.user, since: row.since }));
}

/** GET /friends/requests — pending requests to you, or from you. */
export async function fetchRequests(
  token: string,
  direction: 'incoming' | 'outgoing',
): Promise<FriendRequest[]> {
  const rows = await request<FriendshipOut[]>(`/friends/requests?direction=${direction}`, { token });
  return rows.map(toRequest);
}

/**
 * POST /friends/requests — ask someone by email. Comes back 'accepted' when
 * they had already asked you (that makes you friends straight away).
 * Fails with the API's own message: no such user, yourself, already
 * friends, already sent.
 */
export async function sendRequest(token: string, email: string): Promise<FriendRequest> {
  return toRequest(
    await request<FriendshipOut>('/friends/requests', { method: 'POST', token, body: { email } }),
  );
}

/** POST /friends/requests/{id}/accept */
export async function acceptRequest(token: string, id: number): Promise<void> {
  await request<FriendshipOut>(`/friends/requests/${id}/accept`, { method: 'POST', token });
}

/** DELETE /friends/requests/{id} — decline one to you, or cancel one you sent. */
export async function dismissRequest(token: string, id: number): Promise<void> {
  await request<null>(`/friends/requests/${id}`, { method: 'DELETE', token });
}

/** DELETE /friends/{user_id} */
export async function removeFriend(token: string, userId: number): Promise<void> {
  await request<null>(`/friends/${userId}`, { method: 'DELETE', token });
}

/** "jordan.reyes@example.com" -> "Jordan Reyes": the part before the @, tidied. */
export function displayName(email: string): string {
  const local = email.split('@')[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** "Jordan Reyes" -> "JR"; one name -> its first two letters. */
export function initials(email: string): string {
  const words = displayName(email).split(' ').filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] ?? '?').slice(0, 2).toUpperCase();
}
