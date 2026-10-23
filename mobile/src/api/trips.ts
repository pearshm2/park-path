/**
 * The trip journal, against api/app/routers/trips.py. Every call needs a
 * token.
 *
 * The server keeps a trip's park, date, title, notes, rating, trails, who
 * was there and who can see it, and its photos and videos with their
 * captions. Those go to S3 by a signed upload, not wired up here yet (the
 * server has no bucket), so for now they stay on the phone; see
 * trips/TripsContext.tsx.
 */

import { request } from './client';
import type { components } from './schema';

/** Generated from the API; see src/api/schema.ts. */
export type TripOut = components['schemas']['TripOut'];
export type Visibility = components['schemas']['Visibility'];

/** What the app sends to create or change a trip. */
export type TripFields = {
  park_code: string;
  visited_on: string;
  title: string;
  notes: string;
  rating: number | null;
  trails: string[];
  /**
   * The first trail, for a server from before `trails` (Render until this
   * backend is deployed); a newer one ignores it when `trails` is sent.
   */
  stamp: string | null;
  visibility: Visibility;
  companion_ids: number[];
};

/** GET /trips — my trips, newest visit first. */
export function fetchTrips(token: string): Promise<TripOut[]> {
  return request<TripOut[]>('/trips', { token });
}

/** POST /trips — log a visit. */
export function createTrip(token: string, fields: TripFields): Promise<TripOut> {
  return request<TripOut>('/trips', { method: 'POST', token, body: { ...fields, photo_keys: [] } });
}

/**
 * PATCH /trips/{id} — change a trip. The server can't move a trip to
 * another park, so the park isn't sent (moving one means deleting it and
 * creating it again); photos aren't sent, so the server's stay as they are.
 */
export function updateTrip(token: string, id: number, fields: TripFields): Promise<TripOut> {
  return request<TripOut>(`/trips/${id}`, {
    method: 'PATCH',
    token,
    body: {
      visited_on: fields.visited_on,
      title: fields.title,
      notes: fields.notes,
      rating: fields.rating,
      trails: fields.trails,
      stamp: fields.stamp,
      visibility: fields.visibility,
      companion_ids: fields.companion_ids,
    },
  });
}

/** DELETE /trips/{id}. */
export async function deleteTrip(token: string, id: number): Promise<void> {
  await request<null>(`/trips/${id}`, { method: 'DELETE', token });
}
