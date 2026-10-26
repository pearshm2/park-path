/**
 * Trips: your journal. A header with the count and New entry, a filter
 * button for the order (newest, oldest, by region) and Relive all, then
 * the entries as memory bubbles: a list that zigzags down, settling on
 * one bubble at a time, large and sharp just under the header, the rest
 * small and hazy out to the sides until you reach them
 * (components/trips/MemoryBubble.tsx). Each bubble's Relive button plays
 * just that trip; Relive all plays them all.
 *
 * The list fills the whole screen and the header floats over it, as the
 * tab bar does at the bottom, so memories scrolled past glide up behind
 * the header and leave at the top of the screen.
 *
 * Every entry logs a visit, which is what marks a park visited across the
 * app. Entries sync with the server (trips/TripsContext.tsx); their photos
 * and videos stay on the phone until uploads to S3 are wired up.
 *
 * Opened from a visited park's card: `entry` scrolls to that entry, and
 * `add` starts a new one for that park.
 */

import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type FlatList,
} from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { listSites } from '../../api/parks';
import { BodyText, Button, Dialog, FilterButton, Heading, Toast, useTabBarSpace } from '../../components';
import { diveParam } from '../../components/trips/DiveIn';
import { MemoryBubble } from '../../components/trips/MemoryBubble';
import { PassportStampViewer } from '../../components/trips/PassportPage';
import { NewEntrySheet } from '../../components/trips/NewEntrySheet';
import type { Site } from '../../data/parks';
import { regionForState } from '../../data/regions';
import { useCelebrations } from '../../celebrations/CelebrationsContext';
import { playSound } from '../../lib/sounds';
import { sampleEntries } from '../../trips/sampleTrips';
import { colors, radius, shadow, space } from '../../theme';
import { dateLabel, useTrips, type TripEntry } from '../../trips/TripsContext';

type Sort = 'new' | 'old' | 'region';

const SORTS: { value: Sort; label: string }[] = [
  { value: 'new', label: 'Newest first' },
  { value: 'old', label: 'Oldest first' },
  { value: 'region', label: 'By region' },
];

/** The gap between bubbles, as a share of the bubble in the middle. */
const ROW_SHARE = 0.72;

