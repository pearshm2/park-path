/**
 * Explore: where the quiz lands. The map fills the screen under search
 * and the key, and the parks come as a deck of cards in a sheet along the
 * bottom. Closed, the sheet is a single bar; dragging the bar up slides
 * the deck into view, folds the key away and moves the map up so both
 * fit, and dragging it down tucks the cards away again.
 *
 * The scope menu under Filter picks what the map shows: the 63 national
 * parks, every site, just the wishlist, or just the sites you've visited.
 * The deck holds the same parks as the map: every park or site with the
 * top 10 dealt first and the rest grouped by region, or the wishlist, or
 * your visits, latest first. The
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
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { listSites } from '../../api/parks';
import { useRecommendations, type Recommendation } from '../../api/recommendations';
import {
  activeFilterCount,
  BodyText,
  ExpandIcon,
  CROWD_CEILING,
  FilterButton,
  FilterSheet,
  FullMapView,
  turnSideways,
  Heading,
  Kicker,
  NO_FILTERS,
  ParkCard,
  ParkMap,
  SearchButton,
  useTabBarSpace,
  SectionDeck,
  SECTION_PEEK,
  type DeckSection,
  SearchPanel,
  MATCH_DOT,
  PICK_FILL,
  STATUS_DOT,
  type FeedFilters,
} from '../../components';
import type { Site, SiteStatus } from '../../data/parks';
import { useTrips, type TripEntry } from '../../trips/TripsContext';
import {
  completedRegions,
  REGIONS,
  regionForState,
  type Region,
  type RegionId,
} from '../../data/regions';
import { useCelebrations } from '../../celebrations/CelebrationsContext';
import { useSnoozed } from '../../wishlist/useSnoozed';
import { useWishlist } from '../../wishlist/useWishlist';
import { CapTextScale, colors, radius, shadow, space, useTextScale } from '../../theme';

/** Where the "something different" pick goes among them (0-based: #4). */
const DIFFERENT_AT = 3;
/** How many recommendations get a numbered pin and a card. */
const TOP_N = 10;
/** Stand-ins while a query has no data, kept stable so memos don't rerun. */
const NO_SITES: Site[] = [];
const NO_MATCHES: Recommendation[] = [];

/** Albers USA is roughly 1.6 wide to 1 tall; a touch taller leaves room for Alaska. */
const MAP_ASPECT = 1.5;

/** The sheet's bar, which is all that shows while it is closed. */
const SHEET_BAR = 50;
/**
 * With the sheet down, how the spare height splits above and below the
 * map (and its full-screen button). The map's width caps its height, so on
 * a tall phone there's room to spare; more of it goes below, which sits
 * the map up near the key it belongs with.
 */
const SPARE_ABOVE = 1;
const SPARE_BELOW = 6;
/**
 * The most the key opens out (in total, spread over its padding and row
 * gaps) when the screen has height to spare, and the share of that spare
 * it takes. The rest stays as air around the map.
 */
const KEY_ROOM_MAX = 52;
const KEY_ROOM_SHARE = 0.5;
/** How far the open sheet sits lower than its deck needs, to give the map room. */
const SHEET_LOWER = 28;
/** Breathing room between the sheet's title row and the top card. */
const DECK_GAP = 8;
/** The deck's height at normal text size, including the cards peeking out behind the top one. */
const DECK_HEIGHT = 214;
/**
 * How far the deck grows with the phone's text-size setting. Past this the
 * map would be squeezed out, so the very largest sizes still clip a little.
 */
const MAX_DECK_SCALE = 1.5;
/** The part of a card's height that is text and so grows with it. */
const TEXT_SHARE = 0.7;

/**
 * The deck and sheet heights at the phone's text size. The cards are mostly
 * text, so a fixed height cuts off their bottom row when text is enlarged.
 */
function useSheetSize(extra = 0) {
  const { fontScale } = useWindowDimensions();
  // The phone's text size and the app's own Settings choice multiply.
  const scale = Math.min(Math.max(fontScale * useTextScale(), 1), MAX_DECK_SCALE);
  // About 70% of a card's height is text; the band, padding and gaps stay put.
  const deck = Math.round(DECK_HEIGHT * (1 + (scale - 1) * TEXT_SHARE));
  // The open sheet stops SHEET_LOWER short of holding the whole deck: the
  // bottom of the deck (the next card's peek) runs on behind the tab bar,
  // and the map keeps that much more room.
  return { deck: deck + extra, sheet: SHEET_BAR + deck + extra + space[2] - SHEET_LOWER };
}
const SHEET_MS = 260;
/**
 * How much the deck rises when a card's arrow shows more about the park:
 * room for a few lines of its description and the rest of its facts.
 */
const MORE_ROOM = 200;


/** What the map shows. */
type MapScope = 'parks' | 'all' | 'wishlist' | 'visited';

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

/** A card in the deck: a park, plus its match and rank when it has them. */
type DeckItem = { site: Site; score?: number; reason?: string; rank?: number };

