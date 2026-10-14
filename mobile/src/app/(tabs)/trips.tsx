/**
 * Trips: your journal, following the prototype's screen. A header with the
 * count and New entry, sort chips (newest, oldest, by region), then the
 * entries as a sideways rail of cards that turn away in 3D either side of
 * the one in view, with arrows and dots under it.
 *
 * Every entry logs a visit, which is what marks a park visited across the
 * app. Entries live on the device for now (trips/TripsContext.tsx) until
 * the trips backend exists.
 *
 * Opened from a visited park's card: `entry` scrolls to that entry, and
 * `add` starts a new one for that park.
 */

import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type FlatList,
} from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { listSites } from "../../api/parks";
import { useAuth } from "../../auth/AuthContext";
import {
  BodyText,
  Button,
  Heading,
  Toast,
  useTabBarSpace,
} from "../../components";
import { Avatar } from "../../components/Avatar";
import { NewEntrySheet } from "../../components/trips/NewEntrySheet";
import { TripCard } from "../../components/trips/TripCard";
import type { Site } from "../../data/parks";
import { regionForState } from "../../data/regions";
import { colors, radius, space } from "../../theme";
import { useTrips, type TripEntry } from "../../trips/TripsContext";

type Sort = "new" | "old" | "region";

const SORTS: { value: Sort; label: string }[] = [
  { value: "new", label: "Newest first" },
  { value: "old", label: "Oldest first" },
  { value: "region", label: "By region" },
];

/** Space between cards in the rail. */
const GAP = 8;

