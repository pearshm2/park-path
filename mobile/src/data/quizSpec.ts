/**
 * The onboarding quiz, ported verbatim from the design prototype's
 * `quizSpec()` (ParkPath Prototype.dc.html, line 1175).
 *
 * Question text and option copy are intentionally unchanged from the
 * mockup — if the wording needs revisiting, that is a design decision,
 * not a code one.
 *
 * There is no backend for this yet: api/app/main.py mounts only the auth
 * router, so answers are held in app state. When a /quiz endpoint lands,
 * `QuizAnswers` is the shape to send.
 */

import type { EffortLevel, Season, TerrainGroup } from './parks';

/** The six terrain families offered in question 1. */
export type QuizTerrain = Extract<
  TerrainGroup,
  'mountain' | 'canyon' | 'desert' | 'forest' | 'coast' | 'water'
>;

export type QuizAnswers = {
  terrains: QuizTerrain[];
  season: Season | '';
  effort: EffortLevel | null;
  /** Accessibility adjustment; 'none' means rank on the other answers. */
  needs: 'none' | 'wheelchair' | 'short' | 'stamina' | '';
  /** Typical trip length in days: 1, 3, 4 or 6. */
  days: number | null;
};

export const EMPTY_ANSWERS: QuizAnswers = {
  terrains: [],
  season: '',
  effort: null,
  needs: '',
  days: null,
};

type QuizOption<V> = {
  value: V;
  label: string;
  sub: string;
};

/**
 * Each step names the `QuizAnswers` key it writes. `multi` marks the
 * terrain step, which accumulates values instead of replacing them.
 */
export type QuizStep =
  | {
      key: 'terrains';
      multi: true;
      title: string;
      sub: string;
      options: QuizOption<QuizTerrain>[];
    }
  | { key: 'season'; multi: false; title: string; sub: string; options: QuizOption<Season>[] }
  | { key: 'effort'; multi: false; title: string; sub: string; options: QuizOption<EffortLevel>[] }
  | {
      key: 'needs';
      multi: false;
      title: string;
      sub: string;
      options: QuizOption<Exclude<QuizAnswers['needs'], ''>>[];
    }
  | { key: 'days'; multi: false; title: string; sub: string; options: QuizOption<number>[] };

export const QUIZ_STEPS: QuizStep[] = [
  {
    key: 'terrains',
    multi: true,
    title: 'What do you want under your boots?',
    sub: 'Pick as many as you like. This carries the heaviest weight in your feed.',
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
    key: 'season',
    multi: false,
    title: 'When are you next free?',
    sub: 'Season fit is the single biggest signal — the same park is a different trip in February.',
    options: [
      { value: 'winter', label: 'Winter', sub: 'Desert season; northern parks close' },
      { value: 'spring', label: 'Spring', sub: 'Water running, shoulder crowds' },
      { value: 'summer', label: 'Summer', sub: 'Everything open, everything full' },
      { value: 'fall', label: 'Fall', sub: 'Cool, clear, and thinning out' },
    ],
  },
  {
    key: 'effort',
    multi: false,
    title: 'How hard do you want to work?',
    sub: 'We match trail difficulty, not fitness.',
    options: [
      { value: 1, label: 'Easy walks', sub: 'Boardwalks, overlooks, under 3 miles' },
      { value: 2, label: 'Half-day hikes', sub: '4–8 miles, some climbing' },
      { value: 3, label: 'All day, strenuous', sub: 'Long days, big elevation, scrambling' },
    ],
  },
  {
    key: 'needs',
    multi: false,
    title: 'Does anything need to be easier?',
    sub: 'Tell us and accessible routes carry more weight than distance or terrain. You can change this any time.',
    options: [
      { value: 'none', label: 'No adjustment needed', sub: 'Rank on the answers above' },
      {
        value: 'wheelchair',
        label: 'Wheelchair or mobility device',
        sub: 'Prioritise step-free paved and boardwalk routes',
      },
      {
        value: 'short',
        label: 'Short, flat trails only',
        sub: 'Under a mile, little elevation, benches along the way',
      },
      {
        value: 'stamina',
        label: 'Low stamina or a chronic condition',
        sub: 'Shorter days, shade, and somewhere to sit',
      },
    ],
  },
  {
    key: 'days',
    multi: false,
    title: 'How long is the trip?',
    sub: 'Some parks are a morning. Some are a week and a float plane.',
    options: [
      { value: 1, label: 'A day', sub: 'Out and back' },
      { value: 3, label: 'A weekend', sub: 'Two or three days' },
      { value: 4, label: 'A long weekend', sub: 'Four days, one drive' },
      { value: 6, label: 'About a week', sub: 'Far-flung parks come into range' },
    ],
  },
];

/** True once the step's question has an answer — gates the Continue button. */
export function isStepAnswered(step: QuizStep, answers: QuizAnswers): boolean {
  if (step.key === 'terrains') return answers.terrains.length > 0;
  const value = answers[step.key];
  return value !== '' && value !== null;
}
