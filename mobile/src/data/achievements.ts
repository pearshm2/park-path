/**
 * Passport achievements: tiers earned by the number of national parks
 * stamped, from the prototype's Achievements tab. The last tier is every
 * park, however many the API lists.
 */

export type AchievementIcon = 'flag' | 'tent' | 'mountain' | 'compass' | 'boot' | 'laurel';

export type Achievement = {
  /** Parks needed to earn it. */
  need: number;
  title: string;
  body: string;
  icon: AchievementIcon;
};

/** Stroke paths on a 24px grid, from the prototype's BADGE icons. */
export const ACHIEVEMENT_ICON: Record<AchievementIcon, string[]> = {
  flag: ['M6 21V4l12 3-12 3'],
  tent: ['M12 4L3 20h18L12 4z', 'M12 10v10'],
  mountain: ['M2 19l7-12 4 7 2-3 5 8H2z'],
  compass: ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M15.5 8.5l-2 5-5 2 2-5 5-2z'],
  boot: ['M7 4v10c0 3 1 6 5 6h7v-3c0-2-2-2.5-4-3.5S12 11 12 8V4H7z'],
  laurel: ['M12 21V8', 'M12 12c-4 0-6-2-6-6 4 0 6 2 6 6z', 'M12 12c4 0 6-2 6-6-4 0-6 2-6 6z'],
};

export function achievements(totalParks: number): Achievement[] {
  return [
    { need: 1, title: 'First stamp', body: 'Log a visit to any national park.', icon: 'flag' },
    { need: 3, title: 'Three down', body: 'Three national parks stamped.', icon: 'tent' },
    { need: 10, title: 'Ten parks', body: `Ten of the ${totalParks}.`, icon: 'mountain' },
    { need: 25, title: 'Quarter of the way', body: 'Twenty-five national parks stamped.', icon: 'compass' },
    { need: 40, title: 'Forty and counting', body: 'Forty national parks stamped.', icon: 'boot' },
    { need: totalParks, title: 'The whole list', body: 'Every national park.', icon: 'laurel' },
  ];
}

/**
 * When each tier was earned: the date of the first visit that brought the
 * count up to it. `firstVisits` is each stamped park's first visit date
 * (YYYY-MM-DD), in any order. Unearned tiers are left out.
 */
export function earnedDates(tiers: Achievement[], firstVisits: string[]): Map<number, string> {
  const ordered = firstVisits.slice().sort();
  const dates = new Map<number, string>();
  for (const tier of tiers) {
    if (tier.need >= 1 && ordered.length >= tier.need) dates.set(tier.need, ordered[tier.need - 1]);
  }
  return dates;
}
