/**
 * Explore: where the quiz lands. The map fills the screen under search
 * and the key, and the parks come as a deck of cards in a sheet along the
 * bottom. Closed, the sheet is a single bar; dragging the bar up slides
 * the deck into view, folds the key away and moves the map up so both
 * fit, and dragging it down tucks the cards away again.
 *
 * The scope menu under Filter picks what the map shows: the 63 national
 * parks, every site, or just the wishlist. The deck holds the same parks
 * as the map: every park or site with the top 10 dealt first and the rest
 * grouped by region, or the wishlist. The
 * top 10 are always ranked from the 63 parks, and are drawn as numbered
 * pins that match the card numbers. Scrolling through the cards keeps the
 * whole map in view and just highlights each card's pin.
 *
 * Numbers belong to the recommendation engine alone: the filters never
 * change the top 10. They apply only to the 63-park and all-sites views,
 * where matching parks are highlighted in the match colour (unnumbered)
 * and dealt straight after the top 10.
 *
 * Tapping a pin, a card or a search result zooms the map onto that park's
 * region and deals a deck of every park on the map there, the tapped one
 * on top. Scrolling stays in the region and highlights each card's pin;
 * Full map, tapping the card again, or closing the sheet goes back to the
 * whole country.
 *
 * Data comes from the API's GET /sites via src/api/parks.ts.
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { listSites } from '../../api/parks';
// Placeholder ranking, not Dylan's engine - see the banner in this file.
import { provisionalMatches, type ProvisionalMatch } from '../../api/provisionalMatches';
import {
  activeFilterCount,
  BodyText,
  CardCarousel,
  CROWD_CEILING,
  FilterButton,
  FilterSheet,
  Heading,
  Kicker,
  NO_FILTERS,
  ParkCard,
  ParkMap,
  MATCH_DOT,
  PICK_FILL,
  STATUS_DOT,
  type FeedFilters,
} from '../../components';
import type { Site, SiteStatus } from '../../data/parks';
import { REGIONS, regionForState, type Region } from '../../data/regions';
import { useQuiz } from '../../quiz/QuizContext';
import { colors, fonts, radius, shadow, space } from '../../theme';

/** How many recommendations get a numbered pin and a card. */
const TOP_N = 10;

/** Albers USA is roughly 1.6 wide to 1 tall; a touch taller leaves room for Alaska. */
const MAP_ASPECT = 1.5;

/** The sheet's bar, which is all that shows while it is closed. */
const SHEET_BAR = 50;
/** The deck's height, including the cards peeking out behind the top one. */
const DECK_HEIGHT = 214;
const SHEET_HEIGHT = SHEET_BAR + DECK_HEIGHT + space[2];
const SHEET_MS = 260;

/** How many search suggestions to list under the search bar. */
const MAX_SUGGESTIONS = 5;

/** What the map shows. */
type MapScope = 'parks' | 'all' | 'wishlist';

/** Applies the sheet's dials to a ranked list, keeping its order. */
function applyFilters<T extends { site: Site }>(rows: T[], filters: FeedFilters): T[] {
  const ceiling = filters.crowd ? CROWD_CEILING[filters.crowd] : null;

  return rows.filter(({ site }) => {
    // A site missing the data a filter needs doesn't match it.
    if (filters.terrains.length > 0) {
      if (site.group === null || !filters.terrains.includes(site.group)) return false;
    }
    if (filters.maxEffort !== null) {
      if (site.effort === null || site.effort > filters.maxEffort) return false;
    }
    if (ceiling !== null && (site.vis === null || site.vis > ceiling)) return false;
    return true;
  });
}

/** Name matches for the search bar, names that start with the query first. */
function searchSites(sites: Site[], query: string): Site[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const hits = sites.filter((site) => site.name.toLowerCase().includes(q));
  const starts = (site: Site) => (site.name.toLowerCase().startsWith(q) ? 0 : 1);
  return hits.sort((a, b) => starts(a) - starts(b) || a.name.localeCompare(b.name));
}

/** A card in the deck: a park, plus its match and rank when it has them. */
type DeckItem = { site: Site; score?: number; reason?: string; rank?: number };

function toDeckItem(
  site: Site,
  matchById: ReadonlyMap<string, ProvisionalMatch>,
  rankById: ReadonlyMap<string, number>,
): DeckItem {
  const match = matchById.get(site.id);
  return { site, score: match?.score, reason: match?.reason, rank: rankById.get(site.id) };
}

