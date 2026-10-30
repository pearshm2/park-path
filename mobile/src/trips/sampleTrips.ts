/**
 * Sample journal entries for trying the Trips and Passport screens on a
 * fresh account, loaded from the Trips empty state in development builds
 * only (see `__DEV__` there). Their photos are each park's NPS photo, so
 * nothing needs to be bundled.
 */

import type { Site } from '../data/parks';
import type { TripEntry } from './TripsContext';

type Sample = Pick<TripEntry, 'siteId' | 'date' | 'title' | 'notes' | 'rating'> & {
  trails: string[];
  /** The caption over the park's photo. */
  caption: string;
};

const SAMPLES: Sample[] = [
  {
    siteId: 'acad',
    date: '2024-06-14',
    title: 'Sunrise on Cadillac',
    notes:
      'Up at 4am to be first in the country to see the sun. Freezing at the top, blueberry pancakes in Bar Harbor after. Worth every minute of lost sleep.',
    rating: 5,
    trails: ['Cadillac Summit Loop', 'Ocean Path'],
    caption: 'First light from the summit.',
  },
  {
    siteId: 'shen',
    date: '2024-10-19',
    title: 'Skyline Drive in full colour',
    notes:
      'Drove the whole thing with the windows down. Every overlook was better than the last. Hiked down to Dark Hollow Falls and regretted it on the climb back up.',
    rating: 4,
    trails: ['Dark Hollow Falls'],
    caption: 'Every overlook a different colour.',
  },
  {
    siteId: 'grca',
    date: '2025-03-22',
    title: 'Rim to the river (almost)',
    notes:
      'Made it to Skeleton Point and turned around. The colours change every hour. Saw a condor ride the thermals right past us.',
    rating: 5,
    trails: ['South Kaibab Trail', 'Ooh Aah Point', 'Skeleton Point'],
    caption: 'The storm rolled in just as we turned back.',
  },
  {
    siteId: 'zion',
    date: '2025-03-25',
    title: 'Wading the Narrows',
    notes:
      'Rented the canyoneering boots and walked upriver for three hours. Cold water, warm walls, light bouncing everywhere.',
    rating: 5,
    trails: ['The Narrows', 'Riverside Walk'],
    caption: 'Knee-deep and grinning.',
  },
  {
    siteId: 'romo',
    date: '2025-08-09',
    title: 'Elk at dusk',
    notes:
      'Trail Ridge Road above the treeline, then a herd of elk crossing the meadow on the way down. Altitude headache was real.',
    rating: 4,
    trails: ['Trail Ridge Road'],
    caption: 'Above the treeline.',
  },
  {
    siteId: 'grsm',
    date: '2026-05-02',
    title: 'Synchronous fireflies',
    notes:
      'Won the lottery for the firefly viewing. Thousands of them blinking in time in the dark. Nobody spoke for an hour.',
    rating: 5,
    trails: ['Elkmont'],
    caption: 'Before the dark, before the fireflies.',
  },
];

/** The samples as entries, skipping any park the site list doesn't have. */
export function sampleEntries(sites: Site[]): TripEntry[] {
  const byId = new Map(sites.map((site) => [site.id, site]));
  return SAMPLES.filter((sample) => byId.has(sample.siteId)).map(({ caption, ...sample }, i) => {
    const site = byId.get(sample.siteId)!;
    return {
      ...sample,
      id: `sample-${sample.siteId}-${i}`,
      media: site.imageUrl ? [{ uri: site.imageUrl, kind: 'photo' as const, caption }] : [],
      with: [],
      visibility: 'private' as const,
      passportStamp: null,
      feedback: [],
      createdAt: `${sample.date}T20:00:00.000Z`,
      // Sent to the server like any new trip.
      unsent: true,
    };
  });
}
