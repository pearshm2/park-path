/**
 * Explore: where the quiz lands. One scrolling page — search, the map
 * key, the map, then the quiz's top 10 (or the wishlist) as cards —
 * instead of the old Map / For You pair, so the recommendations are the
 * first thing on the map.
 *
 * The scope menu under Filter picks what else the map shows around the
 * picks: nothing, the 63 national parks, or every site. The top 10 are
 * always drawn as numbered pins that match the card numbers below, and
 * are always ranked from the 63 parks so they do not shift with scope.
 *
 * Tapping a pin, a card or a search result opens that park's details
 * under the map. Data comes from the bundled fixtures via
 * src/api/parks.ts, so this renders real parks with no backend.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listSites } from '../../api/parks';
// Placeholder ranking, not Dylan's engine - see the banner in this file.
import { provisionalMatches, type ProvisionalMatch } from '../../api/provisionalMatches';
import {
  activeFilterCount,
  BodyText,
  Button,
  CROWD_CEILING,
  FilterButton,
  FilterSheet,
  Heading,
  Kicker,
  NO_FILTERS,
  ParkCard,
  ParkMap,
  PICK_FILL,
  STATUS_DOT,
  Tag,
  type FeedFilters,
} from '../../components';
import type { Site, SiteStatus } from '../../data/parks';
import { REGIONS } from '../../data/regions';
import { useQuiz } from '../../quiz/QuizContext';
import { colors, fonts, radius, shadow, space } from '../../theme';

/** How many recommendations get a numbered pin and a card. */
const TOP_N = 10;

/** Albers USA is roughly 1.6 wide to 1 tall; a touch taller leaves room for Alaska. */
const MAP_ASPECT = 1.5;

/** How many search suggestions to list under the search bar. */
const MAX_SUGGESTIONS = 5;

/** What the map shows around the numbered picks. */
type MapScope = 'picks' | 'parks' | 'all';

/** Which cards sit under the map. */
type ListMode = 'picks' | 'wishlist';

