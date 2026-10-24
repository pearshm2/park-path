/**
 * Who sees a new trip unless you choose otherwise (Settings → Privacy):
 * only you, or your friends too. Kept on the phone; the New entry sheet
 * starts each blank entry with it.
 */

import { useSyncExternalStore } from 'react';

import type { Visibility } from '../api/trips';
import { getItem, setItem } from './storage';

const KEY = 'parkpath.defaultVisibility';

let current: Visibility = 'private';
const listeners = new Set<() => void>();

void getItem(KEY).then((saved) => {
  if (saved === 'friends' || saved === 'private') setDefaultVisibility(saved, false);
});

/** The default right now, for code outside React (a blank entry). */
export function defaultVisibility(): Visibility {
  return current;
}

export function setDefaultVisibility(value: Visibility, save = true) {
  current = value;
  if (save) void setItem(KEY, value);
  listeners.forEach((l) => l());
}

/** The default, and a way to change it (for Settings). */
export function useDefaultVisibility(): [Visibility, (value: Visibility) => void] {
  const value = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
  return [value, setDefaultVisibility];
}
