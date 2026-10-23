/**
 * Friends, against api/app/routers/friends.py. Every call needs a token.
 *
 * Friendship is mutual and needs consent: a request by username (typed,
 * or scanned from their QR code) or email, accepted by the other person.
 * People are shown by their name and @username, never their email.
 */

import { request } from './client';
import type { components } from './schema';

/**
 * Someone, as the API describes them. The names are optional only because
 * trips saved on the phone before accounts had names hold just an id and
 * an email; the helpers below fall back to the email for those.
 */
export type Person = {
  id: number;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
};

export type Friend = { friendshipId: number; user: Person; since: string | null };

export type FriendRequest = {
  id: number;
  status: 'pending' | 'accepted';
  createdAt: string;
  requester: Person;
  addressee: Person;
};

/** Generated from the API; see src/api/schema.ts. */
type FriendshipOut = components['schemas']['FriendshipOut'];
type FriendOut = components['schemas']['FriendOut'];

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
  const rows = await request<FriendOut[]>(
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

/** Who to ask: by email, or by username. */
export type FriendTarget = { email: string } | { username: string };

/**
 * What someone typed into Invite: an email if it looks like one, else a
 * username (with or without its @).
 */
export function targetFrom(text: string): FriendTarget {
  const value = text.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? { email: value } : { username: value.replace(/^@/, '') };
}

/**
 * POST /friends/requests — ask someone by username or email. Comes back
 * 'accepted' when they had already asked you (that makes you friends
 * straight away). Fails with the API's own message: no such user,
 * yourself, already friends, already sent.
 */
export async function sendRequest(token: string, target: FriendTarget): Promise<FriendRequest> {
  return toRequest(
    await request<FriendshipOut>('/friends/requests', { method: 'POST', token, body: target }),
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

/** "Jordan Reyes": their first and last name. */
export function displayName(person: Person): string {
  const name = `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim();
  return name || nameFromEmail(person.email);
}

/** "Jordan": just their first name, for tight spots. */
export function firstName(person: Person): string {
  return person.first_name?.trim() || displayName(person).split(' ')[0];
}

/** "@jordan.reyes", or empty for a trip saved before usernames. */
export function handle(person: Person): string {
  return person.username ? `@${person.username}` : '';
}

/** "Jordan Reyes" -> "JR"; one name -> its first two letters. */
export function initials(person: Person): string {
  const words = displayName(person).split(' ').filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] ?? '?').slice(0, 2).toUpperCase();
}

/** "jordan.reyes@example.com" -> "Jordan Reyes": the part before the @, tidied. */
function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
