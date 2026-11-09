/**
 * Appearance: light, one of the dark palettes, or whichever matches the
 * phone. Read as the app starts, before any screen is drawn, so the first
 * frame is already in the right colours (theme/tokens.ts); changed while
 * the app runs through theme/live.ts.
 *
 * Kept in a small file (not secure storage) so it can be read straight
 * away, before anything else loads.
 */

import { Directory, File, Paths } from 'expo-file-system';
import { Appearance as SystemAppearance } from 'react-native';

/** The dark palettes to try out. */
export type DarkPalette = 'night' | 'campfire' | 'pine';

export type AppearanceMode = 'light' | 'dark' | 'system';

export type AppearanceChoice = { mode: AppearanceMode; dark: DarkPalette };

export const DARK_PALETTES: { id: DarkPalette; label: string; note: string }[] = [
  { id: 'night', label: 'Night sky', note: 'Deep navy' },
  { id: 'campfire', label: 'Campfire', note: 'Warm charcoal' },
  { id: 'pine', label: 'Pine', note: 'Dark forest green' },
];

const DEFAULT: AppearanceChoice = { mode: 'light', dark: 'night' };

function file(): File {
  const folder = new Directory(Paths.document, 'data');
  folder.create({ idempotent: true, intermediates: true });
  return new File(folder, 'parkpath.appearance.json');
}

/** The saved choice; light if nothing (or nothing readable) is saved. */
export function readAppearance(): AppearanceChoice {
  try {
    const f = file();
    if (!f.exists) return DEFAULT;
    const parsed = JSON.parse(f.textSync()) as Partial<AppearanceChoice>;
    const mode = (['light', 'dark', 'system'] as const).find((m) => m === parsed.mode) ?? DEFAULT.mode;
    const dark = DARK_PALETTES.find((p) => p.id === parsed.dark)?.id ?? DEFAULT.dark;
    return { mode, dark };
  } catch {
    return DEFAULT;
  }
}

/** Which palette to draw with: light, or the dark one chosen. */
export function activePalette(choice: AppearanceChoice): 'light' | DarkPalette {
  const dark =
    choice.mode === 'dark' || (choice.mode === 'system' && SystemAppearance.getColorScheme() === 'dark');
  return dark ? choice.dark : 'light';
}

/** Keep a new choice for next time. */
export function saveAppearance(choice: AppearanceChoice) {
  try {
    file().write(JSON.stringify(choice));
  } catch {
    // Kept for this session only.
  }
}