export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { entries, visitedIds, remove } = useTrips();
  const params = useLocalSearchParams<{ entry?: string; add?: string }>();

  const [sort, setSort] = useState<Sort>("new");
  const [index, setIndex] = useState(0);
  const [sheet, setSheet] = useState<{ open: boolean; siteId?: string }>({
    open: false,
  });
  const [toast, setToast] = useState<string | null>(null);
  const rail = useRef<FlatList<TripEntry>>(null);
  const scrollX = useSharedValue(0);

  const { data: sites = [] } = useQuery({
    queryKey: ["sites", "all"],
    queryFn: () => listSites("all"),
  });
  const siteById = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);

  // Cards fill 84% of the width, the neighbours peeking in either side.
  const cardWidth = Math.round(width * 0.84);
  const interval = cardWidth + GAP;
  const side = (width - cardWidth) / 2;

  const sorted = useMemo(() => {
    const list = entries.slice();
    if (sort === "old") return list.reverse();
    if (sort === "region") {
      const regionOf = (e: TripEntry) => {
        const site = siteById.get(e.siteId);
        return (site && regionForState(site.state)?.label) ?? "~";
      };
      return list.sort((a, b) => regionOf(a).localeCompare(regionOf(b)));
    }
    return list;
  }, [entries, sort, siteById]);

  function goTo(i: number, animated = true) {
    const clamped = Math.max(0, Math.min(i, sorted.length - 1));
    rail.current?.scrollToOffset({ offset: clamped * interval, animated });
    setIndex(clamped);
  }

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  }

  // Opened from a park's card: show its entry, or start one for it.
  useEffect(() => {
    if (params.entry) {
      const at = sorted.findIndex((e) => e.id === params.entry);
      if (at >= 0) requestAnimationFrame(() => goTo(at, false));
      router.setParams({ entry: undefined });
    }
    // Only when sent here with a request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.entry]);
  // Sent here to log a park (from a card with no entry yet): the sheet
  // opens for it until closed.
  const sheetOpen = sheet.open || !!params.add;
  const sheetSiteId = params.add ?? sheet.siteId;
  function closeSheet() {
    setSheet({ open: false });
    if (params.add) router.setParams({ add: undefined });
  }

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  function confirmDelete(entry: TripEntry, site: Site | undefined) {
    Alert.alert(entry.title, site?.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete entry",
        style: "destructive",
        onPress: () =>
          Alert.alert(
            "Delete this entry?",
            "Its photos and notes go with it.",
            [
              { text: "Keep", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                  await remove(entry.id);
                  setIndex((i) => Math.max(0, Math.min(i, sorted.length - 2)));
                },
              },
            ],
          ),
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space[2],
          paddingBottom: tabSpace + space[6],
        }}
      >
        <View style={[styles.header, styles.gutter]}>
          <View style={styles.headerText}>
            <Heading size={26}>Trips</Heading>
            <BodyText
              size={12}
              color={colors.neutral[600]}
              style={styles.subtitle}
            >
              {`${entries.length} ${entries.length === 1 ? "entry" : "entries"} · ${visitedIds.size} ${visitedIds.size === 1 ? "park" : "parks"} logged`}
            </BodyText>
          </View>
          <Button
            label="New entry"
            onPress={() => setSheet({ open: true })}
            style={styles.newEntry}
          />
          {user ? <Avatar person={user} size={40} /> : null}
        </View>

        <View style={styles.toastSlot} pointerEvents="none">
          <Toast message={toast} />
        </View>

        {sorted.length > 0 ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.sorts, styles.gutter]}
            >
              {SORTS.map((option) => {
                const active = option.value === sort;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      setSort(option.value);
                      goTo(0, false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.sort, active && styles.sortActive]}
                  >
                    <BodyText
                      size={11.5}
                      weight="semibold"
                      color={active ? colors.neutral[100] : colors.neutral[700]}
                    >
                      {option.label}
                    </BodyText>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Animated.FlatList
              ref={rail}
              data={sorted}
              keyExtractor={(entry) => entry.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={interval}
              decelerationRate="fast"
              onScroll={onScroll}
              scrollEventThrottle={16}
              onMomentumScrollEnd={(event) =>
                setIndex(
                  Math.round(event.nativeEvent.contentOffset.x / interval),
                )
              }
              getItemLayout={(_data, i) => ({
                length: interval,
                offset: interval * i,
                index: i,
              })}
              contentContainerStyle={{
                paddingHorizontal: side,
                paddingVertical: space[3],
              }}
              ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
              renderItem={({ item, index: i }) => (
                <TripCard
                  entry={item}
                  site={siteById.get(item.siteId)}
                  index={i}
                  interval={interval}
                  width={cardWidth}
                  scrollX={scrollX}
                  onDelete={() =>
                    confirmDelete(item, siteById.get(item.siteId))
                  }
                />
              )}
            />

            {sorted.length > 1 ? (
              <View style={styles.nav}>
                <Arrow
                  direction="back"
                  onPress={() => goTo(index - 1)}
                  disabled={index === 0}
                />
                <View style={styles.dots}>
                  {sorted.map((entry, i) => (
                    <Pressable
                      key={entry.id}
                      onPress={() => goTo(i)}
                      hitSlop={6}
                      accessibilityLabel={`Entry ${i + 1}: ${entry.title}`}
                      style={[styles.dot, i === index && styles.dotActive]}
                    />
                  ))}
                </View>
                <Arrow
                  direction="forward"
                  onPress={() => goTo(index + 1)}
                  disabled={index === sorted.length - 1}
                />
              </View>
            ) : null}
          </>
        ) : (
          <View style={[styles.empty, styles.gutterMargin]}>
            <Heading size={18}>No trips yet</Heading>
            <BodyText
              size={13}
              lineHeightRatio={1.5}
              color={colors.neutral[700]}
            >
              Log a park you&apos;ve been to: a title, a few notes, who was with
              you and some photos. Each entry marks that park visited on your
              map and in your Passport.
            </BodyText>
            <Button
              label="Write your first entry"
              onPress={() => setSheet({ open: true })}
              style={styles.emptyButton}
            />
          </View>
        )}
      </ScrollView>

      {sheetOpen ? (
        <NewEntrySheet
          initialSiteId={sheetSiteId}
          onClose={closeSheet}
          onSaved={(entry) => {
            closeSheet();
            setSort("new");
            // The new entry is newest unless it's for an earlier month.
            const at = Math.max(
              0,
              entries.findIndex((e) => e.date < entry.date),
            );
            requestAnimationFrame(() => goTo(at, false));
            flash(
              `Entry saved. ${siteById.get(entry.siteId)?.name ?? "The park"} is now visited.`,
            );
          }}
        />
      ) : null}
    </View>
  );
}

function Arrow({
  direction,
  disabled,
  onPress,
}: {
  direction: "back" | "forward";
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={
        direction === "back" ? "Previous entry" : "Next entry"
      }
      style={({ pressed }) => [
        styles.arrow,
        pressed && styles.arrowPressed,
        disabled && styles.arrowOff,
      ]}
    >
      <Svg width={16} height={16} viewBox="0 0 24 24">
        <Path
          d={
            direction === "back" ? "M14.5 5L8 12l6.5 7" : "M9.5 5L16 12l-6.5 7"
          }
          fill="none"
          stroke={colors.neutral[700]}
          strokeWidth={2.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
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
  gutterMargin: {
    marginHorizontal: space[4],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
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
  toastSlot: {
    minHeight: 8,
    alignItems: "center",
  },
  sorts: {
    gap: 6,
    marginTop: space[2],
  },
  sort: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.neutral[400],
  },
  sortActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space[3],
    marginTop: space[2],
  },
  arrow: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.neutral[400],
  },
  arrowPressed: {
    backgroundColor: colors.neutral[200],
  },
  arrowOff: {
    opacity: 0.35,
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[400],
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.accent,
  },
  empty: {
    gap: space[2],
    marginTop: space[4],
    padding: space[4],
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
  },
  emptyButton: {
    alignSelf: "flex-start",
    marginTop: space[2],
  },
});
