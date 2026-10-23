/**
 * Sound effects, with a tap of haptics to go with them: the wax seal's
 * thud as it's pressed, a soft whoosh diving into a memory, and a chime
 * for a notification of something earned.
 *
 * The sounds (assets/sounds) are synthesized for ParkPath, so there are no
 * licences to track; swap in other WAVs of the same names to change them.
 *
 * They follow the phone: silent when it's on silent (iOS's switch), and
 * at its volume. Settings can turn them off ("Sound effects"), which also
 * turns off the haptics; the choice is kept on the phone.
 */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useSyncExternalStore } from 'react';

import { getItem, setItem } from './storage';

const SOUNDS = {
  stamp: require('../../assets/sounds/stamp.wav'),
  whoosh: require('../../assets/sounds/whoosh.wav'),
  chime: require('../../assets/sounds/chime.wav'),
} as const;

export type SoundName = keyof typeof SOUNDS;

const KEY = 'parkpath.soundEffects';

/**
 * Sounds on hold, to be reworked later: they don't play. The chime for
 * notifications and the haptics carry on. Empty this to bring them back.
 */
const ON_HOLD: ReadonlySet<SoundName> = new Set<SoundName>(['stamp', 'whoosh']);

let enabled = true;
const listeners = new Set<() => void>();
const players: Partial<Record<SoundName, AudioPlayer>> = {};

// Read the saved choice, and respect the phone's silent switch.
void getItem(KEY).then((saved) => {
  if (saved === 'off') setEnabled(false, false);
});
void setAudioModeAsync({ playsInSilentMode: false }).catch(() => {});

function player(name: SoundName): AudioPlayer {
  // Made once and reused, so playing is instant.
  return (players[name] ??= createAudioPlayer(SOUNDS[name]));
}

/**
 * Play a sound from the start, if sound effects are on. Never throws.
 * A sound already at its start plays at once; one that's played before is
 * rewound first and then played (playing while it rewinds made it stutter).
 */
export function playSound(name: SoundName) {
  if (!enabled || ON_HOLD.has(name)) return;
  try {
    const p = player(name);
    if (p.currentTime > 0) {
      void p
        .seekTo(0)
        .then(() => p.play())
        .catch(() => {});
    } else {
      p.play();
    }
  } catch {
    // No sound is better than a crash.
  }
}

/** A haptic tap to go with a sound, if sound effects are on. */
export function tap(strength: 'light' | 'medium' = 'medium') {
  if (!enabled) return;
  void Haptics.impactAsync(
    strength === 'light' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
  ).catch(() => {});
}

/** Load the sounds ahead of time, so the first one isn't late. */
export function preloadSounds() {
  for (const name of Object.keys(SOUNDS) as SoundName[]) {
    if (ON_HOLD.has(name)) continue;
    try {
      player(name);
    } catch {
      // Played (or not) later.
    }
  }
}

export function setEnabled(on: boolean, save = true) {
  enabled = on;
  if (save) void setItem(KEY, on ? 'on' : 'off');
  listeners.forEach((l) => l());
}

/** Whether sound effects are on, and a way to change it (for Settings). */
export function useSoundEffects(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => enabled,
  );
  return [on, setEnabled];
}