/** Applies the sheet's dials to a ranked list, keeping its order. */
function applyFilters<T extends { site: Site }>(rows: T[], filters: FeedFilters): T[] {
  const ceiling = filters.crowd ? CROWD_CEILING[filters.crowd] : null;

  return rows.filter(({ site }) => {
    if (filters.terrains.length > 0 && !filters.terrains.includes(site.group)) return false;
    if (filters.maxEffort !== null && site.effort > filters.maxEffort) return false;
    if (ceiling !== null && site.vis > ceiling) return false;
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

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { answers } = useQuiz();
  const scrollRef = useRef<ScrollView>(null);
  const mapY = useRef(0);

  const [scope, setScope] = useState<MapScope>('parks');
  const [listMode, setListMode] = useState<ListMode>('picks');
  const [selected, setSelected] = useState<Site | null>(null);
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

  const filtered = useMemo(() => applyFilters(parkMatches, filters), [parkMatches, filters]);
  const picks = useMemo(() => filtered.slice(0, TOP_N), [filtered]);
  const rankById = useMemo(
    () => new Map(picks.map(({ site }, index) => [site.id, index + 1])),
    [picks],
  );
  const filterCount = activeFilterCount(filters);

  const mapSites = useMemo(() => {
    if (scope === 'picks') return picks.map(({ site }) => site);
    return scope === 'parks' ? parks : allSites;
  }, [scope, picks, parks, allSites]);

  const wishlist = useMemo(
    () => allSites.filter((site) => site.status === 'wishlist'),
    [allSites],
  );

  const suggestions = useMemo(
    () => searchSites(allSites, query).slice(0, MAX_SUGGESTIONS),
    [allSites, query],
  );

  const selectedRank = selected ? rankById.get(selected.id) : undefined;
  const selectedMatch = selected ? matchById.get(selected.id) : undefined;

  /**
   * Opens a park's details and brings the map into view. If the park is
   * not on the map at the current scope, the scope widens to include it.
   */
  function showOnMap(site: Site) {
    if (!mapSites.some((shown) => shown.id === site.id)) {
      setScope(parkIds.has(site.id) ? 'parks' : 'all');
    }
    setSelected(site);
    scrollRef.current?.scrollTo({ y: Math.max(mapY.current - space[2], 0), animated: true });
  }

  function pickResult(site: Site) {
    setQuery('');
    setSearchMiss(null);
    Keyboard.dismiss();
    showOnMap(site);
  }

  function submitSearch() {
    const [best] = searchSites(allSites, query);
    if (best) pickResult(best);
    else if (query.trim()) setSearchMiss(query.trim());
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space[6] }]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: space[8] }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Heading size={26}>Explore</Heading>
            <BodyText size={12} color={colors.neutral[600]} style={styles.headerMeta}>
              {scope === 'picks'
                ? `Just your top ${picks.length}`
                : scope === 'parks'
                  ? `Your top ${picks.length} of ${parks.length} national parks`
                  : `Your top ${picks.length}, plus all ${allSites.length} sites`}
            </BodyText>
          </View>
          <View style={styles.headerActions}>
            <FilterButton count={filterCount} onPress={() => setFilterOpen(true)} />
            <ScopeMenu
              value={scope}
              parkCount={parks.length}
              siteCount={allSites.length}
              onChange={(next) => {
                setScope(next);
                setSelected(null);
              }}
            />
          </View>
        </View>

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
          <BodyText size={12} color={colors.neutral[700]} style={styles.searchMiss}>
            {`Nothing called "${searchMiss}". Try part of the name.`}
          </BodyText>
        ) : null}

        <MapKey />

        <View
          onLayout={(event) => {
            mapY.current = event.nativeEvent.layout.y;
          }}
        >
          <ParkMap
            sites={mapSites}
            rankById={rankById}
            selectedId={selected?.id ?? null}
            // Tapping the selected pin again clears it, as the prototype does.
            onSelectSite={(site) => setSelected((prev) => (prev?.id === site.id ? null : site))}
            style={styles.map}
          />
        </View>

        {selected ? (
          <SelectedCard
            site={selected}
            rank={selectedRank}
            match={selectedMatch}
            onDismiss={() => setSelected(null)}
          />
        ) : null}

        <View style={styles.listHead}>
          <Segmented
            options={[
              { value: 'picks', label: `Your top ${picks.length || TOP_N}` },
              { value: 'wishlist', label: `Wishlist (${wishlist.length})` },
            ]}
            value={listMode}
            onChange={(next) => setListMode(next as ListMode)}
          />
          <BodyText size={12} color={colors.neutral[600]} style={styles.listMeta}>
            {listMode === 'wishlist'
              ? 'Parks you have saved for later'
              : filterCount > 0
                ? `${filtered.length} of ${parkMatches.length} parks match your filters`
                : 'Ranked by how well each park fits your quiz answers'}
          </BodyText>
        </View>

        <View style={styles.list}>
          {listMode === 'picks'
            ? picks.map(({ site, score, reason }, index) => (
                <ParkCard
                  key={site.id}
                  site={site}
                  score={score}
                  reason={reason}
                  rank={index + 1}
                  highlighted={site.id === selected?.id}
                  onPress={() => showOnMap(site)}
                />
              ))
            : wishlist.map((site) => (
                <ParkCard
                  key={site.id}
                  site={site}
                  score={matchById.get(site.id)?.score}
                  reason={matchById.get(site.id)?.reason}
                  rank={rankById.get(site.id)}
                  highlighted={site.id === selected?.id}
                  onPress={() => showOnMap(site)}
                />
              ))}

          {listMode === 'wishlist' && wishlist.length === 0 ? (
            <View style={styles.empty}>
              <Heading size={19}>Nothing saved yet</Heading>
              <BodyText
                size={13}
                lineHeightRatio={1.5}
                color={colors.neutral[700]}
                style={styles.emptyBody}
              >
                Parks you add to your wishlist will show up here.
              </BodyText>
            </View>
          ) : null}

          {listMode === 'picks' && picks.length === 0 ? (
            <View style={styles.empty}>
              <Heading size={19}>No parks match</Heading>
              <BodyText
                size={13}
                lineHeightRatio={1.5}
                color={colors.neutral[700]}
                style={styles.emptyBody}
              >
                {filterCount > 0
                  ? 'Your filters are narrower than the results. Clear a few and try again.'
                  : 'Nothing matched those answers. Widen your terrain or season by retaking the quiz in Settings.'}
              </BodyText>
              {filterCount > 0 ? (
                <Button
                  label="Clear filters"
                  variant="secondary"
                  onPress={() => setFilters(NO_FILTERS)}
                  style={styles.emptyAction}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <FilterSheet
        visible={filterOpen}
        value={filters}
        countFor={(draft) => applyFilters(parkMatches, draft).length}
        onApply={(next) => {
          setFilters(next);
          setFilterOpen(false);
        }}
        onClose={() => setFilterOpen(false)}
      />
    </View>
  );
}

/** The pill under Filter that opens a menu of map scopes. */
function ScopeMenu({
  value,
  parkCount,
  siteCount,
  onChange,
}: {
  value: MapScope;
  parkCount: number;
  siteCount: number;
  onChange: (next: MapScope) => void;
}) {
  const anchor = useRef<View>(null);
  const { width: windowWidth } = useWindowDimensions();
  const [menu, setMenu] = useState<{ top: number; right: number } | null>(null);

  const options: { value: MapScope; short: string; label: string; detail: string }[] = [
    {
      value: 'picks',
      short: `Top ${TOP_N}`,
      label: `Just my top ${TOP_N}`,
      detail: 'Only the parks recommended for you',
    },
    {
      value: 'parks',
      short: `${parkCount} parks`,
      label: `${parkCount} national parks`,
      detail: 'Your picks among every national park',
    },
    {
      value: 'all',
      short: `All ${siteCount}`,
      label: `All ${siteCount} sites`,
      detail: 'Adds monuments, seashores, recreation areas and more',
    },
  ];
  const current = options.find((option) => option.value === value) ?? options[1];

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

/** The prototype's pill segmented control. */
function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <BodyText size={13} weight="semibold" color={active ? colors.bg : colors.neutral[700]}>
              {option.label}
            </BodyText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The key above the map: what each pin means, then the region colours. */
function MapKey() {
  const statuses: SiteStatus[] = ['visited', 'wishlist', 'new'];

  return (
    <View style={styles.key}>
      <Kicker>Your pins</Kicker>
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
        {statuses.map((status) => (
          <View key={status} style={styles.keyItem}>
            <View
              style={[
                styles.statusSwatch,
                { backgroundColor: STATUS_DOT[status].fill, borderColor: STATUS_DOT[status].stroke },
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

/** Details for the tapped pin, laid out under the map rather than over it. */
function SelectedCard({
  site,
  rank,
  match,
  onDismiss,
}: {
  site: Site;
  rank?: number;
  match?: ProvisionalMatch;
  onDismiss: () => void;
}) {
  const percent = match ? `${Math.round(match.score * 100)}% match · ${match.reason}` : null;

  return (
    <View style={styles.selected}>
      <View style={styles.selectedHead}>
        <View style={styles.headerText}>
          <Heading size={19}>{site.name}</Heading>
          <BodyText size={12} color={colors.neutral[600]} style={styles.headerMeta}>
            {`${site.kind} · ${site.state}`}
          </BodyText>
        </View>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Close park details"
          hitSlop={10}
          style={styles.close}
        >
          <BodyText size={16} weight="semibold" color={colors.neutral[700]}>
            ×
          </BodyText>
        </Pressable>
      </View>

      {percent ? (
        <BodyText size={12.5} weight="medium" lineHeightRatio={1.45} color={colors.accentRamp[800]}>
          {rank ? `#${rank} for you · ${percent}` : percent}
        </BodyText>
      ) : null}

      <BodyText size={13} lineHeightRatio={1.45} color={colors.neutral[700]}>
        {site.blurb}
      </BodyText>

      <View style={styles.cardTags}>
        <Tag tone="accent2" label={`${site.vis.toFixed(1)}M visits`} />
        <Tag tone="outline" label={site.feature} />
        <Tag tone="neutral" label={site.seasons.join(' · ') || 'Year-round'} />
        {site.permit ? <Tag tone="accent" label="Permit needed" /> : null}
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
    marginTop: space[2],
    marginHorizontal: space[4] + space[2],
  },
  suggestions: {
    marginTop: space[2],
    marginHorizontal: space[4],
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
  key: {
    marginTop: space[3],
    marginHorizontal: space[4],
    padding: space[3],
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
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
    width: '100%',
    aspectRatio: MAP_ASPECT,
    marginTop: space[2],
  },
  selected: {
    marginTop: space[2],
    marginHorizontal: space[4],
    padding: space[4],
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    gap: space[2],
    ...shadow.md,
  },
  selectedHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
  },
  close: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[200],
  },
  cardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: space[1],
  },
  listHead: {
    marginTop: space[6],
  },
  listMeta: {
    marginTop: space[2],
    marginHorizontal: space[4],
  },
  segmented: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    marginHorizontal: space[4],
    backgroundColor: colors.neutral[200],
    borderRadius: radius.pill,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  segmentActive: {
    backgroundColor: colors.accent,
  },
  list: {
    paddingHorizontal: space[4],
    gap: space[4],
    marginTop: space[3],
  },
  empty: {
    padding: space[4],
    borderRadius: radius.card,
    backgroundColor: colors.neutral[100],
    ...shadow.sm,
  },
  emptyBody: {
    marginTop: space[2],
  },
  emptyAction: {
    alignSelf: 'flex-start',
    marginTop: space[3],
  },
});