/** Picks first in rank order, then the best matches, then by name. */
function byFit(a: DeckItem, b: DeckItem): number {
  return (
    (a.rank ?? Infinity) - (b.rank ?? Infinity) ||
    (b.score ?? -1) - (a.score ?? -1) ||
    a.site.name.localeCompare(b.site.name)
  );
}

/** Region order from the map key, for dealing the rest of a full deck. */
const REGION_ORDER = new Map(REGIONS.map((region, index) => [region.id, index]));

function regionPosition(site: Site): number {
  const region = regionForState(site.state);
  // Territories have no region and go last.
  return region ? (REGION_ORDER.get(region.id) ?? REGIONS.length) : REGIONS.length;
}

/** Grouped by region in the key's order, best fit first within each. */
function byRegion(a: DeckItem, b: DeckItem): number {
  return regionPosition(a.site) - regionPosition(b.site) || byFit(a, b);
}

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { answers } = useQuiz();

  const [scope, setScope] = useState<MapScope>('parks');
  /**
   * The park tapped or searched for. While set, the map is zoomed onto its
   * region and the deck holds that region's parks.
   */
  const [anchor, setAnchor] = useState<Site | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  /** Which park is on top of the deck, by id, so it survives list changes. */
  const [deckTopId, setDeckTopId] = useState<string | null>(null);
  /** Lets the user reopen the key while the sheet is open. */
  const [keyOpen, setKeyOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchMiss, setSearchMiss] = useState<string | null>(null);
  const [filters, setFilters] = useState<FeedFilters>(NO_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);

  const { data: parks = [] } = useQuery({
    queryKey: ['sites', 'parks'],
    queryFn: () => listSites('parks'),
  });

  const { data: allSites = [] } = useQuery({
    queryKey: ['sites', 'all'],
    queryFn: () => listSites('all'),
  });

  // Scored across every site so wishlist cards and search results have
  // a match too; the picks themselves are drawn from the parks only.
  const { data: matches = [] } = useQuery({
    queryKey: ['provisionalMatches', answers, 'all'],
    queryFn: () => provisionalMatches(answers, 'all'),
  });

  const parkIds = useMemo(() => new Set(parks.map((site) => site.id)), [parks]);
  const parkMatches = useMemo(
    () => matches.filter(({ site }) => parkIds.has(site.id)),
    [matches, parkIds],
  );
  const matchById = useMemo(
    () => new Map(matches.map((match) => [match.site.id, match])),
    [matches],
  );

  // The engine's top 10, untouched by the filters.
  const picks = useMemo(() => parkMatches.slice(0, TOP_N), [parkMatches]);
  const rankById = useMemo(
    () => new Map(picks.map(({ site }, index) => [site.id, index + 1])),
    [picks],
  );
  const filterCount = activeFilterCount(filters);
  /** The filters only apply to the views that show every park or site. */
  const filtersApply = scope === 'parks' || scope === 'all';

  const wishlist = useMemo(() => allSites.filter((site) => site.status === 'wishlist'), [allSites]);

  const mapSites = useMemo(() => {
    if (scope === 'wishlist') return wishlist;
    return scope === 'parks' ? parks : allSites;
  }, [scope, wishlist, parks, allSites]);

  /** The wishlist view deals the wishlist; the others deal every park, picks first. */
  const showingWishlist = scope === 'wishlist';

  /** Unnumbered parks on the map that match the filters, when they apply. */
  const matchIds = useMemo(() => {
    if (!filtersApply || filterCount === 0) return new Set<string>();
    const candidates = mapSites.filter((site) => !rankById.has(site.id)).map((site) => ({ site }));
    return new Set(applyFilters(candidates, filters).map(({ site }) => site.id));
  }, [filtersApply, filterCount, mapSites, rankById, filters]);

  /**
   * The deck before any park is tapped, matching what the map shows: the
   * wishlist, or every park/site with the top 10 first, then any filter
   * matches, then the rest, each group by region.
   */
  const baseDeck = useMemo<DeckItem[]>(() => {
    if (showingWishlist) return wishlist.map((site) => toDeckItem(site, matchById, rankById));

    const top = picks.map(({ site, score, reason }, index) => ({
      site,
      score,
      reason,
      rank: index + 1,
    }));

    const unranked = mapSites
      .filter((site) => !rankById.has(site.id))
      .map((site) => toDeckItem(site, matchById, rankById))
      .sort(byRegion);
    const matched = unranked.filter((item) => matchIds.has(item.site.id));
    const rest = unranked.filter((item) => !matchIds.has(item.site.id));
    return [...top, ...matched, ...rest];
  }, [showingWishlist, wishlist, picks, mapSites, matchById, rankById, matchIds]);

  const focusRegion = anchor ? regionForState(anchor.state) : undefined;

  /** With a park tapped: every park on the map in its region, best fit first. */
  const regionDeck = useMemo<DeckItem[] | null>(() => {
    if (!anchor) return null;
    const inRegion = focusRegion
      ? mapSites.filter((site) => regionForState(site.state)?.id === focusRegion.id)
      : [];
    if (!inRegion.some((site) => site.id === anchor.id)) inRegion.push(anchor);
    return inRegion.map((site) => toDeckItem(site, matchById, rankById)).sort(byFit);
  }, [anchor, focusRegion, mapSites, matchById, rankById]);

  const deck = regionDeck ?? baseDeck;
  const deckIndex = Math.max(
    deck.findIndex((item) => item.site.id === deckTopId),
    0,
  );
  // With the sheet open the map highlights whichever card is on top.
  const topCard = sheetOpen ? deck[deckIndex] : undefined;
  const highlightId = topCard?.site.id ?? null;

  const suggestions = useMemo(
    () => searchSites(allSites, query).slice(0, MAX_SUGGESTIONS),
    [allSites, query],
  );

  function openSheet(open: boolean) {
    setSheetOpen(open);
    setKeyOpen(false);
    // Closing tucks the cards away and returns to the whole map.
    if (!open) setAnchor(null);
  }

  /**
   * Zooms onto a park's region and deals that region's parks with this
   * one on top. If the park is not on the map at the current scope, the
   * scope widens to include it.
   */
  function focusPark(site: Site) {
    if (!mapSites.some((shown) => shown.id === site.id)) {
      setScope(parkIds.has(site.id) ? 'parks' : 'all');
    }
    setAnchor(site);
    setDeckTopId(site.id);
    openSheet(true);
  }

  function pickResult(site: Site) {
    setQuery('');
    setSearchMiss(null);
    Keyboard.dismiss();
    focusPark(site);
  }

  function submitSearch() {
    const [best] = searchSites(allSites, query);
    if (best) pickResult(best);
    else if (query.trim()) setSearchMiss(query.trim());
  }

  const deckTitle = anchor
    ? (focusRegion?.label ?? anchor.name)
    : scope === 'wishlist'
      ? 'Your wishlist'
      : scope === 'parks'
        ? `${parks.length} national parks`
        : `All ${allSites.length} sites`;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space[6] }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Heading size={26}>Explore</Heading>
          <BodyText size={12} color={colors.neutral[600]} style={styles.headerMeta}>
            {scope === 'wishlist'
              ? `Your wishlist · ${wishlist.length} saved`
              : matchIds.size > 0
                ? `Your top ${picks.length} · ${matchIds.size} more match your filters`
                : scope === 'parks'
                  ? `Your top ${picks.length} of ${parks.length} national parks`
                  : `Your top ${picks.length}, plus all ${allSites.length} sites`}
          </BodyText>
        </View>
        <View style={styles.headerActions}>
          <FilterButton
            count={filtersApply ? filterCount : 0}
            onPress={() => setFilterOpen(true)}
            // Filters highlight parks beyond the top 10; the wishlist view
            // has none to highlight.
            disabled={!filtersApply}
          />
          <ScopeMenu
            value={scope}
            parkCount={parks.length}
            siteCount={allSites.length}
            wishlistCount={wishlist.length}
            onChange={(next) => {
              setScope(next);
              setAnchor(null);
              setDeckTopId(null);
            }}
          />
        </View>
      </View>

      {/* Suggestions float over the map rather than pushing it down. */}
      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <TextInput
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setSearchMiss(null);
            }}
            onSubmitEditing={submitSearch}
            placeholder={`Search ${allSites.length} parks and sites`}
            placeholderTextColor={colors.neutral[600]}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search parks"
            style={styles.searchInput}
          />
          {query ? (
            <Pressable
              onPress={() => {
                setQuery('');
                setSearchMiss(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={10}
              style={styles.searchClear}
            >
              <BodyText size={15} weight="semibold" color={colors.neutral[700]}>
                ×
              </BodyText>
            </Pressable>
          ) : null}
        </View>

        {suggestions.length > 0 ? (
          <View style={styles.suggestions}>
            {suggestions.map((site, index) => (
              <Pressable
                key={site.id}
                onPress={() => pickResult(site)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.suggestion,
                  index > 0 && styles.suggestionDivider,
                  pressed && styles.suggestionPressed,
                ]}
              >
                <BodyText size={13.5} weight="medium" color={colors.text}>
                  {site.name}
                </BodyText>
                <BodyText size={11.5} color={colors.neutral[600]}>
                  {`${site.kind} · ${site.state}`}
                </BodyText>
              </Pressable>
            ))}
          </View>
        ) : searchMiss ? (
          <View style={styles.suggestions}>
            <BodyText size={12} color={colors.neutral[700]} style={styles.searchMiss}>
              {`Nothing called "${searchMiss}". Try part of the name.`}
            </BodyText>
          </View>
        ) : null}
      </View>

      {/* The stage: key and map, with the card sheet over its bottom edge. */}
      <View style={styles.stage}>
        <Animated.View
          // The layout transition keeps a stale height when the key's
          // content grows on its own (the filter swatch adds a line), so
          // remount it whenever that swatch comes or goes.
          key={matchIds.size > 0 ? 'key-with-matches' : 'key'}
          layout={LinearTransition.duration(SHEET_MS)}
          style={styles.keyWrap}
        >
          <MapKey
            collapsed={sheetOpen && !keyOpen}
            showMatches={matchIds.size > 0}
            onToggle={sheetOpen ? () => setKeyOpen((open) => !open) : undefined}
          />
        </Animated.View>

        {/* Deliberately not a layout-animated view: the map has to be told
            its new size when the sheet opens, or it overflows under it. */}
        <View style={[styles.mapArea, { paddingBottom: sheetOpen ? SHEET_HEIGHT : SHEET_BAR }]}>
          {focusRegion ? (
            <RegionTitle
              region={focusRegion}
              actionLabel="Full map"
              onAction={() => setAnchor(null)}
            />
          ) : null}
          <ParkMap
            sites={mapSites}
            rankById={rankById}
            matchIds={matchIds}
            selectedId={highlightId}
            // Only a search, a pin tap or a card tap zooms in; scrolling
            // the cards leaves the whole map in view.
            focusRegion={focusRegion?.id ?? null}
            featureIcons={scope === 'parks'}
            onSelectSite={(site) => {
              if (anchor && site.id === highlightId) {
                // Tapping the top card's pin again zooms back out.
                setAnchor(null);
              } else if (regionDeck?.some((item) => item.site.id === site.id)) {
                // Another park in the same region: bring its card to the top.
                setDeckTopId(site.id);
              } else {
                focusPark(site);
              }
            }}
            style={[styles.map, { maxHeight: windowWidth / MAP_ASPECT }]}
          />
        </View>

        <CardSheet
          open={sheetOpen}
          onOpenChange={openSheet}
          title={deckTitle}
          status={deck.length > 0 ? `${deckIndex + 1} of ${deck.length}` : undefined}
        >
          {deck.length > 0 ? (
            <CardCarousel
              items={deck}
              index={deckIndex}
              keyOf={(item) => item.site.id}
              onIndexChange={(index) => setDeckTopId(deck[index].site.id)}
              renderCard={(item, index) => (
                <ParkCard
                  site={item.site}
                  score={item.score}
                  reason={item.reason}
                  rank={item.rank}
                  // The full decks mix saved parks in with everything else.
                  markWishlist={scope === 'parks' || scope === 'all'}
                  onPress={() => {
                    if (index !== deckIndex) {
                      // A neighbour peeking in at the edge: bring it to the centre.
                      setDeckTopId(item.site.id);
                    } else if (anchor) {
                      // Second tap: back to the whole map, on the same card.
                      setAnchor(null);
                    } else {
                      // First tap: zoom onto the card's region.
                      focusPark(item.site);
                    }
                  }}
                  style={styles.deckCard}
                />
              )}
              // The cards' taps depend on these, so redraw them when either changes.
              extraData={`${deckIndex}:${anchor?.id ?? ''}`}
              style={styles.deck}
            />
          ) : (
            <View style={styles.empty}>
              <Heading size={17}>
                {showingWishlist ? 'Nothing saved yet' : 'No parks match'}
              </Heading>
              <BodyText
                size={13}
                lineHeightRatio={1.5}
                color={colors.neutral[700]}
                style={styles.emptyBody}
              >
                {showingWishlist
                  ? 'Parks you add to your wishlist will show up here.'
                  : 'Nothing matched those answers. Widen your terrain or season by retaking the quiz in Settings.'}
              </BodyText>
            </View>
          )}
        </CardSheet>
      </View>

      <FilterSheet
        visible={filterOpen}
        value={filters}
        countFor={(draft) =>
          applyFilters(
            mapSites.filter((site) => !rankById.has(site.id)).map((site) => ({ site })),
            draft,
          ).length
        }
        onApply={(next) => {
          setFilters(next);
          setFilterOpen(false);
        }}
        onClose={() => setFilterOpen(false)}
      />
    </View>
  );
}

