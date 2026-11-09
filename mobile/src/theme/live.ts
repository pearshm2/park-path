/**
 * Changing the look while the app runs, with no restart: the new palette
 * goes into the colour tokens in place (theme/tokens.ts, applyPalette),
 * and every screen that reads `useThemeVersion()` draws itself again.
 * Styles pick the new colours up as they're drawn (their colour entries
 * are getters), so nothing else needs to know.
 *
 * "Match phone" follows the phone's own setting as it changes, too.
 */

import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';

import { activePalette, readAppearance, saveAppearance, type AppearanceChoice } from './appearance';
import { applyPalette, palette } from './tokens';

let choice: AppearanceChoice = readAppearance();
/** Bumped on every change of palette; screens key their content on it. */
let version = 0;
const listeners = new Set<() => void>();

function apply() {
  const next = activePalette(choice);
  if (next === palette) return;
  applyPalette(next);
  version += 1;
  listeners.forEach((listener) => listener());
}

/** The choice now in use. */
export function currentAppearance(): AppearanceChoice {
  return choice;
}

/** Change the look now, and keep it for next time. */
export function setAppearance(next: AppearanceChoice) {
  choice = next;
  saveAppearance(next);
  apply();
  // The choice itself changed (say, a different dark look while in light
  // mode): let the Settings row show it even when the colours didn't move.
  listeners.forEach((listener) => listener());
}

// "Match phone": follow the phone's light and dark as it switches.
Appearance.addChangeListener(() => {
  if (choice.mode === 'system') apply();
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * A number that changes whenever the palette does. Key a screen's content
 * on it to draw it afresh in the new colours (lists and memoised pieces
 * otherwise keep what they drew).
 */
export function useThemeVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}

/** The appearance choice, kept up to date (for the Settings row). */
export function useAppearanceChoice(): AppearanceChoice {
  return useSyncExternalStore(subscribe, () => choice);
}
