/**
 * Explore: the prototype's Map / For You pair behind a segmented
 * control, with the scope toggle and peek card the map screen uses.
 *
 * Data comes from the bundled fixtures via src/api/parks.ts, so this
 * renders real parks with real coordinates and no backend.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listSites, type SiteScope } from '../../api/parks';
// Placeholder ranking, not Dylan's engine - see the banner in this file.
import { provisionalMatches } from '../../api/provisionalMatches';
import {
  activeFilterCount,
  BodyText,
  Button,
  CROWD_CEILING,
  FilterButton,
  FilterSheet,
  Heading,
  NO_FILTERS,
  ParkCard,
  ParkMap,
  Tag,
  type FeedFilters,
} from '../../components';
import type { Site } from '../../data/parks';
import { useQuiz } from '../../quiz/QuizContext';
import { colors, radius, shadow, space } from '../../theme';

type ExploreTab = 'map' | 'foryou';

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

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { answers } = useQuiz();

  const [tab, setTab] = useState<ExploreTab>('map');
  const [scope, setScope] = useState<SiteScope>('parks');
  const [peek, setPeek] = useState<Site | null>(null);
  const [filters, setFilters] = useState<FeedFilters>(NO_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);

  const { data: sites = [] } = useQuery({
    queryKey: ['sites', scope],
    queryFn: () => listSites(scope),
  });

  const { data: matches = [] } = useQuery({
    queryKey: ['provisionalMatches', answers, scope],
    queryFn: () => provisionalMatches(answers, scope),
  });

  const filtered = useMemo(() => applyFilters(matches, filters), [matches, filters]);
  const topMatches = useMemo(() => filtered.slice(0, 12), [filtered]);
  const filterCount = activeFilterCount(filters);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space[6] }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Heading size={26}>Explore</Heading>
          <BodyText size={12} color={colors.neutral[600]} style={styles.headerMeta}>
            {tab === 'map'
              ? `${sites.length} sites · tap a dot to expand`
              : `${matches.length} matches from your answers`}
          </BodyText>
        </View>
      </View>

      <Segmented
        options={[
          { value: 'map', label: 'Map' },
          { value: 'foryou', label: 'For You' },
        ]}
        value={tab}
        onChange={(next) => setTab(next as ExploreTab)}
      />

      {tab === 'map' ? (
        <View style={styles.mapWrap}>
          <Segmented
            options={[
              { value: 'parks', label: 'Named parks' },
              { value: 'all', label: 'All sites' },
            ]}
            value={scope}
            onChange={(next) => {
              setScope(next as SiteScope);
              setPeek(null);
            }}
            size="small"
            style={styles.scopeToggle}
          />

          <ParkMap
            sites={sites}
            selectedId={peek?.id ?? null}
            // Tapping the selected dot again clears it, as the prototype does.
            onSelectSite={(site) => setPeek((prev) => (prev?.id === site.id ? null : site))}
            style={styles.map}
          />

          {peek ? <PeekCard site={peek} onDismiss={() => setPeek(null)} /> : null}
        </View>
      ) : (
        <>
          <View style={styles.feedBar}>
            <BodyText size={12} color={colors.neutral[600]} style={styles.feedBarText}>
              {filterCount > 0
                ? `${filtered.length} of ${matches.length} match your filters`
                : 'Ranked by how well each park fits your answers'}
            </BodyText>
            <FilterButton count={filterCount} onPress={() => setFilterOpen(true)} />
          </View>

          <ScrollView
            style={styles.feed}
            contentContainerStyle={[styles.feedContent, { paddingBottom: space[8] }]}
            showsVerticalScrollIndicator={false}
          >
            {topMatches.map(({ site, score, reason }, index) => (
              <ParkCard
                key={site.id}
                site={site}
                score={score}
                reason={reason}
                rank={index + 1}
              />
            ))}

            {topMatches.length === 0 ? (
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
          </ScrollView>

          <FilterSheet
            visible={filterOpen}
            value={filters}
            countFor={(draft) => applyFilters(matches, draft).length}
            onApply={(next) => {
              setFilters(next);
              setFilterOpen(false);
            }}
            onClose={() => setFilterOpen(false)}
          />
        </>
      )}
    </View>
  );
}

/** The prototype's pill segmented control, used for both toggles here. */
function Segmented({
  options,
  value,
  onChange,
  size = 'regular',
  style,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  size?: 'regular' | 'small';
  style?: object;
}) {
  return (
    <View style={[styles.segmented, style]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[
              styles.segment,
              size === 'small' && styles.segmentSmall,
              active && styles.segmentActive,
            ]}
          >
            <BodyText
              size={size === 'small' ? 12 : 13}
              weight="semibold"
              color={active ? colors.bg : colors.neutral[700]}
            >
              {option.label}
            </BodyText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The card that rises over the map when a dot is tapped. */
function PeekCard({ site, onDismiss }: { site: Site; onDismiss: () => void }) {
  return (
    <View style={styles.peek}>
      <View style={styles.peekHead}>
        <View style={styles.peekHeadText}>
          <Heading size={19}>{site.name}</Heading>
          <BodyText size={12} color={colors.neutral[600]} style={styles.headerMeta}>
            {`${site.kind} · ${site.state}`}
          </BodyText>
        </View>
        <Tag tone="accent2" label={`${site.vis.toFixed(1)}M`} />
      </View>

      <BodyText size={13} lineHeightRatio={1.45} color={colors.neutral[700]} style={styles.peekBlurb}>
        {site.blurb}
      </BodyText>

      <View style={styles.cardTags}>
        <Tag tone="outline" label={site.feature} />
        <Tag tone="neutral" label={site.seasons.join(' · ') || 'Year-round'} />
        {site.permit ? <Tag tone="accent" label="Permit needed" /> : null}
      </View>

      <Button label="Dismiss" variant="secondary" onPress={onDismiss} style={styles.peekDismiss} />
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
  segmented: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    marginTop: space[3],
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
  segmentSmall: {
    paddingVertical: 8,
  },
  segmentActive: {
    backgroundColor: colors.accent,
  },
  scopeToggle: {
    marginTop: space[2],
  },
  mapWrap: {
    flex: 1,
  },
  map: {
    flex: 1,
    marginTop: space[2],
  },
  peek: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    padding: space[4],
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[100],
    gap: space[2],
    ...shadow.lg,
  },
  peekHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[3],
  },
  peekHeadText: {
    flex: 1,
  },
  peekBlurb: {
    marginTop: space[1],
  },
  peekDismiss: {
    marginTop: space[2],
  },
  feed: {
    flex: 1,
    marginTop: space[2],
  },
  feedContent: {
    paddingHorizontal: space[4],
    gap: space[4],
  },
  cardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: space[3],
  },
  feedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    marginTop: space[3],
  },
  feedBarText: {
    flex: 1,
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
