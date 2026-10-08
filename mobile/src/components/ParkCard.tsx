/**
 * A recommended park in the Explore list, under the map.
 *
 * Follows the prototype's card: a visual band across the top, the park
 * name in the display face, the reason it surfaced in the deep accent
 * step, a tag row, then the match strength. The band stands in for the
 * prototype's photograph — see TerrainIcon for why.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import type { Site } from '../data/parks';
import { colors, radius, shadow, space } from '../theme';
import { Tag } from './Tag';
import { TERRAIN_LABEL, TerrainIcon, terrainTone } from './TerrainIcon';
import { BodyText, Heading } from './Typography';

/** Visitation is the closest thing the data has to a crowd signal. */
function crowdLabel(visitsMillions: number): string {
  if (visitsMillions >= 4) return 'Very busy';
  if (visitsMillions >= 1.5) return 'Busy';
  if (visitsMillions >= 0.5) return 'Some company';
  return 'Quiet';
}

const EFFORT_LABEL: Record<number, string> = {
  1: 'Easy walks',
  2: 'Half-day hikes',
  3: 'All day, strenuous',
};

export function ParkCard({
  site,
  score,
  reason,
  rank,
  highlighted = false,
  onPress,
}: {
  site: Site;
  /** 0–1 from the provisional ranking. Omitted for parks it did not score. */
  score?: number;
  reason?: string;
  /** 1-based position among the picks, shown as a badge on the band. */
  rank?: number;
  /** Outlines the card while its pin is selected on the map. */
  highlighted?: boolean;
  onPress?: () => void;
}) {
  const tone = terrainTone(site.group);
  const percent = score === undefined ? null : Math.round(score * 100);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[site.name, percent !== null && `${percent}% match`, reason]
        .filter(Boolean)
        .join('. ')}
      style={({ pressed }) => [
        styles.card,
        highlighted && styles.highlighted,
        pressed && onPress && styles.pressed,
      ]}
    >
      {/* Terrain band — the card's visual anchor, and what makes the
          feed scannable without reading every name. */}
      <View style={[styles.band, { backgroundColor: tone.band }]}>
        <TerrainIcon group={site.group} size={34} />
        <View style={styles.bandRight}>
          {rank !== undefined ? (
            <View style={styles.rankBadge}>
              <BodyText size={11} weight="bold" color={colors.bg}>
                {`#${rank}`}
              </BodyText>
            </View>
          ) : null}
          <BodyText size={10} weight="semibold" color={tone.ink} style={styles.bandLabel}>
            {TERRAIN_LABEL[site.group]?.toUpperCase() ?? site.group.toUpperCase()}
          </BodyText>
        </View>
      </View>

      <View style={styles.body}>
        <Heading size={20}>{site.name}</Heading>
        <BodyText size={12} color={colors.neutral[600]} style={styles.meta}>
          {`${site.kind} · ${site.state}`}
        </BodyText>

        {reason ? (
          <BodyText
            size={12.5}
            weight="medium"
            lineHeightRatio={1.45}
            color={colors.accentRamp[800]}
            style={styles.reason}
          >
            {reason}
          </BodyText>
        ) : null}

        <View style={styles.tags}>
          <Tag tone="accent2" label={crowdLabel(site.vis)} />
          <Tag tone="outline" label={site.feature} />
          <Tag tone="neutral" label={EFFORT_LABEL[site.effort] ?? `Effort ${site.effort}`} />
          <Tag tone="neutral" label={`${site.days} ${site.days === 1 ? 'day' : 'days'}`} />
          {site.permit ? <Tag tone="accent" label="Permit needed" /> : null}
        </View>

        {/* Match strength, given its own row and a readable number — the
            whole point of the feed is why this park and not another. */}
        {percent !== null ? (
          <View style={styles.matchRow}>
            <View style={styles.matchHeader}>
              <BodyText size={10} weight="semibold" color={colors.neutral[600]} style={styles.matchLabel}>
                MATCH
              </BodyText>
              <BodyText size={15} weight="bold" color={colors.accentRamp[700]}>
                {`${percent}%`}
              </BodyText>
            </View>
            <View style={styles.matchTrack}>
              <View style={[styles.matchFill, { width: `${Math.max(percent, 3)}%` }]} />
            </View>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    backgroundColor: colors.neutral[100],
    overflow: 'hidden',
    // Always present so highlighting does not nudge the layout.
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadow.md,
  },
  highlighted: {
    borderColor: colors.accent,
  },
  pressed: {
    opacity: 0.92,
  },
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[3],
    paddingHorizontal: space[4],
  },
  bandRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  rankBadge: {
    paddingVertical: 2,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[900],
  },
  bandLabel: {
    letterSpacing: 1,
  },
  body: {
    padding: space[4],
  },
  meta: {
    marginTop: 3,
  },
  reason: {
    marginTop: space[2],
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: space[3],
  },
  matchRow: {
    marginTop: space[4],
    gap: 6,
  },
  matchHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  matchLabel: {
    letterSpacing: 1,
  },
  matchTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[300],
    overflow: 'hidden',
  },
  matchFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
});
