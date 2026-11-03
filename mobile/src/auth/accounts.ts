/**
 * The accounts signed in on this phone, for the account switcher
 * (auth/AccountSwitcher.tsx): who each is, for the list, and its sign-in
 * token, so switching back is one tap. Like the current session's token
 * (api/tokenStorage.ts), tokens sit in the phone's secure storage, one
 * key each (secure storage dislikes large values); passwords are never
 * kept. A token lasts 24 hours, so an account not used for a day asks for
 * its password (or Google) again.
 */

import { getItem, removeItem, setItem } from '../lib/storage';
import type { User } from '../types/auth';

/** One remembered account, as the switcher lists it. */
export type SavedAccount = {
  id: number;
  email: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  /** Signed in with Google: signing in again goes through Google too. */
  google: boolean;
};

const LIST_KEY = 'parkpath.accounts';
const tokenKey = (id: number) => `parkpath.accountToken.${id}`;

/** Stored data is untrusted: anything that isn't an account is dropped. */
export async function listAccounts(): Promise<SavedAccount[]> {
  try {
    const parsed = JSON.parse((await getItem(LIST_KEY)) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is SavedAccount => !!a && typeof a.id === 'number' && typeof a.email === 'string',
    );
  } catch {
    return [];
  }
}

/** Add or refresh an account (most recent first), with its newest token. */
export async function rememberAccount(user: User, token: string, google: boolean): Promise<void> {
  const others = (await listAccounts()).filter((a) => a.id !== user.id);
  const previous = (await listAccounts()).find((a) => a.id === user.id);
  const account: SavedAccount = {
    id: user.id,
    email: user.email,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    // Once a Google account, always: the token alone doesn't say.
    google: google || (previous?.google ?? false),
  };
  await setItem(tokenKey(user.id), token);
  await setItem(LIST_KEY, JSON.stringify([account, ...others]));
}

/** Take an account off this phone: its token and its place in the list. */
export async function forgetAccount(id: number): Promise<void> {
  await removeItem(tokenKey(id));
  const rest = (await listAccounts()).filter((a) => a.id !== id);
  await setItem(LIST_KEY, JSON.stringify(rest));
}

export function savedToken(id: number): Promise<string | null> {
  return getItem(tokenKey(id));
}
