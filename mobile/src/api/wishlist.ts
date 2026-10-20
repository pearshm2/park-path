/**
 * The signed-in user's wishlist, against api/app/routers/wishlist.py.
 *
 * Sites are addressed by park_code (Site.id in the app). Saving and
 * removing are idempotent on the server, so a retry or a double tap is
 * harmless.
 */

import { request } from './client';
import type { components } from './schema';

/** Generated from the API; see src/api/schema.ts. */
type WishlistItemOut = components['schemas']['WishlistItemOut'];

/** GET /wishlist — the saved park codes, newest first. */
export async function fetchWishlist(token: string): Promise<string[]> {
  const items = await request<WishlistItemOut[]>('/wishlist', { token });
  return items.map((item) => item.park_code);
}

/** PUT /wishlist/{code} — save a site. */
export async function saveToWishlist(token: string, siteId: string): Promise<void> {
  await request<WishlistItemOut>(`/wishlist/${encodeURIComponent(siteId)}`, {
    method: 'PUT',
    token,
  });
}

/** DELETE /wishlist/{code} — remove a site. */
export async function removeFromWishlist(token: string, siteId: string): Promise<void> {
  await request<null>(`/wishlist/${encodeURIComponent(siteId)}`, { method: 'DELETE', token });
}
