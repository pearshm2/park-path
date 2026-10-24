/**
 * Passport achievements, in four groups (30 in all):
 *
 *  - National parks: tiers by how many of the national parks are stamped,
 *    the last being every one, however many the API lists.
 *  - Regions: one per map region, for stamping every national park in it.
 *  - All NPS sites: tiers by how many sites of any kind (monuments,
 *    historic sites, seashores, parks...) have a trip logged.
 *  - Friends: friends on ParkPath, and trips logged with a friend tagged.
 *
 * Everything here is worked out from the trip journal and the friends
 * list; nothing is stored. The server's passport (api/app/passport.py)
 * has the same list for a friend's passport; keep the two in step.
 */

import type { RegionId } from './regions';

export type AchievementIcon =
  | 'flag'
  | 'tent'
  | 'mountain'
  | 'compass'
  | 'boot'
  | 'laurel'
  | 'binoculars'
  | 'map'
  | 'pin'
  | 'star'
  | 'friends';

export type Achievement = {
  /** Unique across every group. */
  id: string;
  /** How many it takes: parks, a region's parks, or sites. */
  need: number;
  title: string;
  body: string;
  icon: AchievementIcon;
};

/** Stroke paths on a 24px grid; the first six from the prototype's BADGE icons. */
export const ACHIEVEMENT_ICON: Record<AchievementIcon, string[]> = {
  flag: ['M6 21V4l12 3-12 3'],
  tent: ['M12 4L3 20h18L12 4z', 'M12 10v10'],
  mountain: ['M2 19l7-12 4 7 2-3 5 8H2z'],
  compass: ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M15.5 8.5l-2 5-5 2 2-5 5-2z'],
  boot: ['M7 4v10c0 3 1 6 5 6h7v-3c0-2-2-2.5-4-3.5S12 11 12 8V4H7z'],
  laurel: ['M12 21V8', 'M12 12c-4 0-6-2-6-6 4 0 6 2 6 6z', 'M12 12c4 0 6-2 6-6-4 0-6 2-6 6z'],
  binoculars: ['M7 7a4 4 0 104 4V6H8z', 'M17 7a4 4 0 11-4 4V6h3z', 'M11 9h2'],
  map: ['M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z', 'M9 3v15', 'M15 6v15'],
  pin: ['M12 21s-7-6.5-7-12a7 7 0 0114 0c0 5.5-7 12-7 12z', 'M12 7a2 2 0 100 4 2 2 0 000-4z'],
  star: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z'],
  friends: [
    'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7z',
    'M2.5 20c.8-3.6 3.3-5.5 6.5-5.5s5.7 1.9 6.5 5.5',
    'M16 4.3a3.5 3.5 0 010 6.4',
    'M18 14.8c1.8.8 3 2.6 3.5 5.2',
  ],
};

/** Tiers by national parks stamped. */
export function achievements(totalParks: number): Achievement[] {
  const tiers: Achievement[] = [
    { id: 'parks-1', need: 1, title: 'First stamp', body: 'Log a visit to any national park.', icon: 'flag' },
    { id: 'parks-3', need: 3, title: 'Three down', body: 'Three national parks stamped.', icon: 'tent' },
    { id: 'parks-5', need: 5, title: 'High five', body: 'Five national parks stamped.', icon: 'boot' },
    { id: 'parks-10', need: 10, title: 'Ten parks', body: `Ten of the ${totalParks}.`, icon: 'mountain' },
    { id: 'parks-15', need: 15, title: 'Trail regular', body: 'Fifteen national parks stamped.', icon: 'compass' },
    {
      id: 'parks-25',
      need: 25,
      title: 'Quarter of the way',
      body: 'Twenty-five national parks stamped.',
      icon: 'binoculars',
    },
    {
      id: 'parks-half',
      need: Math.ceil(totalParks / 2),
      title: 'Halfway there',
      body: `Half of the ${totalParks} national parks stamped.`,
      icon: 'map',
    },
    { id: 'parks-40', need: 40, title: 'Forty and counting', body: 'Forty national parks stamped.', icon: 'boot' },
    { id: 'parks-50', need: 50, title: 'Fifty states of mind', body: 'Fifty national parks stamped.', icon: 'star' },
    { id: 'parks-all', need: totalParks, title: 'The whole list', body: 'Every national park.', icon: 'laurel' },
  ];
  return tiers
    // With fewer parks than a tier asks for (a partial sync), leave it out.
    .filter((tier) => tier.need >= 1 && tier.need <= totalParks)
    .sort((a, b) => a.need - b.need);
}