/**
 * The sheet along the bottom of the map. Closed, only its bar shows;
 * dragging the bar up (or tapping it) slides the cards into view, and
 * dragging it down tucks them away. Only the bar takes these gestures:
 * wrapping the deck in a second pan stopped its swipes on Android.
 */
function CardSheet({
  open,
  onOpenChange,
  title,
  status,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  status?: string;
  children: ReactNode;
}) {
  const closedY = SHEET_HEIGHT - SHEET_BAR;
  const offset = useSharedValue(open ? 0 : closedY);
  const dragStart = useSharedValue(0);

  // Follow the open state when it changes from outside, e.g. a pin tap.
  useEffect(() => {
    offset.set(withTiming(open ? 0 : closedY, { duration: SHEET_MS }));
  }, [open, closedY, offset]);

  const drag = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .onStart(() => {
      dragStart.set(offset.get());
    })
    .onUpdate((event) => {
      offset.set(Math.min(Math.max(dragStart.get() + event.translationY, 0), closedY));
    })
    .onEnd((event) => {
      // A flick decides it; otherwise whichever end it is nearer.
      const next =
        Math.abs(event.velocityY) > 400 ? event.velocityY < 0 : offset.get() < closedY / 2;
      offset.set(withTiming(next ? 0 : closedY, { duration: SHEET_MS }));
      scheduleOnRN(onOpenChange, next);
    });

  // A tap on the bar toggles it; moving the finger makes it a drag instead.
  const tapBar = Gesture.Tap()
    .maxDistance(10)
    .onEnd((_event, success) => {
      if (success) scheduleOnRN(onOpenChange, !open);
    });

  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));

  return (
    <Animated.View style={[styles.sheet, slide]}>
      <GestureDetector gesture={Gesture.Race(drag, tapBar)}>
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel={open ? `Hide ${title}` : `Show ${title}`}
          onAccessibilityTap={() => onOpenChange(!open)}
          style={styles.sheetBar}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <Heading size={17} numberOfLines={1} style={styles.headerText}>
              {title}
            </Heading>
            <BodyText size={12} weight="semibold" color={colors.accentRamp[700]}>
              {open ? (status ?? '') : 'Swipe up ▴'}
            </BodyText>
          </View>
        </View>
      </GestureDetector>
      <View style={styles.sheetBody}>{children}</View>
    </Animated.View>
  );
}

