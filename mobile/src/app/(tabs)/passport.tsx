/**
 * Passport, following the prototype's screen: a header with your count,
 * then Stamps or Achievements.
 *
 * Stamps: a progress map, a filter (region, and stamped or not), and a
 * stamp for each national park. Tapping a stamp reopens the latest trip that earned it; tapping an
 * empty one opens the park. Tapping a region on the map picks its chip.
 *
 * Achievements, in three groups (data/achievements.ts): national parks
 * stamped, each region's parks all stamped, and NPS sites of any kind
 * visited; each dated by the visit that earned it.
 *
 * Opened with `park` (a stamp tapped in Relive): shows that park's region
 * on the Stamps tab.
 *
 * What a new trip earned is revealed here as you watch
 * (celebrations/CelebrationsContext.tsx), until then shown as not earned:
 *  - `show=stamp` (straight after saving it): the park's region, and its
 *    wax seal pressing down onto its stamp;
 *  - an achievement, when Achievements is shown: its bar filling and its
 *    medal stamping (AchievementRow.tsx);
 *  - a region, on `show=region` (its notification tapped) or the next
 *    time the Stamps tab is opened: the map zoomed onto it, filling in.
 *
 * A park is stamped once it has a trip entry (trips/TripsContext.tsx), so
 * everything here is worked out from the journal; nothing is stored.
 */

import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listSites } from '../../api/parks';
import { useCelebrations } from '../../celebrations/CelebrationsContext';
import { playSound } from '../../lib/sounds';
import { BodyText, FilterButton, Heading, ParkMap, useTabBarSpace } from '../../components';
import { AchievementRow } from '../../components/passport/AchievementRow';
import { Stamp } from '../../components/passport/Stamp';
import {
  achievements,
  earnedDates,
  friendAchievements,
  regionAchievements,
  siteAchievements,
  togetherAchievements,
} from '../../data/achievements';
import type { Site } from '../../data/parks';
import { completedRegions, regionForState, REGIONS, type RegionId } from '../../data/regions';
import { CapTextScale, colors, radius, shadow, space } from '../../theme';
import { useFriends } from '../../friends/useFriends';
import { monthLabel, useTrips } from '../../trips/TripsContext';

type Tab = 'stamps' | 'achievements';

/** Which stamps the grid shows. */
type Show = 'all' | 'stamped' | 'unstamped';

const SHOWS: { value: Show; label: string }[] = [
  { value: 'all', label: 'All stamps' },
  { value: 'stamped', label: 'Stamped' },
  { value: 'unstamped', label: 'Not yet stamped' },
];

const TABS: { value: Tab; label: string }[] = [
  { value: 'stamps', label: 'Stamps' },
  { value: 'achievements', label: 'Achievements' },
];

/** Space between stamps in the grid. */
const GAP = space[3];