export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { entries, visitedIds, remove, addEntries } = useTrips();
  const { celebrate } = useCelebrations();
  const params = useLocalSearchParams<{ entry?: string; add?: string }>();

  const [sort, setSort] = useState<Sort>('new');
  const [sheet, setSheet] = useState<{ open: boolean; siteId?: string }>({
    open: false,
  });
  const [toast, setToast] = useState<string | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  /** Where the order button's row ends (from the top of the screen, its
   *  layout already counting the header's padding), to open its menu under it. */
  const [sortBottom, setSortBottom] = useState(0);
  /** The bubble the list has settled on. */
  const [focus, setFocus] = useState(0);
  /**
   * A memory's options, then (asking to delete) the warning: one dialog
   * whose contents change, so the warning shows at once rather than after
   * one popup closes and another opens.
   */
  const [options, setOptions] = useState<{ entry: TripEntry; step: 'options' | 'delete' } | null>(
    null,
  );
  const [editing, setEditing] = useState<TripEntry | null>(null);
  // The trip whose passport-book stamp photo is open.
  const [stampOf, setStampOf] = useState<TripEntry | null>(null);
  /** The screen's and the floating header's heights, once laid out; the
   *  bubbles are sized and placed from them. */
  const [screenHeight, setScreenHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const list = useRef<FlatList<TripEntry>>(null);
  const scrollY = useSharedValue(0);

  const { data: sites = [] } = useQuery({
    queryKey: ['sites', 'all'],
    queryFn: () => listSites('all'),
  });
  const siteById = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);

  // The list runs under both the header and the tab bar. The bubble in
  // focus sits just under the header, with the small ones coming up below.
  const visible = Math.max(0, screenHeight - headerHeight - tabSpace);
  const diameter = Math.round(Math.min(width * 0.86, visible * 0.6));
  const rowHeight = Math.round(diameter * ROW_SHARE);
  const swing = width * 0.24;
  const focusY = headerHeight + space[2] + diameter / 2;
  const ready = rowHeight > 0 && headerHeight > 0;

  const sorted = useMemo(() => {
    const list = entries.slice();
    if (sort === 'old') return list.reverse();
    if (sort === 'region') {
      const regionOf = (e: TripEntry) => {
        const site = siteById.get(e.siteId);
        return (site && regionForState(site.state)?.label) ?? '~';
      };
      return list.sort((a, b) => regionOf(a).localeCompare(regionOf(b)));
    }
    return list;
  }, [entries, sort, siteById]);

  const sortLabel = SORTS.find((o) => o.value === sort)?.label ?? '';

  function goTo(i: number, animated = true) {
    const clamped = Math.max(0, Math.min(i, sorted.length - 1));
    list.current?.scrollToOffset({ offset: clamped * rowHeight, animated });
    setFocus(clamped);
  }

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  }

  // Opened from a park's card: show its entry, or start one for it.
  useEffect(() => {
    if (params.entry && ready) {
      const at = sorted.findIndex((e) => e.id === params.entry);
      if (at >= 0) requestAnimationFrame(() => goTo(at, false));
      router.setParams({ entry: undefined });
    }
    // Only when sent here with a request, once the list has its size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.entry, ready]);
  // Sent here to log a park (from a card with no entry yet): the sheet
  // opens for it until closed.
  const sheetOpen = sheet.open || !!params.add;
  const sheetSiteId = params.add ?? sheet.siteId;
  function closeSheet() {
    setSheet({ open: false });
    if (params.add) router.setParams({ add: undefined });
  }

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  function relive(entry: TripEntry) {
    router.push({ pathname: '/relive', params: { only: entry.id } });
  }

  // Dive into the bubble in the middle: Relive grows it to fill the screen
  // and carries its words to their places. It's centred at focusY; worked
  // out rather than measured, since Android's window measure leaves out
  // the status bar.
  function diveInto(entry: TripEntry) {
    playSound('whoosh');
    const dive = diveParam({ x: (width - diameter) / 2, y: focusY - diameter / 2, size: diameter });
    router.push({ pathname: '/relive', params: { only: entry.id, dive } });
  }

  return (
    <View
      style={styles.screen}
      onLayout={(event) => {
        const height = event.nativeEvent.layout.height;
        setScreenHeight((h) => (Math.abs(h - height) > 1 ? height : h));
      }}
    >
      {sorted.length > 0 ? (
        <View style={StyleSheet.absoluteFill}>
          {ready ? (
            <Animated.FlatList
              ref={list}
              data={sorted}
              keyExtractor={(entry) => entry.id}
              showsVerticalScrollIndicator={false}
              // The bubbles spill past their rows; keep them drawn.
              removeClippedSubviews={false}
              onScrollBeginDrag={() => setSortOpen(false)}
              onMomentumScrollEnd={(event) =>
                setFocus(Math.round(event.nativeEvent.contentOffset.y / rowHeight))
              }
              snapToInterval={rowHeight}
              decelerationRate="fast"
              onScroll={onScroll}
              scrollEventThrottle={16}
              getItemLayout={(_data, i) => ({ length: rowHeight, offset: rowHeight * i, index: i })}
              contentContainerStyle={{
                paddingTop: focusY - rowHeight / 2,
                paddingBottom: screenHeight - focusY - rowHeight / 2,
              }}
              renderItem={({ item, index: i }) => (
                <MemoryBubble
                  entry={item}
                  site={siteById.get(item.siteId)}
                  index={i}
                  height={rowHeight}
                  diameter={diameter}
                  swing={swing}
                  focused={i === focus}
                  scrollY={scrollY}
                  onFocus={() => goTo(i)}
                  onPlay={() => diveInto(item)}
                  onOptions={() => setOptions({ entry: item, step: 'options' })}
                  onPassportStamp={() => setStampOf(item)}
                />
              )}
            />
          ) : null}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: tabSpace + space[6] }}
        >
          <View style={[styles.empty, styles.gutterMargin]}>
            <Heading size={18}>No trips yet</Heading>
            <BodyText size={13} lineHeightRatio={1.5} color={colors.neutral[700]}>
              Log a park you&apos;ve been to: a title, a few notes, who was with you and some
              photos. Each entry marks that park visited on your map and in your Passport.
            </BodyText>
            <Button
              label="Write your first entry"
              onPress={() => setSheet({ open: true })}
              style={styles.emptyButton}
            />
            {/* Development builds only: fill a fresh account to try things out. */}
            {__DEV__ ? (
              <Button
                label="Load sample trips"
                variant="secondary"
                onPress={() => addEntries(sampleEntries(sites))}
                disabled={sites.length === 0}
                style={styles.sampleButton}
              />
            ) : null}
          </View>
        </ScrollView>
      )}

      {/* The header floats over the list. Its wash keeps the words
          readable while memories glide up behind it. */}
      <View
        style={styles.top}
        pointerEvents="box-none"
        onLayout={(event) => {
          const height = event.nativeEvent.layout.height;
          setHeaderHeight((h) => (Math.abs(h - height) > 1 ? height : h));
        }}
      >
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none" preserveAspectRatio="none" viewBox="0 0 1 1">
          <Defs>
            <LinearGradient id="headerWash" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.bg} stopOpacity={0.9} />
              <Stop offset="0.6" stopColor={colors.bg} stopOpacity={0.6} />
              <Stop offset="1" stopColor={colors.bg} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="1" height="1" fill="url(#headerWash)" />
        </Svg>
        <View style={{ paddingTop: insets.top + space[2] }} pointerEvents="box-none">
          <View style={[styles.header, styles.gutter]}>
            <View style={styles.headerText}>
              <Heading size={26}>Trips</Heading>
              <BodyText size={12} color={colors.neutral[600]} style={styles.subtitle}>
                {`${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} · ${visitedIds.size} ${visitedIds.size === 1 ? 'park' : 'parks'} logged`}
              </BodyText>
            </View>
            <Button label="New entry" onPress={() => setSheet({ open: true })} style={styles.newEntry} />
          </View>
          {sorted.length > 0 ? (
            <>
              <View
                style={[styles.controls, styles.gutter]}
                onLayout={(event) => {
                  const { y, height } = event.nativeEvent.layout;
                  setSortBottom(y + height);
                }}
              >
                <Pressable
                  onPress={() => setSortOpen((open) => !open)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: sortOpen }}
                  accessibilityLabel={`Order: ${sortLabel}. Change`}
                  style={styles.sortButton}
                >
                  <View pointerEvents="none">
                    <FilterButton count={sort === 'new' ? 0 : 1} onPress={() => {}} />
                  </View>
                  <BodyText size={12.5} weight="semibold" color={colors.neutral[700]}>
                    {sortLabel}
                  </BodyText>
                </Pressable>
              </View>
              {/* A line of its own, under the order. */}
              <View style={[styles.reliveRow, styles.gutter]}>
                <Pressable
                  onPress={() => router.push('/relive')}
                  accessibilityRole="button"
                  accessibilityLabel="Relive all your trips as a story"
                  style={({ pressed }) => [styles.relive, pressed && styles.relivePressed]}
                >
                  <Svg width={11} height={11} viewBox="0 0 24 24">
                    <Path d="M7 4.5v15l12-7.5z" fill={colors.accentRamp[700]} />
                  </Svg>
                  <BodyText size={11.5} weight="semibold" color={colors.accentRamp[700]}>
                    Relive all
                  </BodyText>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>
      </View>

      {/* Outside the header, which only takes touches inside its bounds. */}
      {sortOpen ? (
        <View style={[styles.menu, { top: sortBottom + 4 }]}>
          {SORTS.map((option) => {
            const active = option.value === sort;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  setSort(option.value);
                  setSortOpen(false);
                  goTo(0, false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
              >
                <BodyText
                  size={13}
                  weight={active ? 'bold' : 'medium'}
                  color={active ? colors.accentRamp[700] : colors.neutral[800]}
                >
                  {option.label}
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
          })}
        </View>
            ) : null}

      <View style={[styles.toastSlot, { top: insets.top + 64 }]} pointerEvents="none">
        <Toast message={toast} />
      </View>

      {stampOf?.passportStamp ? (
        <PassportStampViewer
          uri={stampOf.passportStamp}
          park={siteById.get(stampOf.siteId)?.name ?? stampOf.siteId}
          date={stampOf.date}
          onClose={() => setStampOf(null)}
        />
      ) : null}

      {/* A memory's options, then a warning before it's deleted for good. */}
      <Dialog
        visible={!!options}
        // Low, so the memory it's about stays in view above it.
        placement="bottom"
        onDismiss={() => setOptions(null)}
        {...(options?.step === 'delete'
          ? {
              icon: <WarningIcon />,
              title: 'Delete this memory?',
              message: `“${options.entry.title}” and its photos and notes will be gone for good. Once it's deleted, you can't get it back.`,
              actions: [
                {
                  label: 'Delete forever',
                  tone: 'danger' as const,
                  onPress: () => {
                    const { entry } = options;
                    setOptions(null);
                    void remove(entry.id);
                    flash('Memory deleted.');
                  },
                },
                { label: 'Keep it', tone: 'cancel' as const, onPress: () => setOptions(null) },
              ],
            }
          : {
              title: options?.entry.title ?? '',
              message: options ? optionsLine(options.entry, siteById.get(options.entry.siteId)) : undefined,
              actions: [
                {
                  label: 'Relive this memory',
                  onPress: () => {
                    const entry = options?.entry;
                    setOptions(null);
                    if (!entry) return;
                    // The same dive as the bubble's play button: options are
                    // only on the bubble in the middle, which it dives from.
                    if (sorted[focus]?.id === entry.id) diveInto(entry);
                    else relive(entry);
                  },
                },
                {
                  label: 'Edit memory',
                  onPress: () => {
                    setEditing(options?.entry ?? null);
                    setOptions(null);
                  },
                },
                {
                  label: 'Delete memory',
                  tone: 'danger' as const,
                  onPress: () => setOptions((o) => (o ? { ...o, step: 'delete' } : o)),
                },
                { label: 'Cancel', tone: 'cancel' as const, onPress: () => setOptions(null) },
              ],
            })}
      />

      {editing ? (
        <NewEntrySheet
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            flash('Memory updated.');
          }}
        />
      ) : null}
      {sheetOpen ? (
        <NewEntrySheet
          initialSiteId={sheetSiteId}
          onClose={closeSheet}
          onSaved={(entry) => {
            closeSheet();
            // A national park stamped for the first time: go and see the
            // stamp go down (and what else it earned) in Passport.
            const stamp = celebrate({
              siteId: entry.siteId,
              visitedBefore: visitedIds,
              parks: sites.filter((s) => s.isNamedPark),
              allSites: sites,
            });
            if (stamp) {
              router.navigate({ pathname: '/passport', params: { show: 'stamp', park: stamp } });
              return;
            }
            setSort('new');
            // The new entry is newest unless it's for an earlier date.
            const at = Math.max(
              0,
              entries.findIndex((e) => e.date < entry.date),
            );
            requestAnimationFrame(() => goTo(at, false));
            flash(`Entry saved. ${siteById.get(entry.siteId)?.name ?? 'The park'} is now visited.`);
          }}
        />
      ) : null}
    </View>
  );
}

