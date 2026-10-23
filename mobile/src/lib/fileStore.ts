/**
 * Larger things kept on the phone (the trip journal, its drafts) as JSON
 * files in the app's documents folder.
 *
 * lib/storage.ts (the phone's secure storage) is for small secrets like
 * the sign-in token: it's slow, and a value much over 2 KB can fail to
 * save without saying so, which lost trips' photos and captions once a
 * journal grew. Files have no such limit.
 *
 * Reads fall back to what secure storage held under the same key, so
 * journals saved before this move across the first time. Like
 * lib/storage, nothing here throws: a read returns null, a write fails
 * quietly.
 */

import { Directory, File, Paths } from 'expo-file-system';

import { getItem, removeItem } from './storage';

function fileFor(key: string): File {
  const folder = new Directory(Paths.document, 'data');
  folder.create({ idempotent: true, intermediates: true });
  // Keys are like "parkpath.trips.3": safe as file names once dots are kept.
  return new File(folder, `${key.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`);
}

export async function readText(key: string): Promise<string | null> {
  try {
    const file = fileFor(key);
    if (file.exists) return await file.text();
  } catch {
    // Fall through to the old place.
  }
  // Saved before files were used: take it from secure storage, and move it.
  const old = await getItem(key);
  if (old != null) {
    writeText(key, old);
    void removeItem(key);
  }
  return old;
}

export function writeText(key: string, value: string) {
  try {
    fileFor(key).write(value);
  } catch {
    // Nothing useful to do; the app works from memory until next time.
  }
}

export function removeText(key: string) {
  try {
    const file = fileFor(key);
    if (file.exists) file.delete();
  } catch {
    // Already gone.
  }
  void removeItem(key);
}
