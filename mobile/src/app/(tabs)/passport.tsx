/**
 * Passport, following the prototype's screen: a header with your count,
 * then Stamps or Achievements.
 *
 * Stamps: a progress map, region chips, and a stamp for each national
 * park. Tapping a stamp reopens the latest trip that earned it; tapping an
 * empty one opens the park. Tapping a region on the map picks its chip.
 *
 * Achievements: tiers by the number of parks stamped, each dated by the
 * first visit that earned it.
 *
 * Opened with `park` (a stamp tapped in Relive): shows that park's region
 * on the Stamps tab.
 *
 * A park is stamped once it has a trip entry (trips/TripsContext.tsx), so
 * everything here is worked out from the journal; nothing is stored.
 */

import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listSites } from '../../api/parks';
import { useAuth } from '../../auth/AuthContext';
import { BodyText, Heading, ParkMap, useTabBarSpace } from '../../components';
import { Avatar } from '../../components/Avatar';
import { AchievementRow } from '../../components/passport/AchievementRow';
import { Stamp } from '../../components/passport/Stamp';
import { achievements, earnedDates } from '../../data/achievements';
import type { Site } from '../../data/parks';
import { completedRegions, regionForState, REGIONS, type RegionId } from '../../data/regions';
import { CapTextScale, colors, radius, shadow, space } from '../../theme';
import { monthLabel, useTrips } from '../../trips/TripsContext';

type Tab = 'stamps' | 'achievements';

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
  const { user } = useAuth();
  const { entries, visitedIds, visitSummary } = useTrips();

  const [tab, setTab] = useState<Tab>('stamps');
  const [region, setRegion] = useState<RegionId | null>(null);
  const params = useLocalSearchParams<{ park?: string }>();

  const { data: sharedParks = [], isPending, isError } = useQuery({
    queryKey: ['sites', 'parks'],
    queryFn: () => listSites('parks'),
  });

  // Visited comes from the journal, as on Explore.
  const parks = useMemo(
    () =>
      sharedParks
        .map((site): Site => (visitedIds.has(site.id) ? { ...site, status: 'visited' } : site))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [sharedParks, visitedIds],
  );
  const stamped = parks.filter((site) => site.status === 'visited');
  const completed = useMemo(() => completedRegions(parks), [parks]);

  // Only regions with a park in them get a chip.
  const regions = useMemo(
    () => REGIONS.filter((r) => parks.some((site) => regionForState(site.state)?.id === r.id)),
    [parks],
  );
  const shown = region ? parks.filter((site) => regionForState(site.state)?.id === region) : parks;
  const shownStamped = shown.filter((site) => site.status === 'visited').length;

  const tiers = useMemo(() => achievements(parks.length), [parks.length]);
  const earned = useMemo(() => {
    // Entries are newest first, so the last one seen per park is its first visit.
    const first = new Map<string, string>();
    const parkIds = new Set(parks.map((site) => site.id));
    for (const entry of entries) if (parkIds.has(entry.siteId)) first.set(entry.siteId, entry.date);
    return earnedDates(tiers, [...first.values()]);
  }, [entries, parks, tiers]);

  // Sent here for a park: its region's stamps, once the parks are in.
  // Adjusted as it renders rather than in an effect; the request is then
  // cleared so the same park can be asked for again.
  const [shownPark, setShownPark] = useState<string | undefined>(undefined);
  if (params.park !== shownPark && (!params.park || sharedParks.length > 0)) {
    setShownPark(params.park);
    if (params.park) {
      const site = sharedParks.find((p) => p.id === params.park);
      setTab('stamps');
      setRegion((site && regionForState(site.state)?.id) ?? null);
    }
  }
  useEffect(() => {
    if (params.park && shownPark === params.park) router.setParams({ park: undefined });
  }, [params.park, shownPark, router]);

  const stampSize = Math.floor((width - space[4] * 2 - GAP * 2) / 3);

  function openStamp(site: Site) {
    const summary = visitSummary(site.id);
    if (summary) router.navigate({ pathname: '/trips', params: { entry: summary.entry.id } });
    else router.push(`/site/${site.id}`);
  }

  return (
    <ScrollView
      style={styles.screen}
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
        {user ? <Avatar person={user} size={40} /> : null}
      </View>

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
                onSelectRegion={setRegion}
                onSelectSite={openStamp}
                style={styles.mapFill}
              />
            </View>
          </View>

          <View style={styles.sectionHead}>
            <BodyText size={10.5} weight="semibold" color={colors.neutral[600]} style={styles.kicker}>
              {region ? REGIONS.find((r) => r.id === region)?.label : 'The national parks'}
            </BodyText>
            <BodyText size={12} weight="bold" color={colors.accentRamp[700]}>
              {`${shownStamped} of ${shown.length} stamped`}
            </BodyText>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipRail}
            contentContainerStyle={styles.chips}
          >
            {[{ id: null, label: 'All regions' }, ...regions].map((option) => {
              const active = option.id === region;
              return (
                <Pressable
                  key={option.id ?? 'all'}
                  onPress={() => setRegion(option.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <BodyText
                    size={11}
                    weight="semibold"
                    color={active ? colors.neutral[100] : colors.neutral[700]}
                  >
                    {option.label}
                  </BodyText>
                </Pressable>
              );
            })}
          </ScrollView>

          <CapTextScale max={1.1}>
            <View style={styles.grid}>
              {shown.map((site) => {
                const summary = visitSummary(site.id);
                return (
                  <Stamp
                    key={site.id}
                    site={site}
                    visited={summary ? monthLabel(summary.last) : null}
                    size={stampSize}
                    onPress={() => openStamp(site)}
                  />
                );
              })}
            </View>
          </CapTextScale>

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
              {`${earned.size} of ${tiers.length} earned`}
            </BodyText>
          </View>
          <View style={styles.achievements}>
            {tiers.map((tier) => {
              const date = earned.get(tier.need);
              return (
                <AchievementRow
                  key={tier.need}
                  tier={tier}
                  count={stamped.length}
                  earned={date ? monthLabel(date) : null}
                />
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
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
    marginTop: space[3],
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[200],
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
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
  chipRail: {
    marginTop: space[2],
    // Run the chips to the screen's edges, past the gutter.
    marginHorizontal: -space[4],
  },
  chips: {
    gap: 6,
    paddingHorizontal: space[4],
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.neutral[400],
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
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
  achievements: {
    gap: space[3],
    marginTop: space[3],
  },
});