/** "Rocky Mountain · Aug 9, 2025", under a memory's title in its options. */
function optionsLine(entry: TripEntry, site: Site | undefined): string {
  return `${site?.name ?? entry.siteId} · ${dateLabel(entry.date)}`;
}

/** A warning sign, over the delete confirmation. */
function WarningIcon() {
  return (
    <View style={styles.warning}>
      <Svg width={26} height={26} viewBox="0 0 24 24">
        <Path
          d="M12 3.5L2.8 19.5h18.4L12 3.5z"
          fill="none"
          stroke={colors.accentRamp[700]}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
        <Path d="M12 9.5v4.5" stroke={colors.accentRamp[700]} strokeWidth={2.4} strokeLinecap="round" />
        <Path d="M12 16.8v.1" stroke={colors.accentRamp[700]} strokeWidth={2.8} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  warning: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.accentRamp[100],
  },
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  gutter: {
    paddingHorizontal: space[4],
  },
  gutterMargin: {
    marginHorizontal: space[4],
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
  newEntry: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  // Floats over the screen; in the flow, the hidden toast held a gap
  // under the header.
  toastSlot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 3,
  },
  // Above the list, so the order menu opens over the bubbles.
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space[2],
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  reliveRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: space[2],
  },
  menu: {
    position: 'absolute',
    left: space[4],
    minWidth: 190,
    padding: 5,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    ...shadow.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
  },
  menuItemPressed: {
    backgroundColor: colors.accentRamp[100],
  },
  relive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.accentRamp[100],
  },
  relivePressed: {
    backgroundColor: colors.accentRamp[200],
  },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: space[3],
  },
  empty: {
    gap: space[2],
    marginTop: space[4],
    padding: space[4],
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
  },
  emptyButton: {
    alignSelf: 'flex-start',
    marginTop: space[2],
  },
  sampleButton: {
    alignSelf: 'flex-start',
  },
});
