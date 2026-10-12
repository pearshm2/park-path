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
import Svg, { Path } from 'react-native-svg';

import type { Site } from '../data/parks';
import { visitMonth, visitSummary, type Trip } from '../data/visits';
import { regionForState } from '../data/regions';
import { colors, radius, shadow, space } from '../theme';
import { STATUS_DOT } from './ParkMap';
import { Tag } from './Tag';
import { TERRAIN_LABEL, TerrainIcon, terrainTone } from './TerrainIcon';
import { ExpandIcon } from './ExpandIcon';
import { BodyText, Heading } from './Typography';

/** Visitation is the closest thing the data has to a crowd signal. */
export function crowdLabel(visitsMillions: number): string {
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
  onOpenTrip,
  saved = false,
  onToggleSave,
  onPress,
  onExpand,
  style,
}: {
  site: Site;
  /** 0–1 from the recommendation engine. Omitted for parks it did not score. */
  score?: number;
  reason?: string;
  /** 1-based position among the picks, shown as a badge on the band. */
  rank?: number;
  /** Flags a wishlist park on the band, for decks that mix them with others. */
  markWishlist?: boolean;
  /** The visited card's trip link: open that trip, or log one if none. */
  onOpenTrip?: (trip: Trip | undefined) => void;
  /** Whether the park is on your wishlist; drives the save button. */
  saved?: boolean;
  /** Shows the save button, which adds the park to or removes it from the wishlist. */
  onToggleSave?: () => void;
  onPress?: () => void;
  /** Shows the expand button, which opens the site's detail sheet. */
  onExpand?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const tone = terrainTone(site.group);
  const region = regionForState(site.state);
  const percent = score === undefined ? null : Math.round(score * 100);
  const visits = site.status === 'visited' ? visitSummary(site.id) : undefined;

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
      {/* Two layers on purpose: on iOS, clipping a view to its corners
          (overflow: hidden) also clips its shadow, so the outer layer
          carries the shadow and border and this inner one does the clipping. */}
      <View style={styles.clip}>
        {/* Terrain band — the card's visual anchor, and what makes the
            deck scannable without reading every name. */}
        <View style={[styles.band, { backgroundColor: tone.band }]}>
          {site.group ? <TerrainIcon group={site.group} size={26} /> : null}
          <BodyText size={10} weight="semibold" color={tone.ink} style={styles.bandLabel}>
            {site.group
              ? (TERRAIN_LABEL[site.group]?.toUpperCase() ?? site.group.toUpperCase())
              : site.kind.toUpperCase()}
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
          {site.status === 'visited' ? (
            // Stamped like the completed regions on the map: gold on white.
            <View style={styles.visitedStamp}>
              <CheckIcon />
              <BodyText size={10.5} weight="bold" color={VISITED_GOLD} numberOfLines={1}>
                {[
                  'Visited',
                  visits && visitMonth(visits.last),
                  visits && visits.count > 1 && `×${visits.count}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
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
          <View style={styles.nameRow}>
            <Heading size={18} numberOfLines={1} style={styles.name}>
              {site.name}
            </Heading>
            {onToggleSave ? (
              // Its own target too, beside expand and the same size.
              <Pressable
                onPress={onToggleSave}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityState={{ selected: saved }}
                accessibilityLabel={
                  saved ? `Remove ${site.name} from your wishlist` : `Save ${site.name} to your wishlist`
                }
                style={({ pressed }) => [
                  styles.expand,
                  saved && styles.saveOn,
                  pressed && styles.expandPressed,
                ]}
              >
                <BookmarkIcon filled={saved} />
              </Pressable>
            ) : null}
            {onExpand ? (
              // Its own target, so the card's tap (zoom to region) is untouched.
              <Pressable
                onPress={onExpand}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Details for ${site.name}`}
                style={({ pressed }) => [styles.expand, pressed && styles.expandPressed]}
              >
                <ExpandIcon color={colors.neutral[800]} />
              </Pressable>
            ) : null}
          </View>
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
            {site.vis !== null ? <Tag tone="accent2" label={crowdLabel(site.vis)} /> : null}
            {site.feature ? <Tag tone="outline" label={site.feature} /> : null}
            {site.effort !== null ? (
              <Tag tone="neutral" label={EFFORT_LABEL[site.effort] ?? `Effort ${site.effort}`} />
            ) : null}
          </View>

          {/* A visited park links to the trip it was part of, or asks for one. */}
          {site.status === 'visited' ? (
            <Pressable
              onPress={onOpenTrip ? () => onOpenTrip(visits?.trip) : undefined}
              disabled={!onOpenTrip}
              hitSlop={6}
              accessibilityRole="link"
              style={({ pressed }) => [styles.tripLink, pressed && styles.tripLinkPressed]}
            >
              {visits?.trip ? (
                <BodyText size={12} color={colors.neutral[700]} numberOfLines={1}>
                  {'From your trip: '}
                  <BodyText size={12} weight="semibold" color={colors.accentRamp[700]}>
                    {`${visits.trip.title} →`}
                  </BodyText>
                </BodyText>
              ) : (
                <BodyText size={12} weight="semibold" color={colors.accentRamp[700]}>
                  + Add this visit to a trip
                </BodyText>
              )}
            </Pressable>
          ) : null}

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
      </View>
    </Pressable>
  );
}

/** The gold of the completed-region stamp on the map. */
const VISITED_GOLD = '#a87a12';

function CheckIcon() {
  return (
    <Svg width={10} height={10} viewBox="0 0 24 24">
      <Path
        d="M4 12.5l5 5L20 6.5"
        fill="none"
        stroke={VISITED_GOLD}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** A bookmark: outlined when unsaved, filled in the wishlist pin's colour when saved. */
export function BookmarkIcon({ filled, size = 14 }: { filled: boolean; size?: number }) {
  const ink = filled ? STATUS_DOT.wishlist.stroke : colors.neutral[800];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.5-6.5 4.5v-16a1 1 0 0 1 1-1z"
        fill={filled ? ink : 'none'}
        stroke={ink}
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    backgroundColor: colors.neutral[100],
    // The card sits on a sheet of the same colour, so the edge needs both a
    // line and a shadow to read on a phone.
    borderWidth: 1,
    borderColor: colors.neutral[300],
    ...shadow.md,
  },
  clip: {
    flex: 1,
    borderRadius: radius.card - 1,
    overflow: 'hidden',
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
  visitedStamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: '#c8961e',
    backgroundColor: colors.neutral[100],
    flexShrink: 1,
  },
  tripLink: {
    alignSelf: 'flex-start',
    marginTop: space[2],
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  tripLinkPressed: {
    opacity: 0.6,
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  name: {
    flex: 1,
  },
  expand: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[200],
  },
  expandPressed: {
    backgroundColor: colors.neutral[300],
  },
  saveOn: {
    backgroundColor: colors.accent2Ramp[100],
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