/** The pill under Filter that opens a menu of map scopes. */
function ScopeMenu({
  value,
  parkCount,
  siteCount,
  wishlistCount,
  onChange,
}: {
  value: MapScope;
  parkCount: number;
  siteCount: number;
  wishlistCount: number;
  onChange: (next: MapScope) => void;
}) {
  const anchor = useRef<View>(null);
  const { width: windowWidth } = useWindowDimensions();
  const [menu, setMenu] = useState<{ top: number; right: number } | null>(null);

  const options: { value: MapScope; short: string; label: string; detail: string }[] = [
    {
      value: 'parks',
      short: `${parkCount} parks`,
      label: `${parkCount} national parks`,
      detail: 'Every national park: your top 10 first, then by region',
    },
    {
      value: 'all',
      short: `All ${siteCount}`,
      label: `All ${siteCount} sites`,
      detail: 'Adds monuments, seashores and more, dealt the same way',
    },
    {
      value: 'wishlist',
      short: 'Wishlist',
      label: `My wishlist (${wishlistCount})`,
      detail: 'Only the parks you have saved, dealt as cards',
    },
  ];
  const current = options.find((option) => option.value === value) ?? options[0];

  function open() {
    // The menu lives in a Modal, so place it from the pill's window position.
    anchor.current?.measureInWindow((x, y, width, height) => {
      setMenu({ top: y + height + 6, right: windowWidth - (x + width) });
    });
  }

  return (
    <>
      <Pressable
        ref={anchor}
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`Map shows: ${current.label}. Change`}
        style={({ pressed }) => [styles.scopePill, pressed && styles.suggestionPressed]}
      >
        <BodyText size={12} weight="semibold" color={colors.accentRamp[700]}>
          {`${current.short} ▾`}
        </BodyText>
      </Pressable>

      <Modal
        visible={menu !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setMenu(null)}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(null)}>
          {menu ? (
            <View style={[styles.scopeMenu, { top: menu.top, right: menu.right }]}>
              <Kicker style={styles.scopeKicker}>Show on map</Kicker>
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      onChange(option.value);
                      setMenu(null);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [
                      styles.scopeOption,
                      active && styles.scopeOptionActive,
                      pressed && styles.suggestionPressed,
                    ]}
                  >
                    <BodyText
                      size={13.5}
                      weight="semibold"
                      color={active ? colors.accentRamp[700] : colors.text}
                    >
                      {option.label}
                    </BodyText>
                    <BodyText size={11.5} color={colors.neutral[600]}>
                      {option.detail}
                    </BodyText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}

