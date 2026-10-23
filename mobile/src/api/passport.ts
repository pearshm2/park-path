/**
 * Passports, against api/app/routers/passport.py: a friend's stamps,
 * regions and achievements, worked out from the trips they shared.
 */

import { request } from './client';
import type { components } from './schema';

/** Generated from the API; see src/api/schema.ts. */
export type PassportOut = components['schemas']['PassportOut'];

/** GET /passport/{user_id} — a friend's passport (404 unless you're friends). */
export function fetchFriendPassport(token: string, userId: number): Promise<PassportOut> {
  return request<PassportOut>(`/passport/${userId}`, { token });
}
