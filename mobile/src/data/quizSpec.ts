/**
 * The onboarding quiz: four questions, one per recommendation signal.
 *
 *   Where are you starting from?    -> distance
 *   What do you want under your boots? -> terrain
 *   When would you like to go?      -> season
 *   How do you feel about crowds?   -> crowds
 *
 * These are the four signals the engine scores (POST /recommendations,
 * docs/recommendation-engine.md), and `QuizAnswers` maps straight onto
 * its request via `engineRequest` below. The data has nine terrain groups
 * to the quiz's six; the engine folds the other three in (caves -> forest,
 * dunes -> desert, badlands -> canyon), matching the option descriptions.
 *
 * What the earlier quiz asked and where it went: pace (effort) moves to
 * the park page, since it varies more within a park than between parks;
 * accessibility is deferred until there is real per-park data behind it;
 * trip length is dropped, as distance covers most of what it did.
 *
 * Answers are held in app state and stored on the device; there is no
 * /quiz endpoint.
 */

import type { Season, TerrainGroup } from './parks';
import { zipLocation } from './zipPrefixes';

/** The six terrain families offered in question 2. */
export type QuizTerrain = Extract<
  TerrainGroup,
  'mountain' | 'canyon' | 'desert' | 'forest' | 'coast' | 'water'
>;

export type CrowdPreference = 'icons' | 'either' | 'quiet';

export type QuizAnswers = {
  /** Starting zip code; null if skipped. */
  zip: string | null;
  terrains: QuizTerrain[];
  /**
   * Ranked, favourite first. An empty list is "Any season works for me";
   * null means the question hasn't been answered yet.
   */
  seasons: Season[] | null;
  crowds: CrowdPreference | null;
};

export const EMPTY_ANSWERS: QuizAnswers = {
  zip: null,
  terrains: [],
  seasons: null,
  crowds: null,
};

type QuizOption<V> = {
  value: V;
  label: string;
  sub: string;
};

/**
 * Each step names the `QuizAnswers` key it writes, which also decides how
 * the quiz screen draws it: a text field, checkboxes, tap-to-rank rows or
 * radio rows.
 */
export type QuizStep =
  | { key: 'zip'; title: string; sub: string }
  | { key: 'terrains'; title: string; sub: string; options: QuizOption<QuizTerrain>[] }
  | {
      key: 'seasons';
      title: string;
      sub: string;
      options: QuizOption<Season>[];
      /** The "no preference" row under the seasons. */
      anyLabel: string;
    }
  | { key: 'crowds'; title: string; sub: string; options: QuizOption<CrowdPreference>[] };

export const QUIZ_STEPS: QuizStep[] = [
  {
    key: 'zip',
    title: 'Where are you starting from?',
    sub: 'Your zip code lets us weigh how far away each park is.',
  },
  {
    key: 'terrains',
    title: 'What do you want under your boots?',
    sub: 'Pick as many as you like.',
    options: [
      { value: 'mountain', label: 'Mountains', sub: 'Alpine, volcanic, glaciated' },
      { value: 'canyon', label: 'Canyons & rock', sub: 'Sandstone, hoodoos, gorges' },
      { value: 'desert', label: 'Desert', sub: 'Basin, dunes, lava' },
      { value: 'forest', label: 'Forest', sub: 'Old growth, ridge, cave country' },
      { value: 'coast', label: 'Coast & islands', sub: 'Shoreline, islands, dunes' },
      { value: 'water', label: 'Lakes & wetland', sub: 'Lakes, rivers, wetland' },
    ],
  },
  {
    key: 'seasons',
    title: 'When would you like to go?',
    sub: 'Tap to rank the seasons. Your first pick counts the most.',
    options: [
      { value: 'winter', label: 'Winter', sub: 'Desert season; northern parks close' },
      { value: 'spring', label: 'Spring', sub: 'Water running, shoulder crowds' },
      { value: 'summer', label: 'Summer', sub: 'Everything open, everything full' },
      { value: 'fall', label: 'Fall', sub: 'Cool, clear, and thinning out' },
    ],
    anyLabel: 'Any season works for me',
  },
  {
    key: 'crowds',
    title: 'How do you feel about crowds?',
    sub: 'The busiest parks are famous for a reason. The quiet ones have room to breathe.',
    options: [
      { value: 'icons', label: 'Icons', sub: 'The famous parks, crowds and all' },
      { value: 'either', label: 'Fine either way', sub: "Crowds won't change your picks" },
      { value: 'quiet', label: 'Get me away from people', sub: 'Quieter, lesser-known parks first' },
    ],
  },
];

/** True for a 5-digit zip code whose area we can place. */
export function isKnownZip(zip: string): boolean {
  return zipLocation(zip) !== null;
}

/**
 * True once the step's question has an answer, which gates Continue. The
 * zip step is never "answered" by an empty field: it is either a known
 * zip code or skipped with its own button.
 */
export function isStepAnswered(step: QuizStep, answers: QuizAnswers): boolean {
  switch (step.key) {
    case 'zip':
      return answers.zip !== null && isKnownZip(answers.zip);
    case 'terrains':
      return answers.terrains.length > 0;
    case 'seasons':
      return answers.seasons !== null;
    case 'crowds':
      return answers.crowds !== null;
  }
}

/** True when every required question is answered (the zip code is optional). */
export function isComplete(answers: QuizAnswers): boolean {
  return answers.terrains.length > 0 && answers.seasons !== null && answers.crowds !== null;
}

/**
 * The answers as POST /recommendations takes them. "Any season" is an
 * empty list and a skipped zip code sends no location, both of which the
 * engine treats as "no preference": that signal drops out and the others'
 * weights rescale.
 */
export function engineRequest(answers: QuizAnswers) {
  return {
    answers: {
      terrains: answers.terrains,
      seasons: answers.seasons ?? [],
      crowds: answers.crowds ?? 'either',
    },
    location: answers.zip ? zipLocation(answers.zip) : null,
  };
}