/** The region name over a zoomed map, with a way back out of it. */
function RegionTitle({
  region,
  actionLabel,
  onAction,
}: {
  region: Region;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.regionTitle}>
      <View style={[styles.regionTitleSwatch, { backgroundColor: region.fill }]} />
      <Heading size={18} style={styles.regionTitleText}>
        {region.label}
      </Heading>
      <Pressable
        onPress={onAction}
        accessibilityRole="button"
        hitSlop={8}
        style={({ pressed }) => [styles.fullMap, pressed && styles.suggestionPressed]}
      >
        <BodyText size={12} weight="semibold" color={colors.accentRamp[700]}>
          {actionLabel}
        </BodyText>
      </Pressable>
    </View>
  );
}

/**
 * The key above the map: what each pin means, then the region colours.
 * While the card sheet is open it folds to one line, which reopens it.
 */
function MapKey({
  collapsed,
  showMatches,
  onToggle,
}: {
  collapsed: boolean;
  /** Adds the filter-match swatch while filters are highlighting parks. */
  showMatches: boolean;
  onToggle?: () => void;
}) {
  const statuses: SiteStatus[] = ['visited', 'wishlist', 'new'];

  const toggle = onToggle ? (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={collapsed ? 'Show the map key' : 'Hide the map key'}
      hitSlop={10}
    >
      <BodyText size={12} weight="semibold" color={colors.accentRamp[700]}>
        {collapsed ? 'Show ▾' : 'Hide ▴'}
      </BodyText>
    </Pressable>
  ) : null;

  if (collapsed) {
    return (
      <View style={[styles.key, styles.keyCollapsed]}>
        <Kicker>Your pins & regions</Kicker>
        {toggle}
      </View>
    );
  }

  return (
    <View style={styles.key}>
      <View style={styles.keyHead}>
        <Kicker>Your pins</Kicker>
        {toggle}
      </View>
      <View style={styles.keyRow}>
        <View style={styles.keyItem}>
          <View style={styles.pickSwatch}>
            <BodyText size={8} weight="bold" color={colors.neutral[100]}>
              1
            </BodyText>
          </View>
          <BodyText size={11.5} color={colors.neutral[800]}>
            Top 10 for you
          </BodyText>
        </View>
        {showMatches ? (
          <View style={styles.keyItem}>
            <View
              style={[
                styles.matchSwatch,
                { backgroundColor: MATCH_DOT.fill, borderColor: MATCH_DOT.stroke },
              ]}
            />
            <BodyText size={11.5} color={colors.neutral[800]}>
              Matches filters
            </BodyText>
          </View>
        ) : null}
        {statuses.map((status) => (
          <View key={status} style={styles.keyItem}>
            <View
              style={[
                styles.statusSwatch,
                {
                  backgroundColor: STATUS_DOT[status].fill,
                  borderColor: STATUS_DOT[status].stroke,
                },
              ]}
            />
            <BodyText size={11.5} color={colors.neutral[800]}>
              {STATUS_DOT[status].label}
            </BodyText>
          </View>
        ))}
      </View>

      <Kicker style={styles.keyKicker}>Regions</Kicker>
      <View style={styles.regionGrid}>
        {REGIONS.map((region) => (
          <View key={region.id} style={styles.regionItem}>
            <View style={[styles.regionSwatch, { backgroundColor: region.fill }]} />
            <BodyText size={11.5} color={colors.neutral[800]} style={styles.regionLabel}>
              {region.label}
            </BodyText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[3],
    paddingHorizontal: space[4],
  },
  headerText: {
    flex: 1,
  },
  headerMeta: {
    marginTop: 2,
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: space[2],
  },
  scopePill: {
    paddingVertical: 6,
    paddingHorizontal: space[3],
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.accentRamp[100],
  },
  scopeMenu: {
    position: 'absolute',
    width: 250,
    padding: space[2],
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    ...shadow.lg,
  },
  scopeKicker: {
    paddingHorizontal: space[2],
    paddingTop: space[1],
    paddingBottom: space[1],
  },
  scopeOption: {
    paddingVertical: space[2],
    paddingHorizontal: space[2],
    borderRadius: radius.sm,
    gap: 2,
  },
  scopeOptionActive: {
    backgroundColor: colors.accentRamp[100],
  },
  searchWrap: {
    // Above the stage, so the suggestions can hang over the map.
    zIndex: 10,
    elevation: 10,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space[3],
    marginHorizontal: space[4],
    paddingHorizontal: space[4],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
  },
  searchClear: {
    paddingLeft: space[2],
  },
  searchMiss: {
    padding: space[3],
  },
  suggestions: {
    position: 'absolute',
    top: '100%',
    left: space[4],
    right: space[4],
    marginTop: space[2],
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
    overflow: 'hidden',
    ...shadow.sm,
  },
  suggestion: {
    paddingVertical: space[2],
    paddingHorizontal: space[4],
    gap: 1,
  },
  suggestionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  suggestionPressed: {
    backgroundColor: colors.tintText07,
  },
  stage: {
    flex: 1,
    marginTop: space[3],
    // The closed sheet's deck sits below this edge and stays hidden.
    overflow: 'hidden',
  },
  keyWrap: {
    marginHorizontal: space[4],
    overflow: 'hidden',
  },
  mapArea: {
    flex: 1,
  },
  key: {
    padding: space[3],
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
  },
  keyCollapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[2],
  },
  keyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  regionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginTop: space[3],
    marginHorizontal: space[4],
  },
  regionTitleSwatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  regionTitleText: {
    flex: 1,
  },
  fullMap: {
    paddingVertical: 5,
    paddingHorizontal: space[3],
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  keyKicker: {
    marginTop: space[3],
  },
  keyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: space[3],
    rowGap: 6,
    marginTop: 6,
  },
  keyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pickSwatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PICK_FILL,
  },
  matchSwatch: {
    width: 13,
    height: 13,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  statusSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  regionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 5,
    marginTop: 6,
  },
  regionItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: space[2],
  },
  regionSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  regionLabel: {
    flexShrink: 1,
  },
  map: {
    flex: 1,
    width: '100%',
    marginTop: space[2],
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SHEET_HEIGHT,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    ...shadow.lg,
  },
  sheetBar: {
    height: SHEET_BAR,
    paddingHorizontal: space[4],
    paddingTop: space[2],
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[400],
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    marginTop: space[2],
  },
  // Full width, so the carousel's neighbouring cards can peek in at the edges.
  sheetBody: {
    height: DECK_HEIGHT,
  },
  deck: {
    flex: 1,
  },
  deckCard: {
    flex: 1,
  },
  empty: {
    marginHorizontal: space[4],
    padding: space[4],
    borderRadius: radius.card,
    backgroundColor: colors.neutral[100],
    ...shadow.sm,
  },
  emptyBody: {
    marginTop: space[2],
  },
});
