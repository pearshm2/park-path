/**
 * What a new trip earned, shown as it's earned.
 *
 * Saving a trip to a national park that wasn't stamped yet earns its
 * stamp, and may finish an achievement tier or every park in a region.
 * `celebrate` works out which, then:
 *
 *  - holds them back: Passport (and Explore's map) show each one as not
 *    yet earned until it's been revealed, so nothing fills in before you
 *    get there to watch it;
 *  - queues a notification for each achievement and region, which slide
 *    down from the top (CelebrationBanner.tsx) once the stamp's been
 *    revealed, with a chime. Tapping one opens where it's revealed.
 *
 * Passport reveals each held thing when it comes into view (the new stamp
 * pressing down; the achievement bars filling; the region filling in on
 * the map) and then lets it go with `release`.
 *
 * Holds live in memory only: after the app restarts, everything is simply
 * shown as earned.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  achievements,
  regionAchievementTitle,
  siteAchievements,
  togetherAchievements,
} from '../data/achievements';
import type { Site } from '../data/parks';
import { completedRegions, REGIONS, type RegionId } from '../data/regions';

export type Notice =
  | { id: string; kind: 'achievement'; title: string; body: string; need: number }
  | { id: string; kind: 'region'; title: string; body: string; region: RegionId }
  /** About a friend: a request, or one accepted. Opens Friends. */
  | { id: string; kind: 'friend'; title: string; body: string };

/** A notice to show, before it's given an id. */
export type NewNotice =
  | { kind: 'achievement'; title: string; body: string; need: number }
  | { kind: 'region'; title: string; body: string; region: RegionId }
  | { kind: 'friend'; title: string; body: string };

type Held = {
  /** A stamp earned and not yet seen pressed. */
  stamp: string | null;
  /** Regions completed and not yet seen filling in. */
  regions: RegionId[];
  /** The park count before the trip, while achievements it finished are unseen. */
  achievementsFrom: number | null;
};

type CelebrationsValue = {
  held: Held;
  /** The notification showing, if any. */
  notice: Notice | null;
  /**
   * After saving a new trip: what it earned (holding it back and queueing
   * its notifications). Returns the stamp earned, if any, to go and see.
   */
  celebrate: (args: {
    siteId: string;
    visitedBefore: ReadonlySet<string>;
    parks: Site[];
    /** Every NPS site, for the all-sites achievements. */
    allSites: Site[];
    /** Trips with a friend tagged before this one, and whether this one has one. */
    togetherBefore: number;
    withFriend: boolean;
  }) => string | null;
  release: (what: { stamp?: string; region?: RegionId; achievements?: true }) => void;
  /** Close the notification showing; the next (if any) follows. */
  dismissNotice: () => void;
  /** Show notifications that aren't about a trip (friends, say). */
  notify: (notices: NewNotice[]) => void;
};

const NO_HOLDS: Held = { stamp: null, regions: [], achievementsFrom: null };

const CelebrationsContext = createContext<CelebrationsValue | null>(null);

/** How long after the stamp is seen before the first notification. */
const AFTER_STAMP_MS = 900;

