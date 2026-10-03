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
import { BodyText, Button, Heading, ParkMap, Tag } from '../../components';
import type { Site } from '../../data/parks';
import { useQuiz } from '../../quiz/QuizContext';
import { colors, radius, shadow, space } from '../../theme';

type ExploreTab = 'map' | 'foryou';

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { answers } = useQuiz();

  const [tab, setTab] = useState<ExploreTab>('map');
  const [scope, setScope] = useState<SiteScope>('parks');
  const [peek, setPeek] = useState<Site | null>(null);

  const { data: sites = [] } = useQuery({
    queryKey: ['sites', scope],
    queryFn: () => listSites(scope),
  });

  const { data: matches = [] } = useQuery({
    queryKey: ['provisionalMatches', answers, scope],
    queryFn: () => provisionalMatches(answers, scope),
  });

  const topMatches = useMemo(() => matches.slice(0, 12), [matches]);

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
        <ScrollView
          style={styles.feed}
          contentContainerStyle={[styles.feedContent, { paddingBottom: space[8] }]}
          showsVerticalScrollIndicator={false}
        >
          {topMatches.map(({ site, score, reason }) => (
            <View key={site.id} style={styles.card}>
              <Heading size={20}>{site.name}</Heading>
              <BodyText size={12} color={colors.neutral[600]}>
                {`${site.kind} · ${site.state}`}
              </BodyText>
              <BodyText
                size={12.5}
                weight="medium"
                lineHeightRatio={1.45}
                color={colors.accentRamp[800]}
                style={styles.cardReason}
              >
                {reason}
              </BodyText>

              <View style={styles.cardTags}>
                <Tag tone="accent2" label={`${site.vis.toFixed(1)}M visits`} />
                <Tag tone="outline" label={site.feature} />
                <Tag tone="neutral" label={`${site.days} ${site.days === 1 ? 'day' : 'days'}`} />
              </View>

              <View style={styles.scoreRow}>
                <BodyText size={11} weight="medium" color={colors.neutral[700]} style={styles.scoreLabel}>
                  Match
                </BodyText>
                <View style={styles.scoreTrack}>
                  <View style={[styles.scoreFill, { width: `${Math.round(score * 100)}%` }]} />
                </View>
                <BodyText size={10.5} weight="semibold" color={colors.neutral[600]}>
                  {`${Math.round(score * 100)}%`}
                </BodyText>
              </View>
            </View>
          ))}

          {topMatches.length === 0 ? (
            <View style={styles.empty}>
              <BodyText size={13} color={colors.neutral[700]}>
                Nothing matched those answers. Widen your terrain or season in Settings.
              </BodyText>
            </View>
          ) : null}
        </ScrollView>
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
    marginTop: space[3],
  },
  feedContent: {
    paddingHorizontal: space[4],
    gap: space[4],
  },
  card: {
    padding: space[4],
    borderRadius: radius.card,
    backgroundColor: colors.neutral[100],
    gap: space[1],
    ...shadow.md,
  },
  cardReason: {
    marginTop: space[2],
  },
  cardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: space[3],
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: space[4],
  },
  scoreLabel: {
    width: 44,
  },
  scoreTrack: {
    flex: 1,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[300],
    overflow: 'hidden',
  },
  scoreFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.accent2Ramp[500],
  },
  empty: {
    padding: space[4],
    borderRadius: radius.md,
    backgroundColor: colors.neutral[100],
  },
});
