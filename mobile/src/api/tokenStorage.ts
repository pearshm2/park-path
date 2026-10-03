/**
 * Persistence for the access token, over the platform-split store in
 * src/lib/storage.ts (which documents the web/native trade-off).
 */

import { getItem, removeItem, setItem } from '../lib/storage';

const TOKEN_KEY = 'parkpath.accessToken';

export function saveToken(token: string): Promise<void> {
  return setItem(TOKEN_KEY, token);
}

export function loadToken(): Promise<string | null> {
  return getItem(TOKEN_KEY);
}

export function clearToken(): Promise<void> {
  return removeItem(TOKEN_KEY);
}