function toDeckItem(
  site: Site,
  matchById: ReadonlyMap<string, Recommendation>,
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
  const textScale = useTextScale();

  const [scope, setScope] = useState<MapScope>('parks');
  /**
   * The park tapped or searched for. While set, the map is zoomed onto its
   * region and the deck holds that region's parks.
   */
  const [anchor, setAnchor] = useState<Site | null>(null);
  /**
   * A region tapped on a list view (wishlist, visits) with nothing of yours
   * in it: the map still zooms there, over an empty deck that says so.
   */
  const [emptyRegion, setEmptyRegion] = useState<RegionId | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  /** Which park is on top of the deck, by id, so it survives list changes. */
  const [deckTopId, setDeckTopId] = useState<string | null>(null);
  /** Lets the user reopen the key while the sheet is open. */
  /**
   * Bumped to restart the card deck on the top card: a pin tapped in the
   * region in focus brings its card up, and the deck only reads which card
   * to show when it starts.
   */
  const [deckJump, setDeckJump] = useState(0);
  /** Bumped when the sheet is minimised, to undo any pinch on the map. */
  const [recenter, setRecenter] = useState(0);
  /** The key folded away with the sheet down, for more room (stays as set). */
  const [keyFolded, setKeyFolded] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [fullMapOpen, setFullMapOpen] = useState(false);
  // The screen starts turning on the press itself, before Explore re-renders.
  function openFullMap() {
    turnSideways();
    setFullMapOpen(true);
  }
  const [filters, setFilters] = useState<FeedFilters>(NO_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const router = useRouter();

  const parksQuery = useQuery({
    queryKey: ['sites', 'parks'],
    queryFn: () => listSites('parks'),
  });
  const sharedParks = parksQuery.data ?? NO_SITES;

  const sitesQuery = useQuery({
    queryKey: ['sites', 'all'],
    queryFn: () => listSites('all'),
  });
  const sharedSites = sitesQuery.data ?? NO_SITES;

  // Scored across every site so wishlist cards and search results have
  // a match too; the picks themselves are drawn from the parks only.
  // Signed in, the engine also uses your trips (visited parks move down),
  // so the list is refetched when a trip is logged.
  const { visitedIds, visitSummary, entries: tripEntries } = useTrips();
  const matchesQuery = useRecommendations();
  const sharedMatches = matchesQuery.data ?? NO_MATCHES;
  // Without the API the map and cards would just sit empty, so say so and
  // offer to try again. Only failed queries are refetched.
  const failedQueries = [parksQuery, sitesQuery, matchesQuery].filter((query) => query.isError);
  const [retrying, setRetrying] = useState(false);
  async function retry() {
    setRetrying(true);
    await Promise.all(failedQueries.map((query) => query.refetch()));
    setRetrying(false);
  }

  // The site list is shared and carries no per-person status, so your
  // wishlist is applied here, once, and everything below (map pins, cards,
  // the wishlist view) reads it from site.status. Visited outranks it.
  const { ids: wishlistIds, toggle: toggleWishlist } = useWishlist();
  // Visited comes from your trip journal: a park with an entry is visited.
  const withStatus = useCallback(
    (site: Site): Site => {
      const status: SiteStatus = visitedIds.has(site.id)
        ? 'visited'
        : wishlistIds.has(site.id)
          ? 'wishlist'
          : 'new';
      return status === site.status ? site : { ...site, status };
    },
    [wishlistIds, visitedIds],
  );
  const parks = useMemo(() => sharedParks.map(withStatus), [sharedParks, withStatus]);
  const allSites = useMemo(() => sharedSites.map(withStatus), [sharedSites, withStatus]);
  // Parks set aside with "Not for now" leave the recommendations (they
  // drop to Parks to Explore, still on the map and in search) until due back.
  const { ids: snoozedIds, snooze, unsnooze } = useSnoozed();
  const matches = useMemo(
    () =>
      sharedMatches
        .filter((match) => !snoozedIds.has(match.site.id))
        .map((match) => ({ ...match, site: withStatus(match.site) })),
    [sharedMatches, withStatus, snoozedIds],
  );
  /** The park just set aside, while its Undo is on offer. */
  const [undoPark, setUndoPark] = useState<Site | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    [],
  );

  const parkIds = useMemo(() => new Set(parks.map((site) => site.id)), [parks]);
  // Completed regions, marked on the map. The all-sites map counts every
  // site in a region; the others count its national parks.
  // A region just completed waits to be filled in on Passport's map first
  // (celebrations/CelebrationsContext.tsx).
  const { held } = useCelebrations();
  const completed = useMemo(() => {
    const done = completedRegions(scope === 'all' ? allSites : parks);
    for (const r of held.regions) done.delete(r);
    return done;
  }, [scope, allSites, parks, held.regions]);
  const parkMatches = useMemo(
    () => matches.filter(({ site }) => parkIds.has(site.id)),
    [matches, parkIds],
  );
  const matchById = useMemo(
    () => new Map(matches.map((match) => [match.site.id, match])),
    [matches],
  );

  // The engine's top 10, untouched by the filters. Its "something
  // different" pick (a terrain new to you; only with trips logged) takes
  // #4 unless it already ranks higher.
  const picks = useMemo(() => {
    const top = parkMatches.slice(0, TOP_N);
    const different = parkMatches.find((match) => match.different);
    if (!different) return top;
    const at = top.indexOf(different);
    if (at > -1 && at < DIFFERENT_AT) return top;
    const rest = top.filter((match) => match !== different);
    rest.splice(DIFFERENT_AT, 0, different);
    return rest.slice(0, TOP_N);
  }, [parkMatches]);
  const rankById = useMemo(
    () => new Map(picks.map(({ site }, index) => [site.id, index + 1])),
    [picks],
  );
  const filterCount = activeFilterCount(filters);
  /** The filters only apply to the views that show every park or site. */
  const filtersApply = scope === 'parks' || scope === 'all';

  const wishlist = useMemo(() => allSites.filter((site) => site.status === 'wishlist'), [allSites]);

  /** Every site you've been to, latest visit first. */
  const visited = useMemo(
    () =>
      allSites
        .filter((site) => site.status === 'visited')
        .sort((a, b) =>
          (visitSummary(b.id)?.last ?? '').localeCompare(visitSummary(a.id)?.last ?? ''),
        ),
    [allSites, visitSummary],
  );

  /** The wishlist and visits views show just that list. */
  const personalList = scope === 'wishlist' ? wishlist : scope === 'visited' ? visited : null;

  const mapSites = useMemo(() => {
    if (personalList) return personalList;
    return scope === 'parks' ? parks : allSites;
  }, [scope, personalList, parks, allSites]);

  /** The list views deal just their list; the others deal every park, picks first. */
  const showingList = personalList !== null;

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
    if (personalList) return personalList.map((site) => toDeckItem(site, matchById, rankById));

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
  }, [personalList, picks, mapSites, matchById, rankById, matchIds]);

  /**
   * The full deck split into sections for SectionDeck: each is a page you
   * swipe sideways to, with its cards running downward. The wishlist and
   * visits are one section each.
   */
  const sections = useMemo<DeckSection<DeckItem>[] | null>(() => {
    if (showingList) {
      if (baseDeck.length === 0) return null;
      const title = scope === 'wishlist' ? 'Your wishlist' : 'Your visits';
      return [{ key: scope, title, items: baseDeck }];
    }
    const recommended = baseDeck.filter((item) => item.rank !== undefined);
    const unranked = baseDeck.filter((item) => item.rank === undefined);
    return [
      { key: 'recommended', title: 'Recommended For You', items: recommended },
      {
        key: 'filtered',
        title: 'Filtered For You',
        items: unranked.filter((item) => matchIds.has(item.site.id)),
      },
      {
        key: 'explore',
        title: 'Parks to Explore',
        items: unranked.filter((item) => !matchIds.has(item.site.id)),
      },
    ].filter((section) => section.items.length > 0);
  }, [showingList, baseDeck, matchIds, scope]);

  const focusRegion = anchor
    ? regionForState(anchor.state)
    : REGIONS.find((region) => region.id === emptyRegion);
  /** Zoomed onto a region, from a park or the region itself. */
  const focused = focusRegion !== undefined;

  /** With a park tapped: every park on the map in its region, best fit first. */
  const regionDeck = useMemo<DeckItem[] | null>(() => {
    if (!focusRegion) return null;
    const inRegion = mapSites.filter(
      (site) => regionForState(site.state)?.id === focusRegion.id,
    );
    if (anchor && !inRegion.some((site) => site.id === anchor.id)) inRegion.push(anchor);
    return inRegion.map((site) => toDeckItem(site, matchById, rankById)).sort(byFit);
  }, [anchor, focusRegion, mapSites, matchById, rankById]);

  /** Back out to the whole country. */
  function clearFocus() {
    setAnchor(null);
    setEmptyRegion(null);
  }

  const deck = regionDeck ?? baseDeck;
  const deckIndex = Math.max(
    deck.findIndex((item) => item.site.id === deckTopId),
    0,
  );
  // With the sheet open the map highlights whichever card is on top.
  const topCard = sheetOpen ? deck[deckIndex] : undefined;
  const highlightId = topCard?.site.id ?? null;

  function openSheet(open: boolean) {
    setSheetOpen(open);
    // Closing tucks the cards away and recenters the map (undoing any
    // pinch), staying on the region in focus: "Full map" (or tapping the
    // park's pin again) zooms back out.
    if (!open) {
      setMoreOpen(false);
      setRecenter((n) => n + 1);
    }
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
    setEmptyRegion(null);
    setDeckTopId(site.id);
    openSheet(true);
  }

  /**
   * Tapping a region's land zooms onto it and deals every park the map
   * shows there, best fit on top, just as tapping that park would. On the
   * wishlist and visits views a region can hold none of yours; it still
   * zooms, over an empty deck.
   */
  function focusRegionById(regionId: RegionId) {
    const best = mapSites
      .filter((site) => regionForState(site.state)?.id === regionId)
      .map((site) => toDeckItem(site, matchById, rankById))
      .sort(byFit)[0];
    if (best) {
      focusPark(best.site);
      return;
    }
    setAnchor(null);
    setEmptyRegion(regionId);
    setDeckTopId(null);
    openSheet(true);
  }

  /**
   * A visited card's trip link: its journal entry in Trips, or (with none)
   * a new entry for that park.
   */
  function openTrip(site: Site, entry: TripEntry | undefined) {
    router.navigate({
      pathname: '/trips',
      params: entry ? { entry: entry.id } : { add: site.id },
    });
  }

  /** What the search panel searches, in words: the parks the map shows. */
  const scopeLabel =
    scope === 'wishlist'
      ? `your ${wishlist.length} saved parks`
      : scope === 'visited'
        ? `your ${visited.length} visited sites`
        : scope === 'parks'
        ? `${parks.length} national parks`
        : `all ${allSites.length} sites`;

  /**
   * The full deck is dealt in sections: the top 10, then filter matches,
   * then everything else. While the sheet is open its title names the
   * section of the card on top, and changes as you scroll past each one.
   */
  /**
   * Zoomed onto a region, its parks are one section of the same up-and-down
   * deck, titled with the region; otherwise the full deck's sections.
   */
  const deckSections = useMemo<DeckSection<DeckItem>[] | null>(() => {
    if (!focused) return sections;
    if (!regionDeck || regionDeck.length === 0) return null;
    return [{ key: `region-${focusRegion.id}`, title: focusRegion.label, items: regionDeck }];
  }, [focused, sections, regionDeck, focusRegion]);
  /** The section the top card is in, and the card's place in it. */
  const useSections = deckSections !== null;

  /** "Not for now": set a park aside, with Undo on offer for a few seconds. */
  function setAside(site: Site) {
    // Move the deck on to the next card in this section (or the one before,
    // at the end), rather than following the park out of it.
    const section = deckSections?.find((sec) => sec.items.some((i) => i.site.id === site.id));
    if (section) {
      const at = section.items.findIndex((i) => i.site.id === site.id);
      const next = section.items[at + 1] ?? section.items[at - 1];
      if (next) setDeckTopId(next.site.id);
    }
    snooze(site.id);
    setUndoPark(site);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoPark(null), 6000);
  }
  // Sized for the sectioned deck in every view, so the sheet and card keep
  // their size when tapping a card switches to the region carousel.
  // The arrow on a card raises the whole deck to show more about the park.
  const [moreOpen, setMoreOpen] = useState(false);
  const deckExtra = SECTION_PEEK + (moreOpen ? MORE_ROOM : 0);
  const { deck: deckHeight, sheet: openSheetHeight } = useSheetSize(deckExtra);
  // The map keeps its usual room; the raised deck just covers more of it.
  const { sheet: sheetHeight } = useSheetSize(SECTION_PEEK);
  function toggleMore() {
    // No layout animation here: it moves the deck's cards mid-snap and
    // leaves them stuck between two (the deck re-snaps on its own).
    setMoreOpen((open) => !open);
  }
  // The tab bar floats over the bottom of the screen; the sheet runs behind it.
  const tabSpace = useTabBarSpace();

  // On a tall phone the map (capped by the screen's width) leaves height to
  // spare with the sheet down. The spacers around it measure that spare,
  // and the key opens out by part of it so the gaps don't just grow.
  const [keyRoom, setKeyRoom] = useState(0);
  // Where the map's box sits in the stage, for drawing it on the whole
  // stage: behind the key above it and the card sheet below. The canvas
  // stays the stage's size as the box moves (see ParkMap's `canvas`).
  const [stageFrame, setStageFrame] = useState({ height: 0, areaY: 0, mapY: 0 });
  const mapCanvas = {
    top: stageFrame.areaY + stageFrame.mapY,
    height: stageFrame.height,
  };
  // The map keeps the size it has with the sheet down: opening the sheet
  // slides it up under the key rather than shrinking it (which shrank its
  // pins too), and its bottom runs on behind the sheet.
  const [mapHeight, setMapHeight] = useState(0);
  const openSheetTop = stageFrame.height - openSheetHeight - DECK_GAP - tabSpace;
  const mapCovered =
    sheetOpen && mapHeight > 0
      ? Math.max(0, mapCanvas.top + mapHeight - openSheetTop + DECK_GAP)
      : 0;
  const spacers = useRef({ above: 0, below: 0 });
  function measureSpare(which: 'above' | 'below', height: number) {
    spacers.current[which] = height;
    // What would be spare with no extra room in the key, so the answer
    // doesn't change as the key grows.
    const spare = spacers.current.above + spacers.current.below + keyRoom;
    const next = Math.round(Math.min(Math.max(spare * KEY_ROOM_SHARE, 0), KEY_ROOM_MAX));
    if (Math.abs(next - keyRoom) >= 2) setKeyRoom(next);
  }
  const inSection = useMemo(() => {
    if (!deckSections || !topCard) return null;
    const page = deckSections.findIndex((section) =>
      section.items.some((item) => item.site.id === topCard.site.id),
    );
    if (page < 0) return null;
    const index = deckSections[page].items.findIndex((item) => item.site.id === topCard.site.id);
    return { page, index, section: deckSections[page] };
  }, [deckSections, topCard]);

  const deckTitle = focusRegion
    ? focusRegion.label
    : anchor
      ? anchor.name
      : scope === 'wishlist'
        ? 'Your wishlist'
        : scope === 'visited'
          ? 'Your visits'
          : inSection
            ? inSection.section.title
            : // Closed, there's no card in view: an invitation to swipe up.
              LETS_GO;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space[2] }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Heading size={TITLE_SIZE}>Explore</Heading>
          {/* The leaf sits under the middle of the title's "x", which is
              0.98em in; the indent follows the title as text size changes. */}
          <View
            style={[
              styles.headerMetaRow,
              { paddingLeft: TITLE_SIZE * textScale * X_CENTRE_EM - LEAF_SIZE / 2 },
            ]}
          >
            <LeafIcon />
            <BodyText size={12} color={colors.neutral[600]} style={styles.headerMetaText}>
              {/* The key and the title above the map already say what's shown;
                  this line is the invitation, plus anything the map can't say. */}
              {scope === 'wishlist'
                ? `Where to next? Pick from your ${wishlist.length} saved`
                : scope === 'visited'
                  ? `Where you've been: ${visited.length} so far`
                  : matchIds.size > 0
                  ? `Where to next? ${matchIds.size} more fit your filters`
                  : // The engine uses your trips (signed in, as Explore always is).
                    tripEntries.length === 0
                    ? 'Matched to your quiz'
                    : tripEntries.length === 1
                      ? 'Tuned by your trip'
                      : `Tuned by your ${tripEntries.length} trips`}
            </BodyText>
          </View>
        </View>
        <View style={styles.headerActions}>
          <View style={styles.headerRow}>
            <SearchButton onPress={() => setSearchOpen(true)} />
            <ScopeMenu
              value={scope}
              parkCount={parks.length}
              siteCount={allSites.length}
              wishlistCount={wishlist.length}
              visitedCount={visited.length}
              onChange={(next) => {
                setScope(next);
                clearFocus();
                setDeckTopId(null);
              }}
            />
            <FilterButton
              count={filtersApply ? filterCount : 0}
              onPress={() => setFilterOpen(true)}
              // Filters highlight parks beyond the top 10; the wishlist view
              // has none to highlight.
              disabled={!filtersApply}
            />
          </View>
        </View>
      </View>

      {failedQueries.length > 0 ? (
        <View style={styles.offlineBar} accessibilityRole="alert">
          <BodyText size={13} color={colors.neutral[100]} style={styles.undoText}>
            {"Couldn't reach ParkPath. Check your connection."}
          </BodyText>
          <Pressable
            onPress={retry}
            disabled={retrying}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Try loading the parks again"
          >
            <BodyText size={13} weight="bold" color={colors.accentRamp[300]}>
              {retrying ? 'Trying…' : 'Try again'}
            </BodyText>
          </Pressable>
        </View>
      ) : null}

      {/* The stage: key and map, with the card sheet over its bottom edge.
          The map draws behind the key and the sheet (its bleed), so zoomed
          in it slides under them; the stage clips it at the key's top. */}
      <View
        style={styles.stage}
        onLayout={(event) => {
          const { height } = event.nativeEvent.layout;
          setStageFrame((f) => (Math.abs(f.height - height) > 1 ? { ...f, height } : f));
        }}
      >
        {/* No layout transition: an interrupted one left the key cut off at
            its folded height after the sheet closed. */}
        <View
          // Collapsed, the key moves up a little to give the map the room.
          style={[styles.keyWrap, sheetOpen && styles.keyWrapOpen]}
        >
          {/* The key is a legend: kept a little smaller than Large text, so it
              doesn't crowd out the map it explains. */}
          <CapTextScale max={1.1}>
            <MapKey
              // The key and the open sheet never share the screen: the sheet
              // folds the key, and opening the key minimises the sheet.
              collapsed={sheetOpen || keyFolded}
              room={keyRoom}
              showMatches={matchIds.size > 0}
              onToggle={() => {
                if (sheetOpen) {
                  setKeyFolded(false);
                  openSheet(false);
                } else {
                  setKeyFolded((folded) => !folded);
                }
              }}
            />
          </CapTextScale>
        </View>

        {/* Deliberately not a layout-animated view: the map has to be told
            its new size when the sheet opens, or it overflows under it. */}
        <View
          style={[
            styles.mapArea,
            { paddingBottom: (sheetOpen ? sheetHeight + DECK_GAP : SHEET_BAR) + tabSpace },
            // Open, the map is taller than the room above the sheet: stack
            // it from the top (centred, it rode up under the key) and let
            // its bottom run on behind the sheet.
            sheetOpen && styles.mapAreaOpen,
          ]}
          onLayout={(event) => {
            const { y } = event.nativeEvent.layout;
            setStageFrame((f) => (Math.abs(f.areaY - y) > 1 ? { ...f, areaY: y } : f));
          }}
        >
          {!sheetOpen ? (
            <View
              style={{ flex: SPARE_ABOVE }}
              onLayout={(event) => measureSpare('above', event.nativeEvent.layout.height)}
            />
          ) : null}
          {/* The title and the map jump to where the sheet leaves them (see
              the note on the map below). */}
          <Animated.View style={styles.titleSlot}>
          {focusRegion ? (
            <RegionTitle
              region={focusRegion}
              actionLabel="Full map"
              onAction={clearFocus}
            />
          ) : (
            // What the map is showing, now that the scope button is an icon.
            // With the sheet down the map sits lower, so lift the title a
            // touch to keep it close under the key.
            <View
              style={[
                styles.mapTitle,
                sheetOpen ? styles.mapTitleOpen : styles.mapTitleRaised,
              ]}
            >
              <Heading size={14}>
                {scopeLabel.charAt(0).toUpperCase() + scopeLabel.slice(1)}
              </Heading>
            </View>
          )}
          </Animated.View>
          {/* No layout transition here or on the title: tapping a park while
              the previous slide was still running left the map box drawn in
              the wrong place (blank map, dead "Full map" button; Bug 1). */}
          <Animated.View
            style={[
              styles.map,
              // Open, the map's empty top margin tucks under its title.
              sheetOpen && styles.mapOpen,
              sheetOpen && mapHeight > 0
                ? { flex: 0, height: mapHeight }
                : { maxHeight: windowWidth / MAP_ASPECT },
              // Closed, the map fills to its full height before the spare
              // room goes to the spacers around it.
              !sheetOpen && styles.mapFirst,
            ]}
            onLayout={(event) => {
              const { y, height } = event.nativeEvent.layout;
              setStageFrame((f) => (Math.abs(f.mapY - y) > 1 ? { ...f, mapY: y } : f));
              if (!sheetOpen) setMapHeight((h) => (Math.abs(h - height) > 1 ? height : h));
            }}
          >
          <ParkMap
            sites={mapSites}
            rankById={rankById}
            matchIds={matchIds}
            selectedId={highlightId}
            // Only a search, a pin tap or a card tap zooms in; scrolling
            // the cards leaves the whole map in view.
            focusRegion={focusRegion?.id ?? null}
            featureIcons={scope === 'parks'}
            // With the sheet open there's no room under the map, so the
            // button stays in the map's corner; closed, it sits below.
            onExpand={sheetOpen ? openFullMap : undefined}
            onSelectSite={(site) => {
              if (anchor && site.id === highlightId) {
                // Tapping the top card's pin again zooms back out.
                setAnchor(null);
              } else if (regionDeck?.some((item) => item.site.id === site.id)) {
                // Another park in the same region: bring its card to the top
                // (opening the sheet, if it was minimised over the region).
                setDeckTopId(site.id);
                setDeckJump((n) => n + 1);
                if (!sheetOpen) openSheet(true);
              } else {
                focusPark(site);
              }
            }}
            onSelectRegion={focusRegionById}
            completedRegions={completed}
            // Your visits show every visited pin; the other views tuck a
            // completed region's pins behind its stamp.
            tuckCompleted={scope !== 'visited'}
            canvas={mapCanvas}
            obscuredBottom={mapCovered}
            recenterKey={recenter}
            style={styles.mapFill}
          />
          </Animated.View>
          {!sheetOpen ? (
            <>
              <Pressable
                onPress={openFullMap}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Open the map full screen"
                style={({ pressed }) => [styles.expandBelow, pressed && styles.suggestionPressed]}
              >
                <ExpandIcon size={16} color={colors.accentRamp[700]} />
              </Pressable>
              <View
                style={{ flex: SPARE_BELOW }}
                onLayout={(event) => measureSpare('below', event.nativeEvent.layout.height)}
              />
            </>
          ) : null}
        </View>

        <CardSheet
          open={sheetOpen}
          onOpenChange={openSheet}
          title={deckTitle}
          status={
            inSection
              ? `${inSection.index + 1} of ${inSection.section.items.length}`
              : deck.length > 0
                ? `${deckIndex + 1} of ${deck.length}`
                : undefined
          }
          extra={deckExtra}
          below={tabSpace}
          pages={
            deckSections && deckSections.length > 1 && inSection
              ? { count: deckSections.length, active: inSection.page }
              : undefined
          }
        >
          {useSections && deck.length > 0 ? (
            <SectionDeck
              // New sections (another view, other filters, zooming onto a
              // region and back) start a fresh deck on the same card.
              key={`${scope}:${deckJump}:${deckSections.map((section) => `${section.key}${section.items.length}`).join()}`}
              sections={deckSections}
              activeId={deck[deckIndex]?.site.id}
              keyOf={(item) => item.site.id}
              onActiveChange={(item) => setDeckTopId(item.site.id)}
              height={deckHeight}
              // The next card carries on down behind the tab bar.
              extraBelow={tabSpace}
              renderCard={(item, active, bringIntoView) => (
                <ParkCard
                  site={item.site}
                  reason={item.reason}
                  match={item.score}
                  rank={item.rank}
                  // The full decks mix saved parks in with everything else.
                  markWishlist={scope === 'parks' || scope === 'all'}
                  onOpenTrip={(entry) => openTrip(item.site, entry)}
                  saved={wishlistIds.has(item.site.id)}
                  onToggleSave={() => toggleWishlist(item.site.id)}
                  // Setting aside is about recommendations, so only on the full decks.
                  onSnooze={
                    scope === 'parks' || scope === 'all' ? () => setAside(item.site) : undefined
                  }
                  // The park's own page: photo, description, facts, directions and map.
                  onExpand={() => router.push(`/site/${item.site.id}`)}
                  more={moreOpen}
                  onToggleMore={toggleMore}
                  onPress={() => {
                    if (!active) {
                      // The card peeking up from below: bring it into view.
                      bringIntoView();
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
            />
          ) : (
            <View style={styles.empty}>
              <Heading size={17}>
                {scope === 'wishlist'
                  ? focusRegion
                    ? `Nothing saved in ${focusRegion.label}`
                    : 'Nothing saved yet'
                  : scope === 'visited'
                    ? focusRegion
                      ? `No visits in ${focusRegion.label} yet`
                      : 'No visits yet'
                    : 'No parks match'}
              </Heading>
              <BodyText
                size={13}
                lineHeightRatio={1.5}
                color={colors.neutral[700]}
                style={styles.emptyBody}
              >
                {scope === 'wishlist'
                  ? 'Parks you add to your wishlist will show up here.'
                  : scope === 'visited'
                    ? focusRegion
                      ? 'Parks you visit here will show up on this map. Full map goes back to all your visits.'
                      : 'Parks you log a visit to will show up here, latest first.'
                    : 'Nothing matched those answers. Widen your terrain or season by retaking the quiz in Settings.'}
              </BodyText>
            </View>
          )}
        </CardSheet>
      </View>

      <FullMapView
        visible={fullMapOpen}
        title={scopeLabel.charAt(0).toUpperCase() + scopeLabel.slice(1)}
        sites={mapSites}
        rankById={rankById}
        matchIds={matchIds}
        featureIcons={scope === 'parks'}
        completedRegions={completed}
        tuckCompleted={scope !== 'visited'}
        onClose={() => setFullMapOpen(false)}
        onView={(site) => {
          setFullMapOpen(false);
          focusPark(site);
        }}
      />

      <SearchPanel
        visible={searchOpen}
        sites={mapSites}
        scopeLabel={scopeLabel}
        onPick={(site) => {
          setSearchOpen(false);
          focusPark(site);
        }}
        onClose={() => setSearchOpen(false)}
      />

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

      {undoPark ? (
        <View style={[styles.undoBar, { bottom: tabSpace + space[2] }]}>
          <BodyText size={13} color={colors.neutral[100]} style={styles.undoText} numberOfLines={2}>
            {`${undoPark.name} set aside for 30 days`}
          </BodyText>
          <Pressable
            onPress={() => {
              unsnooze(undoPark.id);
              setUndoPark(null);
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Undo, bring ${undoPark.name} back`}
          >
            <BodyText size={13} weight="bold" color={colors.accentRamp[300]}>
              Undo
            </BodyText>
          </Pressable>
        </View>
      ) : null}
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
  pages,
  extra = 0,
  below = 0,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  status?: string;
  /** Dots for the deck's sections, when it has more than one. */
  pages?: { count: number; active: number };
  /** Extra deck height, for the sectioned deck's peek. */
  extra?: number;
  /** Room under the deck, behind the floating tab bar. */
  below?: number;
  children: ReactNode;
}) {
  const { deck: deckHeight, sheet: sheetHeight } = useSheetSize(extra);
  const closedY = sheetHeight + DECK_GAP - SHEET_BAR;
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
  // The cards fade out as the sheet closes: closed, the top of the deck
  // would otherwise sit behind the see-through tab bar.
  const deckFade = useAnimatedStyle(() => ({
    opacity: interpolate(offset.get(), [0, closedY * 0.6], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View style={[styles.sheet, { height: sheetHeight + DECK_GAP + below }, slide]}>
      <GestureDetector gesture={Gesture.Race(drag, tapBar)}>
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel={`${open ? 'Hide' : 'Show'} ${title.replaceAll(' → ', ' to ')}`}
          onAccessibilityTap={() => onOpenChange(!open)}
          style={styles.sheetBar}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHead}>
            <SheetTitle title={title} />
            {open && pages ? (
              <View style={styles.pageDots} accessibilityLabel={`Section ${pages.active + 1} of ${pages.count}`}>
                {Array.from({ length: pages.count }, (_, index) => (
                  <View
                    key={index}
                    style={[styles.pageDot, index === pages.active && styles.pageDotActive]}
                  />
                ))}
              </View>
            ) : null}
            <BodyText size={12} weight="semibold" color={colors.accentRamp[700]}>
              {open ? (status ?? '') : 'Swipe up ▴'}
            </BodyText>
          </View>
        </View>
      </GestureDetector>
      <Animated.View style={[{ height: deckHeight + below, marginTop: DECK_GAP }, deckFade]}>{children}</Animated.View>
    </Animated.View>
  );
}

/** The pill under Filter that opens a menu of map scopes. */
function ScopeMenu({
  value,
  parkCount,
  siteCount,
  wishlistCount,
  visitedCount,
  onChange,
}: {
  value: MapScope;
  parkCount: number;
  siteCount: number;
  wishlistCount: number;
  visitedCount: number;
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
    {
      value: 'visited',
      short: 'Visited',
      label: `My visits (${visitedCount})`,
      detail: "Only the sites you've been to, latest first",
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
        <MapIcon />
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
/** The Explore title's size, and where its "x" is centred, in ems (measured). */
const TITLE_SIZE = 26;
const X_CENTRE_EM = 0.98;
const LEAF_SIZE = 13;

/** A small filled leaf, for a touch of the second accent beside the subtitle. */
function LeafIcon() {
  return (
    <Svg width={LEAF_SIZE} height={LEAF_SIZE} viewBox="0 0 24 24">
      <Path d="M4 20C4 10 10 4 21 3c0 11-6 17-17 17z" fill={colors.accent2Ramp[700]} />
      <Path
        d="M4 20L14 10"
        stroke={colors.accent2Ramp[200]}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * The sheet's title. Each " → " in it is drawn as an arrow in the accent:
 * the heading font has no arrow, so the phone substitutes a thin one from
 * another font that sits low beside the heavy letters.
 */
/** A touch smaller than other headings, so the three-part title fits. */
const SHEET_TITLE_SIZE = 15;

/** The closed sheet's title, shown with a leaf like "Where to next?". */
const LETS_GO = "Let's Go!";

function SheetTitle({ title }: { title: string }) {
  if (title === LETS_GO) {
    return (
      <View style={[styles.headerText, styles.sheetTitleRow]}>
        <Heading size={SHEET_TITLE_SIZE} numberOfLines={1}>
          {title}
        </Heading>
        <LeafIcon />
      </View>
    );
  }
  const parts = title.split(' → ');
  if (parts.length === 1) {
    return (
      <Heading size={SHEET_TITLE_SIZE} numberOfLines={1} style={styles.headerText}>
        {title}
      </Heading>
    );
  }
  return (
    <View style={[styles.headerText, styles.sheetTitleRow]}>
      {parts.map((part, index) => (
        <View key={part} style={styles.sheetTitleRow}>
          {index > 0 ? <TitleArrow /> : null}
          {/* Only the last word gives way, with an ellipsis, if text is large. */}
          <Heading
            size={SHEET_TITLE_SIZE}
            numberOfLines={1}
            style={index === parts.length - 1 ? styles.sheetTitleLast : undefined}
          >
            {part}
          </Heading>
        </View>
      ))}
    </View>
  );
}

function TitleArrow() {
  return (
    <Svg width={14} height={11} viewBox="0 0 24 18" fill="none">
      <Path
        d="M2 9h18M13 2l7 7-7 7"
        stroke={colors.accent}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** A folded map: the scope button's icon. */
function MapIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      {['M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z', 'M9 3v15', 'M15 6v15'].map((d) => (
        <Path
          key={d}
          d={d}
          stroke={colors.accentRamp[700]}
          strokeWidth={2.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}

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
  room = 0,
  onToggle,
}: {
  collapsed: boolean;
  /** Extra height to open out into (up to KEY_ROOM_MAX), on a tall screen. */
  room?: number;
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

  // Spread the extra room over the key's padding and gaps, in proportion
  // to the 52 it can take at most.
  const r = Math.min(room, KEY_ROOM_MAX) / KEY_ROOM_MAX;

  return (
    <View style={[styles.key, { paddingVertical: styles.key.paddingVertical + 8 * r }]}>
      <View style={styles.keyHead}>
        <Kicker>Your pins</Kicker>
        {toggle}
      </View>
      <View style={[styles.keyRow, { marginTop: styles.keyRow.marginTop + 4 * r }]}>
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

      <Kicker style={[styles.keyKicker, { marginTop: styles.keyKicker.marginTop + 8 * r }]}>
        Regions
      </Kicker>
      <View
        style={[
          styles.regionGrid,
          {
            marginTop: styles.regionGrid.marginTop + 4 * r,
            rowGap: styles.regionGrid.rowGap + 5 * r,
          },
        ]}
      >
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    paddingHorizontal: space[4],
  },
  headerText: {
    flex: 1,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  headerMetaText: {
    flexShrink: 1,
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: space[2],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  // Matches the search button beside it.
  scopePill: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
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
  suggestionPressed: {
    backgroundColor: colors.tintText07,
  },
  stage: {
    flex: 1,
    // A little more air above and below the key. Padding, not margin: the
    // collapsed key moves up into it (keyWrapOpen), inside the clip.
    paddingTop: space[4],
    // The closed sheet's deck sits below this edge and stays hidden.
    overflow: 'hidden',
  },
  keyWrapOpen: {
    marginTop: -space[2],
  },
  mapAreaOpen: {
    justifyContent: 'flex-start',
  },
  mapOpen: {
    marginTop: -space[3],
  },
  keyWrap: {
    marginHorizontal: space[4],
    marginBottom: space[2],
    overflow: 'hidden',
    // Over the map, which slides behind it when zoomed in.
    zIndex: 2,
  },
  mapArea: {
    flex: 1,
    // Centres the map in the room between the key and the card sheet.
    justifyContent: 'center',
  },
  // A rounded label box, like the key above it.
  mapTitle: {
    alignSelf: 'center',
    // Drawn over the map's top edge, which it now overlaps a little.
    zIndex: 1,
    elevation: 1,
    // Clear of the key above, and close to the map it names; kept small so
    // the map gets the height.
    marginTop: space[3],
    marginBottom: -space[2],
    paddingVertical: 4,
    paddingHorizontal: space[4],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    backgroundColor: colors.neutral[100],
  },
  // Centred just under the map, so it reads as the map's own button.
  expandBelow: {
    alignSelf: 'center',
    marginTop: space[2],
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[100],
    ...shadow.sm,
  },
  // Open, close under the collapsed key, to give the map the room.
  mapTitleOpen: {
    marginTop: space[1],
  },
  mapTitleRaised: {
    // Nudged down towards the map; it's drawn above it (zIndex).
    transform: [{ translateY: space[1] }],
  },
  key: {
    padding: space[3],
    // A little taller than its contents, so the key reads as its own block.
    paddingVertical: space[4],
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
    // Over the map, which slides behind it when zoomed in, on a backing so
    // it stays readable there.
    zIndex: 1,
    elevation: 1,
    paddingVertical: 4,
    paddingHorizontal: space[3],
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
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
  mapFill: {
    flex: 1,
  },
  // Holds the map's title; it overlaps the map's top edge (see mapTitle).
  titleSlot: {
    zIndex: 1,
  },
  // Far outweighs the spacers, so the map takes its maxHeight first and
  // the spacers split only what's left over.
  mapFirst: {
    flexGrow: 1000,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
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
  pageDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.neutral[400],
  },
  pageDotActive: {
    width: 16,
    backgroundColor: colors.accent,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  sheetTitleLast: {
    flexShrink: 1,
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
  deck: {
    flex: 1,
  },
  deckCard: {
    flex: 1,
  },
  undoBar: {
    position: 'absolute',
    left: space[4],
    right: space[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderRadius: radius.md,
    backgroundColor: colors.neutral[900],
    zIndex: 50,
    ...shadow.lg,
  },
  undoText: {
    flex: 1,
  },
  // The undo bar's look, in the flow under the header instead of floating.
  offlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    marginHorizontal: space[4],
    marginTop: space[2],
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderRadius: radius.md,
    backgroundColor: colors.neutral[900],
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
