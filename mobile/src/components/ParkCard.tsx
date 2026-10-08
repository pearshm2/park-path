/**
 * A park in the Explore card deck.
 *
 * Follows the prototype's card, tightened so a card and the map fit on
 * screen together: a slim terrain band, the park name in the display
 * face, the reason it surfaced in the deep accent step (one line), one
 * row of tags, then the match strength on a single line. The band stands in for the
 * prototype's photograph — see TerrainIcon for why.
 *
 * The band is coloured by terrain, not region, so a deck dealt from one
 * region still varies card to card. The region shows instead as a small
 * swatch beside the park's details, matching the map and its key.
 */

import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Site } from '../data/parks';
import { regionForState } from '../data/regions';
import { colors, radius, shadow, space } from '../theme';
import { STATUS_DOT } from './ParkMap';
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
  markWishlist = false,
  onPress,
  style,
}: {
  site: Site;
  /** 0–1 from the provisional ranking. Omitted for parks it did not score. */
  score?: number;
  reason?: string;
  /** 1-based position among the picks, shown as a badge on the band. */
  rank?: number;
  /** Flags a wishlist park on the band, for decks that mix them with others. */
  markWishlist?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const tone = terrainTone(site.group);
  const region = regionForState(site.state);
  const percent = score === undefined ? null : Math.round(score * 100);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[site.name, percent !== null && `${percent}% match`, reason]
        .filter(Boolean)
        .join('. ')}
      style={({ pressed }) => [styles.card, style, pressed && onPress && styles.pressed]}
    >
      {/* Terrain band — the card's visual anchor, and what makes the
          deck scannable without reading every name. */}
      <View style={[styles.band, { backgroundColor: tone.band }]}>
        <TerrainIcon group={site.group} size={26} />
        <BodyText size={10} weight="semibold" color={tone.ink} style={styles.bandLabel}>
          {TERRAIN_LABEL[site.group]?.toUpperCase() ?? site.group.toUpperCase()}
        </BodyText>
        {markWishlist && site.status === 'wishlist' ? (
          <View style={styles.wishlistBadge}>
            {/* The map's wishlist pin, so the badge reads like the key. */}
            <View style={styles.wishlistRing} />
            <BodyText size={11} weight="semibold" color={colors.accent2Ramp[800]}>
              Wishlist
            </BodyText>
          </View>
        ) : null}
        {rank !== undefined ? (
          <View style={styles.rankBadge}>
            <BodyText size={11} weight="bold" color={colors.bg}>
              {`#${rank}`}
            </BodyText>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Heading size={18} numberOfLines={1}>
          {site.name}
        </Heading>
        <View style={styles.meta}>
          {region ? <View style={[styles.regionSwatch, { backgroundColor: region.fill }]} /> : null}
          <BodyText size={12} color={colors.neutral[600]} numberOfLines={1} style={styles.metaText}>
            {region ? (
              <BodyText size={12} weight="semibold" color={colors.neutral[800]}>
                {`${region.label} · `}
              </BodyText>
            ) : null}
            {`${site.kind} · ${site.state}`}
          </BodyText>
        </View>

        {reason ? (
          <BodyText
            size={12.5}
            weight="medium"
            lineHeightRatio={1.4}
            color={colors.accentRamp[800]}
            style={styles.reason}
            numberOfLines={1}
          >
            {reason}
          </BodyText>
        ) : null}

        {/* One row only; anything that does not fit is clipped. */}
        <View style={styles.tags}>
          {site.permit ? <Tag tone="accent" label="Permit needed" /> : null}
          <Tag tone="accent2" label={crowdLabel(site.vis)} />
          <Tag tone="outline" label={site.feature} />
          <Tag tone="neutral" label={EFFORT_LABEL[site.effort] ?? `Effort ${site.effort}`} />
        </View>

        {/* Match strength on one line — the point of the deck is why this
            park and not another. Pinned to the bottom of the card. */}
        {percent !== null ? (
          <View style={styles.matchRow}>
            <BodyText
              size={10}
              weight="semibold"
              color={colors.neutral[600]}
              style={styles.matchLabel}
            >
              MATCH
            </BodyText>
            <View style={styles.matchTrack}>
              <View style={[styles.matchFill, { width: `${Math.max(percent, 3)}%` }]} />
            </View>
            <BodyText size={14} weight="bold" color={colors.accentRamp[700]}>
              {`${percent}%`}
            </BodyText>
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
    ...shadow.md,
  },
  pressed: {
    opacity: 0.92,
  },
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingVertical: 6,
    paddingHorizontal: space[4],
  },
  bandLabel: {
    flex: 1,
    letterSpacing: 1,
  },
  wishlistBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[100],
  },
  wishlistRing: {
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: STATUS_DOT.wishlist.stroke,
    backgroundColor: STATUS_DOT.wishlist.fill,
  },
  rankBadge: {
    paddingVertical: 2,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[900],
  },
  body: {
    flex: 1,
    paddingHorizontal: space[4],
    paddingTop: space[3],
    paddingBottom: space[3],
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  /** The same rounded square as the map key's region swatches. */
  regionSwatch: {
    width: 11,
    height: 11,
    borderRadius: 3,
  },
  metaText: {
    flexShrink: 1,
  },
  reason: {
    marginTop: space[2],
  },
  tags: {
    flexDirection: 'row',
    gap: 6,
    marginTop: space[2],
    overflow: 'hidden',
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginTop: 'auto',
    paddingTop: space[2],
  },
  matchLabel: {
    letterSpacing: 1,
  },
  matchTrack: {
    flex: 1,
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
