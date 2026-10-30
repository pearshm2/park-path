/**
 * Feedback tags: how a trip went, in four pairs of opposites (a trip has
 * at most one of each pair). They tune the person's recommendations on the
 * server (api/app/recommender.py, "Reviews") and show on the trip: chips
 * on friends' feed posts, and stamped onto a "How it was" page in Relive.
 */

import type { components } from '../api/schema';

/** Generated from the API; see src/api/schema.ts. */
export type FeedbackTag = NonNullable<components['schemas']['TripCreate']['feedback']>[number];

/** Each pair: the good side, then the other. */
export const FEEDBACK_PAIRS: [FeedbackTag, FeedbackTag][] = [
  ['loved_scenery', 'not_my_scenery'],
  ['peaceful', 'too_crowded'],
  ['worth_the_drive', 'too_far'],
  ['perfect_timing', 'wrong_season'],
];

const LABELS: Record<FeedbackTag, string> = {
  loved_scenery: 'Loved the scenery',
  not_my_scenery: 'Not my scenery',
  peaceful: 'Peaceful',
  too_crowded: 'Too crowded',
  worth_the_drive: 'Worth the drive',
  too_far: 'Too far',
  perfect_timing: 'Perfect timing',
  wrong_season: 'Wrong time of year',
};

const GOOD = new Set<string>(FEEDBACK_PAIRS.map(([good]) => good));

export function feedbackLabel(tag: string): string {
  return LABELS[tag as FeedbackTag] ?? tag;
}

/** The good side of a pair ("Peaceful"), as opposed to a complaint ("Too crowded"). */
export function isGood(tag: string): boolean {
  return GOOD.has(tag);
}

/** Only known tags, one per pair, in the pairs' order (stored data is untrusted). */
export function cleanFeedback(tags: readonly string[] | undefined | null): FeedbackTag[] {
  if (!tags) return [];
  return FEEDBACK_PAIRS.flatMap((pair) => {
    const on = pair.find((tag) => tags.includes(tag));
    return on ? [on] : [];
  });
}

/** Tap a tag: on (turning its opposite off), or off again if it was on. */
export function toggleFeedback(tags: FeedbackTag[], tag: FeedbackTag): FeedbackTag[] {
  if (tags.includes(tag)) return tags.filter((t) => t !== tag);
  const pair = FEEDBACK_PAIRS.find((p) => p.includes(tag));
  return cleanFeedback([...tags.filter((t) => !pair?.includes(t)), tag]);
}