/** Each region's achievement: its name and a line about it. */
const REGION_ACHIEVEMENT: Record<RegionId, { title: string; flavor: string; icon: AchievementIcon }> = {
  pnw: { title: 'Evergreen explorer', flavor: 'rainforest, glaciers and volcanoes', icon: 'mountain' },
  california: { title: 'Golden State rambler', flavor: 'giant trees, granite and desert', icon: 'tent' },
  southwest: { title: 'Desert wanderer', flavor: 'canyons, arches and slickrock', icon: 'compass' },
  rockies: { title: 'Peak bagger', flavor: 'the high country of the Rockies', icon: 'mountain' },
  plains: { title: 'Prairie rover', flavor: 'badlands, caves and open sky', icon: 'binoculars' },
  midwest: { title: 'Great Lakes voyager', flavor: 'lakeshores, islands and river valleys', icon: 'compass' },
  northeast: { title: 'Down East trekker', flavor: 'granite coast and northern woods', icon: 'boot' },
  appalachia: { title: 'Blue Ridge rambler', flavor: 'old mountains and deep hollows', icon: 'tent' },
  gulf: { title: 'Bayou to beach', flavor: 'swamps, springs and coral keys', icon: 'pin' },
  akhi: { title: 'Last frontier & aloha', flavor: 'tundra, glaciers and volcanoes', icon: 'star' },
};

/** A region's achievement name, e.g. "Blue Ridge rambler". */
export function regionAchievementTitle(id: RegionId): string {
  return REGION_ACHIEVEMENT[id].title;
}

/** One achievement per region, given how many national parks each holds. */
export function regionAchievements(regions: { id: RegionId; label: string; parks: number }[]): Achievement[] {
  return regions
    .filter((r) => r.parks > 0)
    .map((r) => {
      const a = REGION_ACHIEVEMENT[r.id];
      return {
        id: `region-${r.id}`,
        need: r.parks,
        title: a.title,
        body: `Every national park in ${r.label}: ${r.parks === 1 ? 'its one park' : `all ${r.parks}`}, ${a.flavor}.`,
        icon: a.icon,
      };
    });
}

/** Tiers by NPS sites of any kind visited. */
export function siteAchievements(totalSites: number): Achievement[] {
  const tiers: Achievement[] = [
    {
      id: 'sites-5',
      need: 5,
      title: 'Beyond the parks',
      body: 'Five NPS sites of any kind: monuments, historic sites, seashores and more.',
      icon: 'pin',
    },
    { id: 'sites-25', need: 25, title: 'Monument hunter', body: 'Twenty-five NPS sites visited.', icon: 'binoculars' },
    { id: 'sites-50', need: 50, title: 'Park service regular', body: 'Fifty NPS sites visited.', icon: 'map' },
    { id: 'sites-100', need: 100, title: 'Century', body: 'A hundred NPS sites visited.', icon: 'star' },
    {
      id: 'sites-250',
      need: 250,
      title: 'Lifetime pass',
      body: 'Two hundred and fifty NPS sites visited.',
      icon: 'compass',
    },
    {
      id: 'sites-all',
      need: totalSites,
      title: 'Every last site',
      body: `All ${totalSites} sites the National Park Service looks after.`,
      icon: 'laurel',
    },
  ];
  return tiers.filter((tier) => tier.need <= totalSites);
}

/** Tiers by how many friends you have on ParkPath. */
export function friendAchievements(): Achievement[] {
  return [
    { id: 'friends-1', need: 1, title: 'First friend', body: 'Add a friend on ParkPath.', icon: 'friends' },
    { id: 'friends-3', need: 3, title: 'Trail crew', body: 'Three friends on ParkPath.', icon: 'friends' },
  ];
}

/** Tiers by how many trips you've logged with a friend tagged as going along. */
export function togetherAchievements(): Achievement[] {
  return [
    { id: 'together-1', need: 1, title: 'Better together', body: 'Log a trip with a friend along.', icon: 'boot' },
    { id: 'together-3', need: 3, title: 'Never hike alone', body: 'Three trips with friends along.', icon: 'compass' },
  ];
}

/**
 * When each count tier was earned: the date of the first visit that brought
 * the count up to it. `firstVisits` is each counted place's first visit
 * date (YYYY-MM-DD), in any order. Unearned tiers are left out. Keyed by id.
 */
export function earnedDates(tiers: Achievement[], firstVisits: string[]): Map<string, string> {
  const ordered = firstVisits.slice().sort();
  const dates = new Map<string, string>();
  for (const tier of tiers) {
    if (tier.need >= 1 && ordered.length >= tier.need) dates.set(tier.id, ordered[tier.need - 1]);
  }
  return dates;
}