export default function PassportScreen() {
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { entries, visitedIds, visitSummary } = useTrips();

  const [tab, setTab] = useState<Tab>('stamps');
  const [region, setRegion] = useState<RegionId | null>(null);
  const [show, setShow] = useState<Show>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  /** Where the filter button's row ends, in the scrolled page, and how far
   *  it's scrolled: together, where the menu drops from. */
  const [filterBottom, setFilterBottom] = useState(0);
  const scrollY = useRef(0);
  /** Where the open menu sits, worked out as it opens. */
  const [menuTop, setMenuTop] = useState(0);
  const params = useLocalSearchParams<{ park?: string; show?: string; region?: string }>();
  const { held, release } = useCelebrations();

  /** A new stamp pressing down, while it does. */
  const [pressing, setPressing] = useState<string | null>(null);
  /** A region filling in on the map, while it does. */
  const [filling, setFilling] = useState<RegionId | null>(null);
  /** Here to see a new stamp: its region waits for its own notification. */
  const [stampFlow, setStampFlow] = useState(false);
  /** The count achievements play up from, once they're being shown. */
  const [achievementsFrom, setAchievementsFrom] = useState<number | null>(null);
  const scroller = useRef<ScrollView>(null);
  const gridY = useRef(0);

  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => {
        setFocused(false);
        // Leaving: whatever was being revealed is done.
        setPressing(null);
        setFilling(null);
        setStampFlow(false);
        setAchievementsFrom(null);
      };
    }, []),
  );

  const { data: sharedParks = [], isPending, isError } = useQuery({
    queryKey: ['sites', 'parks'],
    queryFn: () => listSites('parks'),
  });

  // Visited comes from the journal, as on Explore; a stamp just earned
  // isn't shown until it's pressed (see above).
  const parks = useMemo(
    () =>
      sharedParks
        .map((site): Site =>
          visitedIds.has(site.id) && site.id !== held.stamp ? { ...site, status: 'visited' } : site,
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [sharedParks, visitedIds, held.stamp],
  );
  const stamped = parks.filter((site) => site.status === 'visited');
  // Regions just completed stay unfilled until they're filled in.
  const completed = useMemo(() => {
    const done = completedRegions(parks);
    for (const r of held.regions) done.delete(r);
    return done;
  }, [parks, held.regions]);

  // Only regions with a park in them are offered.
  const regions = useMemo(
    () => REGIONS.filter((r) => parks.some((site) => regionForState(site.state)?.id === r.id)),
    [parks],
  );
  const inRegion = region ? parks.filter((site) => regionForState(site.state)?.id === region) : parks;
  const regionStamped = inRegion.filter((site) => site.status === 'visited').length;
  const shown =
    show === 'all'
      ? inRegion
      : inRegion.filter((site) => (site.status === 'visited') === (show === 'stamped'));
  const regionLabel = region ? (REGIONS.find((r) => r.id === region)?.label ?? 'All regions') : 'All regions';
  const filterLabel = show === 'all' ? regionLabel : `${regionLabel} · ${SHOWS.find((o) => o.value === show)!.label}`;
  const filterCount = (region ? 1 : 0) + (show === 'all' ? 0 : 1);

  // Each place's first visit (entries are newest first, so the last seen
  // is the first), leaving out a stamp not yet revealed.
  const firstVisit = useMemo(() => {
    const first = new Map<string, string>();
    for (const entry of entries) if (entry.siteId !== held.stamp) first.set(entry.siteId, entry.date);
    return first;
  }, [entries, held.stamp]);

  // National parks.
  const tiers = useMemo(() => achievements(parks.length), [parks.length]);
  const earned = useMemo(() => {
    const parkIds = new Set(parks.map((site) => site.id));
    return earnedDates(tiers, [...firstVisit].filter(([id]) => parkIds.has(id)).map(([, d]) => d));
  }, [firstVisit, parks, tiers]);

  // Regions: each one's national parks, how many are stamped, and when the
  // last of them was (if they all are). One just completed stays unearned
  // until it's been filled in on the map.
  const regionRows = useMemo(() => {
    const byRegion = REGIONS.map((r) => {
      const inIt = parks.filter((site) => regionForState(site.state)?.id === r.id);
      return { region: r, parks: inIt };
    });
    const tiersFor = regionAchievements(
      byRegion.map(({ region: r, parks: p }) => ({ id: r.id, label: r.label, parks: p.length })),
    );
    return tiersFor.map((tier) => {
      const { region: r, parks: p } = byRegion.find((b) => `region-${b.region.id}` === tier.id)!;
      const dates = p.map((site) => firstVisit.get(site.id)).filter((d): d is string => d != null);
      const holding = held.regions.includes(r.id);
      const count = holding ? Math.min(dates.length, tier.need - 1) : dates.length;
      const done = count >= tier.need;
      return { tier, count, earned: done ? dates.slice().sort()[dates.length - 1] : null };
    });
  }, [parks, firstVisit, held.regions]);

  // Every NPS site.
  const { data: allSites = [] } = useQuery({
    queryKey: ['sites', 'all'],
    queryFn: () => listSites('all'),
  });
  const siteTiers = useMemo(() => siteAchievements(allSites.length), [allSites.length]);
  const sitesVisited = useMemo(() => {
    const ids = new Set(allSites.map((site) => site.id));
    return [...firstVisit].filter(([id]) => ids.has(id)).map(([, d]) => d);
  }, [allSites, firstVisit]);
  const siteEarned = useMemo(() => earnedDates(siteTiers, sitesVisited), [siteTiers, sitesVisited]);

  // Friends: how many, and trips with one tagged. Dated by when each
  // friendship began, and by each such trip.
  const { friends } = useFriends();
  const friendTiers = useMemo(() => friendAchievements(), []);
  const friendDates = useMemo(
    () => friends.map((f) => (f.since ?? new Date().toISOString()).slice(0, 10)),
    [friends],
  );
  const friendEarned = useMemo(() => earnedDates(friendTiers, friendDates), [friendTiers, friendDates]);
  const togetherTiers = useMemo(() => togetherAchievements(), []);
  const togetherDates = useMemo(
    () => entries.filter((e) => e.with.length > 0).map((e) => e.date),
    [entries],
  );
  const togetherEarned = useMemo(
    () => earnedDates(togetherTiers, togetherDates),
    [togetherTiers, togetherDates],
  );

  // Sent here for something: a park's region (from Relive), a new stamp to
  // see go down, or a notification's achievement or region. Adjusted as
  // it renders rather than in an effect; the request is then cleared so
  // the same one can be asked for again.
  const request = params.show ?? (params.park ? 'park' : undefined);
  const requestKey = request ? `${request}:${params.park ?? ''}:${params.region ?? ''}` : undefined;
  const [handled, setHandled] = useState<string | undefined>(undefined);
  if (requestKey !== handled && (!requestKey || sharedParks.length > 0)) {
    setHandled(requestKey);
    const site = params.park ? sharedParks.find((p) => p.id === params.park) : undefined;
    const regionOf = (s?: Site) => (s && regionForState(s.state)?.id) ?? null;
    if (request === 'park') {
      setTab('stamps');
      setRegion(regionOf(site));
    } else if (request === 'stamp' && site) {
      setTab('stamps');
      setRegion(regionOf(site));
      setShow('all');
      setStampFlow(true);
      setPressing(site.id);
    } else if (request === 'achievements') {
      setTab('achievements');
    } else if (request === 'region' && params.region) {
      setTab('stamps');
      setShow('all');
      setStampFlow(false);
    }
  }
  useEffect(() => {
    if (requestKey && handled === requestKey) {
      router.setParams({ park: undefined, show: undefined, region: undefined });
    }
  }, [requestKey, handled, router]);

  // A new stamp: bring it into view as it goes down.
  useEffect(() => {
    if (!pressing) return;
    const timer = setTimeout(() => {
      scroller.current?.scrollTo({ y: Math.max(0, gridY.current - 160), animated: true });
    }, 250);
    return () => clearTimeout(timer);
  }, [pressing]);

  // Achievements a trip finished: play them out when they're shown (and
  // only then: off Achievements, they show as they are). Adjusted as it
  // renders; the hold is let go once they're playing.
  if (tab !== 'achievements' && achievementsFrom != null) setAchievementsFrom(null);
  if (focused && tab === 'achievements' && held.achievementsFrom != null && achievementsFrom == null) {
    setAchievementsFrom(held.achievementsFrom);
  }
  useEffect(() => {
    if (achievementsFrom != null && held.achievementsFrom != null) release({ achievements: true });
  }, [achievementsFrom, held.achievementsFrom, release]);

  // Regions a trip completed: fill them in on the map when the Stamps tab
  // is up, except while a new stamp is being seen (they come after its
  // notification). The hold is let go once it's filling.
  // (A new stamp's request, still in the params, counts too: its flag is
  // only set by the time the next render runs.)
  const seeingStamp = stampFlow || pressing != null || params.show === 'stamp';
  if (focused && tab === 'stamps' && !seeingStamp && !filling && held.regions.length > 0) {
    const next = held.regions[0];
    setRegion(next);
    setShow('all');
    setFilling(next);
  }
  useEffect(() => {
    if (filling && held.regions.includes(filling)) release({ region: filling });
  }, [filling, held.regions, release]);

  // Tiers a trip just finished count once they've played out.
  const [countedFrom, setCountedFrom] = useState<number | null>(null);
  const playFrom = achievementsFrom ?? held.achievementsFrom;
  if (playFrom !== countedFrom && playFrom == null) setCountedFrom(null);
  if (playFrom != null && countedFrom == null) setCountedFrom(playFrom);
  useEffect(() => {
    if (countedFrom == null) return;
    // As long as the bars take to fill (AchievementRow.tsx).
    const timer = setTimeout(() => setCountedFrom(null), 1600);
    return () => clearTimeout(timer);
  }, [countedFrom]);
  const shownEarned = tiers.filter((t) => earned.has(t.id) && (countedFrom == null || t.need <= countedFrom)).length;
  const earnedTotal =
    shownEarned +
    regionRows.filter((r) => r.earned).length +
    siteTiers.filter((t) => siteEarned.has(t.id)).length +
    friendTiers.filter((t) => friendEarned.has(t.id)).length +
    togetherTiers.filter((t) => togetherEarned.has(t.id)).length;
  const achievementTotal =
    tiers.length + regionRows.length + siteTiers.length + friendTiers.length + togetherTiers.length;

  const stampSize = Math.floor((width - space[4] * 2 - GAP * 2) / 3);

  function openStamp(site: Site) {
    const summary = visitSummary(site.id);
    if (summary) router.navigate({ pathname: '/trips', params: { entry: summary.entry.id } });
    else router.push(`/site/${site.id}`);
  }

  return (
    <View style={styles.screen}>
    <ScrollView
      ref={scroller}
      style={styles.scroll}
      onScroll={(event) => {
        scrollY.current = event.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={32}
      onScrollBeginDrag={() => setFilterOpen(false)}
      contentContainerStyle={[
        styles.gutter,
        { paddingTop: insets.top + space[2], paddingBottom: tabSpace + space[6] },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Heading size={26}>Passport</Heading>
          <BodyText size={12} color={colors.neutral[600]} style={styles.subtitle}>
            {`${stamped.length} of ${parks.length || 63} national parks · ${entries.length} logged ${entries.length === 1 ? 'trip' : 'trips'}`}
          </BodyText>
        </View>
      </View>

      {tab === 'stamps' && !isPending && !isError ? (
        <View
          style={styles.filterRow}
          onLayout={(event) => {
            const { y, height } = event.nativeEvent.layout;
            setFilterBottom(y + height);
          }}
        >
          <Pressable
            onPress={() => {
              setMenuTop(filterBottom - scrollY.current + 4);
              setFilterOpen((open) => !open);
            }}
            accessibilityRole="button"
            accessibilityState={{ expanded: filterOpen }}
            accessibilityLabel={`Filter stamps: ${filterLabel}. Change`}
            style={styles.filterButton}
          >
            <BodyText
              size={12.5}
              weight="semibold"
              color={colors.neutral[700]}
              numberOfLines={1}
              style={styles.filterLabel}
            >
              {filterLabel}
            </BodyText>
            <View pointerEvents="none">
              <FilterButton count={filterCount} onPress={() => {}} />
            </View>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((option) => {
          const active = option.value === tab;
          return (
            <Pressable
              key={option.value}
              onPress={() => setTab(option.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tab, active && styles.tabActive]}
            >
              <BodyText
                size={13}
                weight="semibold"
                color={active ? colors.neutral[100] : colors.neutral[700]}
              >
                {option.label}
              </BodyText>
            </Pressable>
          );
        })}
      </View>

      {isError ? (
        <View style={styles.notice}>
          <BodyText size={13} color={colors.neutral[700]}>
            Couldn&apos;t load the parks. Check your connection and come back to this tab.
          </BodyText>
        </View>
      ) : isPending ? (
        <View style={styles.notice}>
          <BodyText size={13} color={colors.neutral[700]}>
            Loading your stamps…
          </BodyText>
        </View>
      ) : tab === 'stamps' ? (
        <>
          <View style={styles.mapCard}>
            <BodyText size={10.5} weight="semibold" color={colors.neutral[600]} style={styles.kicker}>
              Progress map · tap a region to see its stamps
            </BodyText>
            <View style={styles.mapBox}>
              <ParkMap
                sites={parks}
                focusRegion={region}
                completedRegions={completed}
                fillingRegion={filling}
                onFilled={() => {
                  playSound('chime');
                  // Filled: drawn as any completed region; the next, if any, follows.
                  setTimeout(() => setFilling(null), 600);
                }}
                onSelectRegion={(id) => {
                  setRegion(id);
                  setFilterOpen(false);
                }}
                onSelectSite={openStamp}
                style={styles.mapFill}
              />
            </View>
          </View>

          <View style={styles.sectionHead}>
            <BodyText size={10.5} weight="semibold" color={colors.neutral[600]} style={styles.kicker}>
              The national parks
            </BodyText>
            <BodyText size={12} weight="bold" color={colors.accentRamp[700]}>
              {`${regionStamped} of ${inRegion.length} stamped`}
            </BodyText>
          </View>

          <View
            style={styles.filterBox}
            onLayout={(event) => {
              gridY.current = event.nativeEvent.layout.y;
            }}
          >
            <CapTextScale max={1.1}>
              <View style={styles.grid}>
                {shown.map((site) => {
                  const summary = visitSummary(site.id);
                  return (
                    <Stamp
                      key={site.id}
                      site={site}
                      visited={summary && (site.status === 'visited' || site.id === pressing) ? monthLabel(summary.last) : null}
                      size={stampSize}
                      onPress={() => openStamp(site)}
                      pressIn={site.id === pressing}
                      onPressedIn={() => {
                        release({ stamp: site.id });
                        // Down: drawn as any stamp from now on.
                        setTimeout(() => setPressing(null), 500);
                      }}
                    />
                  );
                })}
              </View>
            </CapTextScale>
            {shown.length === 0 ? (
              <BodyText size={13} color={colors.neutral[600]} style={styles.noneShown}>
                {show === 'stamped' ? 'No stamps here yet. Log a trip to earn one.' : 'Every park here is stamped.'}
              </BodyText>
            ) : null}

          </View>

          <BodyText size={11} weight="medium" color={colors.neutral[600]} style={styles.footnote}>
            Tap a stamp to reopen its trip, or an empty one to see the park. Log a trip to stamp it.
          </BodyText>
        </>
      ) : (
        <>
          <View style={styles.sectionHead}>
            <BodyText size={10.5} weight="semibold" color={colors.neutral[600]} style={styles.kicker}>
              Achievements
            </BodyText>
            <BodyText size={12} weight="bold" color={colors.accentRamp[700]}>
              {`${earnedTotal} of ${achievementTotal} earned`}
            </BodyText>
          </View>

          <AchievementGroup
            title="National parks"
            meta={`${stamped.length} of ${parks.length} stamped`}
          >
            {tiers.map((tier) => {
              const date = earned.get(tier.id);
              return (
                <AchievementRow
                  key={tier.id}
                  tier={tier}
                  count={stamped.length}
                  earned={date ? monthLabel(date) : null}
                  from={achievementsFrom ?? held.achievementsFrom ?? undefined}
                />
              );
            })}
          </AchievementGroup>

          <AchievementGroup
            title="Regions"
            meta={`${regionRows.filter((r) => r.earned).length} of ${regionRows.length} complete`}
          >
            {regionRows.map(({ tier, count, earned: date }) => (
              <AchievementRow key={tier.id} tier={tier} count={count} earned={date ? monthLabel(date) : null} />
            ))}
          </AchievementGroup>

          <AchievementGroup
            title="All NPS sites"
            meta={`${sitesVisited.length} of ${allSites.length} visited`}
          >
            {siteTiers.map((tier) => {
              const date = siteEarned.get(tier.id);
              return (
                <AchievementRow
                  key={tier.id}
                  tier={tier}
                  count={sitesVisited.length}
                  earned={date ? monthLabel(date) : null}
                />
              );
            })}
          </AchievementGroup>

          <AchievementGroup
            title="Friends"
            meta={`${friends.length} ${friends.length === 1 ? 'friend' : 'friends'} · ${togetherDates.length} together`}
          >
            {friendTiers.map((tier) => {
              const date = friendEarned.get(tier.id);
              return (
                <AchievementRow key={tier.id} tier={tier} count={friends.length} earned={date ? monthLabel(date) : null} />
              );
            })}
            {togetherTiers.map((tier) => {
              const date = togetherEarned.get(tier.id);
              return (
                <AchievementRow
                  key={tier.id}
                  tier={tier}
                  count={togetherDates.length}
                  earned={date ? monthLabel(date) : null}
                />
              );
            })}
          </AchievementGroup>
        </>
      )}
    </ScrollView>

      {/* The filter's menu, over the whole screen so nothing cuts it off,
          dropping from the button; a tap anywhere else closes it. */}
      {filterOpen ? (
        <>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setFilterOpen(false)}
            accessibilityLabel="Close the filter"
          />
          <View style={[styles.menuPlace, { top: menuTop }]}>
        <View style={styles.menu}>
          <BodyText size={10.5} weight="semibold" color={colors.neutral[600]} style={styles.menuHeading}>
            REGION
          </BodyText>
          {[{ id: null as RegionId | null, label: 'All regions' }, ...regions].map((option) => (
            <MenuItem
              key={option.id ?? 'all'}
              label={option.label}
              active={option.id === region}
              onPress={() => {
                setRegion(option.id);
                setFilterOpen(false);
              }}
            />
          ))}
          <View style={styles.menuDivider} />
          <BodyText size={10.5} weight="semibold" color={colors.neutral[600]} style={styles.menuHeading}>
            SHOW
          </BodyText>
          {SHOWS.map((option) => (
            <MenuItem
              key={option.value}
              label={option.label}
              active={option.value === show}
              onPress={() => {
                setShow(option.value);
                setFilterOpen(false);
              }}
            />
          ))}
        </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

/** A group of achievements under its own heading and progress line. */
function AchievementGroup({ title, meta, children }: { title: string; meta: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <Heading size={18}>{title}</Heading>
        <BodyText size={11.5} weight="semibold" color={colors.neutral[600]}>
          {meta}
        </BodyText>
      </View>
      <View style={styles.achievements}>{children}</View>
    </View>
  );
}

function MenuItem({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
    >
      <BodyText
        size={13}
        weight={active ? 'bold' : 'medium'}
        color={active ? colors.accentRamp[700] : colors.neutral[800]}
      >
        {label}
      </BodyText>
      {active ? (
        <Svg width={14} height={14} viewBox="0 0 24 24">
          <Path
            d="M5 12.5l4.5 4.5L19 7.5"
            fill="none"
            stroke={colors.accentRamp[700]}
            strokeWidth={2.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: space[2],
  },
  menuPlace: {
    position: 'absolute',
    right: space[4],
  },
  gutter: {
    paddingHorizontal: space[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  headerText: {
    flex: 1,
  },
  subtitle: {
    marginTop: 2,
  },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    marginTop: space[2],
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[200],
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  tabActive: {
    backgroundColor: colors.accent,
  },
  notice: {
    marginTop: space[4],
    padding: space[4],
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
  },
  mapCard: {
    marginTop: space[4],
    padding: space[3],
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    ...shadow.sm,
  },
  kicker: {
    textTransform: 'uppercase',
    letterSpacing: 1.15,
  },
  mapBox: {
    height: 190,
    marginTop: space[2],
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  mapFill: {
    flex: 1,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[2],
    marginTop: space[6],
  },
  filterBox: {
    marginTop: space[3],
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space[2],
    maxWidth: '100%',
  },
  filterLabel: {
    flexShrink: 1,
  },
  noneShown: {
    marginTop: space[4],
  },
  menu: {
    minWidth: 220,
    padding: 5,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    zIndex: 2,
    ...shadow.md,
  },
  menuHeading: {
    letterSpacing: 1.1,
    paddingTop: 8,
    paddingBottom: 2,
    paddingHorizontal: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
  },
  menuItemPressed: {
    backgroundColor: colors.accentRamp[100],
  },
  menuDivider: {
    height: 1,
    marginVertical: 4,
    marginHorizontal: 12,
    backgroundColor: colors.divider,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    marginTop: space[3],
  },
  footnote: {
    marginTop: space[3],
  },
  group: {
    marginTop: space[4],
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[2],
  },
  achievements: {
    gap: space[3],
    marginTop: space[3],
  },
});
