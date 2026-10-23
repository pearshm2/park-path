/**
 * Comments on trips, against api/app/routers/trips.py: anyone who can see
 * a trip (its owner, and their friends for a shared one) can read and add
 * them; a comment's author, or the trip's owner, can delete one.
 */

import { request } from './client';
import type { components } from './schema';

/** Generated from the API; see src/api/schema.ts. */
export type TripComment = components['schemas']['TripCommentOut'];

/** GET /trips/{id}/comments — oldest first. */
export function fetchComments(token: string, tripId: number): Promise<TripComment[]> {
  return request<TripComment[]>(`/trips/${tripId}/comments`, { token });
}

/** POST /trips/{id}/comments */
export function addComment(token: string, tripId: number, body: string): Promise<TripComment> {
  return request<TripComment>(`/trips/${tripId}/comments`, { method: 'POST', token, body: { body } });
}

/** DELETE /trips/{id}/comments/{commentId} */
export async function deleteComment(token: string, tripId: number, commentId: number): Promise<void> {
  await request<null>(`/trips/${tripId}/comments/${commentId}`, { method: 'DELETE', token });
}