export function CelebrationsProvider({ children }: { children: ReactNode }) {
  const [held, setHeld] = useState<Held>(NO_HOLDS);
  const [queue, setQueue] = useState<Notice[]>([]);
  /** Notifications wait until the stamp has been seen. */
  const [paused, setPaused] = useState(false);
  const nextId = useRef(0);

  const celebrate = useCallback<CelebrationsValue['celebrate']>(
    ({ siteId, visitedBefore, parks, allSites, togetherBefore, withFriend }) => {
    // A trip with a friend along can earn one of the together tiers, on a
    // park's first visit or any later one.
    const togetherNotices: Notice[] = withFriend
      ? togetherAchievements()
          .filter((tier) => tier.need === togetherBefore + 1)
          .map((tier) => ({
            id: `n${nextId.current++}`,
            kind: 'achievement' as const,
            title: `Achievement earned: ${tier.title}`,
            body: `${tier.body} Tap to see it in your Passport.`,
            need: tier.need,
          }))
      : [];

    // Otherwise only a first visit earns anything.
    if (visitedBefore.has(siteId)) {
      if (togetherNotices.length > 0) setQueue((q) => [...q, ...togetherNotices]);
      return null;
    }

    // Any NPS site counts towards the all-sites tiers.
    const siteIds = new Set(allSites.map((s) => s.id));
    const sitesBefore = [...visitedBefore].filter((id) => siteIds.has(id)).length;
    const siteNotices: Notice[] = siteIds.has(siteId)
      ? siteAchievements(allSites.length)
          .filter((tier) => tier.need === sitesBefore + 1)
          .map((tier) => ({
            id: `n${nextId.current++}`,
            kind: 'achievement' as const,
            title: `Achievement earned: ${tier.title}`,
            body: `${tier.body} Tap to see it in your Passport.`,
            need: tier.need,
          }))
      : [];

    const park = parks.find((p) => p.id === siteId);
    // Not a national park: no stamp, just any site or together milestone.
    if (!park) {
      const earned = [...siteNotices, ...togetherNotices];
      if (earned.length > 0) setQueue((q) => [...q, ...earned]);
      return null;
    }

    const before = parks.map((p): Site => ({ ...p, status: visitedBefore.has(p.id) ? 'visited' : 'new' }));
    const after = before.map((p): Site => (p.id === siteId ? { ...p, status: 'visited' } : p));
    const countBefore = before.filter((p) => p.status === 'visited').length;
    const countAfter = countBefore + 1;

    const notices: Notice[] = [];
    for (const tier of achievements(parks.length)) {
      if (tier.need > countBefore && tier.need <= countAfter) {
        notices.push({
          id: `n${nextId.current++}`,
          kind: 'achievement',
          title: `Achievement earned: ${tier.title}`,
          body: `${tier.body} Tap to see it in your Passport.`,
          need: tier.need,
        });
      }
    }
    notices.push(...siteNotices, ...togetherNotices);
    const doneBefore = completedRegions(before);
    const newRegions = [...completedRegions(after)].filter((r) => !doneBefore.has(r));
    for (const regionId of newRegions) {
      const label = REGIONS.find((r) => r.id === regionId)?.label ?? 'A region';
      notices.push({
        id: `n${nextId.current++}`,
        kind: 'region',
        title: `Region complete: ${regionAchievementTitle(regionId)}`,
        body: `Every national park in ${label}, stamped. Tap to watch it fill in on your map.`,
        region: regionId,
      });
    }

    setHeld((h) => ({
      stamp: siteId,
      regions: [...h.regions, ...newRegions],
      achievementsFrom: notices.some((n) => n.kind === 'achievement')
        ? (h.achievementsFrom ?? countBefore)
        : h.achievementsFrom,
    }));
    setQueue((q) => [...q, ...notices]);
    setPaused(true);
    return siteId;
    },
    [],
  );

  const release = useCallback<CelebrationsValue['release']>((what) => {
    setHeld((h) => ({
      stamp: what.stamp && h.stamp === what.stamp ? null : h.stamp,
      regions: what.region ? h.regions.filter((r) => r !== what.region) : h.regions,
      achievementsFrom: what.achievements ? null : h.achievementsFrom,
    }));
    if (what.stamp) setTimeout(() => setPaused(false), AFTER_STAMP_MS);
  }, []);

  const dismissNotice = useCallback(() => setQueue((q) => q.slice(1)), []);

  const notify = useCallback<CelebrationsValue['notify']>((notices) => {
    setQueue((q) => [...q, ...notices.map((n) => ({ ...n, id: `n${nextId.current++}` }) as Notice)]);
  }, []);

  const value = useMemo<CelebrationsValue>(
    () => ({ held, notice: paused ? null : (queue[0] ?? null), celebrate, release, dismissNotice, notify }),
    [held, paused, queue, celebrate, release, dismissNotice, notify],
  );

  return <CelebrationsContext.Provider value={value}>{children}</CelebrationsContext.Provider>;
}

export function useCelebrations(): CelebrationsValue {
  const value = useContext(CelebrationsContext);
  if (!value) throw new Error('useCelebrations must be used inside a <CelebrationsProvider>');
  return value;
}
