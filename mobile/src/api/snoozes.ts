/**
 * Parks set aside with "Not for now", against api/app/routers/snoozes.py.
 *
 * Sites are addressed by park_code (Site.id in the app). Setting aside and
 * bringing back are idempotent on the server, so a retry is harmless.
 */

import { request } from './client';
import type { components } from './schema';

/** Generated from the API; see src/api/schema.ts. */
type SnoozeOut = components['schemas']['SnoozeOut'];

/** Park id -> when it comes back (ms since epoch). */
export type Snoozes = Record<string, number>;

/** GET /snoozes — the parks set aside right now. */
export async function fetchSnoozes(token: string): Promise<Snoozes> {
  const items = await request<SnoozeOut[]>('/snoozes', { token });
  return Object.fromEntries(items.map((item) => [item.park_code, Date.parse(item.until)]));
}

/**
 * PUT /snoozes/{code} — set a park aside for 30 days, or until `until`
 * (a snooze carried over from this phone; the server caps it at 30 days).
 */
export async function snoozeSite(token: string, siteId: string, until?: number): Promise<void> {
  await request<SnoozeOut>(`/snoozes/${encodeURIComponent(siteId)}`, {
    method: 'PUT',
    token,
    body: until === undefined ? undefined : { until: new Date(until).toISOString() },
  });
}

/** DELETE /snoozes/{code} — bring a park back now. */
export async function unsnoozeSite(token: string, siteId: string): Promise<void> {
  await request<null>(`/snoozes/${encodeURIComponent(siteId)}`, { method: 'DELETE', token });
}
