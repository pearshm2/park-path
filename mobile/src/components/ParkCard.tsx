/**
 * A park in the Explore card deck.
 *
 * Follows the prototype's card, tightened so a card and the map fit on
 * screen together: a slim terrain band, the park name in the display
 * face, the reason it surfaced in the deep accent step (one line), one
 * row of tags and when to go. A small arrow at the bottom shows more (a
 * little of the description and the rest of the facts) when the deck is
 * raised for it. The band stands in for the prototype's photograph — see
 * TerrainIcon for why.
 *
 * The band is coloured by terrain, not region, so a deck dealt from one
 * region still varies card to card. The region shows instead as a small
 * swatch beside the park's details, matching the map and its key.
 */

import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { Site } from '../data/parks';
import { crowdLabel, factRows } from '../data/siteFacts';
import { monthLabel, useTrips, type TripEntry } from '../trips/TripsContext';
import { regionForState } from '../data/regions';
import { colors, radius, shadow, space } from '../theme';
import { STATUS_DOT } from './ParkMap';
import { Tag } from './Tag';
import { TERRAIN_LABEL, TerrainIcon, terrainTone } from './TerrainIcon';
import { ExpandIcon } from './ExpandIcon';
import { BodyText, Heading } from './Typography';

const EFFORT_LABEL: Record<number, string> = {
  1: 'Easy walks',
  2: 'Half-day hikes',
  3: 'All day, strenuous',
};

export function ParkCard({
  site,
  reason,
  rank,
  markWishlist = false,
  onOpenTrip,
  saved = false,
  onToggleSave,
  onSnooze,
  more = false,
  onToggleMore,
  onPress,
  onExpand,
  style,
}: {
  site: Site;
  reason?: string;
  /** 1-based position among the picks, shown as a badge on the band. */
  rank?: number;
  /** Flags a wishlist park on the band, for decks that mix them with others. */
  markWishlist?: boolean;
  /** The visited card's trip link: open that trip, or log one if none. */
  onOpenTrip?: (entry: TripEntry | undefined) => void;
  /** Whether the park is on your wishlist; drives the save button. */
  saved?: boolean;
  /** Shows the save button, which adds the park to or removes it from the wishlist. */
  onToggleSave?: () => void;
  /** Shows the "Not for now" button, which sets the park aside for a while. */
  onSnooze?: () => void;
  /** Shows the description and remaining facts (the deck has been raised for them). */
  more?: boolean;
  /** Shows the arrow that shows more or less of the park. */
  onToggleMore?: () => void;
  onPress?: () => void;
  /** Shows the expand button, which opens the site's detail sheet. */
  onExpand?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const tone = terrainTone(site.group);
  const region = regionForState(site.state);
  const { visitSummary } = useTrips();
  const visits = site.status === 'visited' ? visitSummary(site.id) : undefined;
  // The Features and Facts tabs, as on the park's page; the tags above
  // already give its effort, main feature and crowds.
  const [tab, setTab] = useState<'features' | 'facts'>('features');
  const allRows = factRows(site);
  const rows = allRows.filter((row) => (tab === 'features' ? FEATURES : FACTS).has(row.label));

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[site.name, reason]
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
                  visits && monthLabel(visits.last),
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
            {onSnooze ? <SnoozeButton siteName={site.name} onSnooze={onSnooze} /> : null}
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
              onPress={onOpenTrip ? () => onOpenTrip(visits?.entry) : undefined}
              disabled={!onOpenTrip}
              hitSlop={6}
              accessibilityRole="link"
              style={({ pressed }) => [styles.tripLink, pressed && styles.tripLinkPressed]}
            >
              {visits?.entry ? (
                <BodyText size={12} color={colors.neutral[700]} numberOfLines={1}>
                  {'From your trip: '}
                  <BodyText size={12} weight="semibold" color={colors.accentRamp[700]}>
                    {`${visits.entry.title} →`}
                  </BodyText>
                </BodyText>
              ) : (
                <BodyText size={12} weight="semibold" color={colors.accentRamp[700]}>
                  + Add this visit to a trip
                </BodyText>
              )}
            </Pressable>
          ) : null}

          {/* About the park and its facts: the start of each on the card, all
              of it once the arrow raises the deck. Clipped to the room there
              is, so the arrow below always shows. */}
          <View style={styles.details}>
            {site.description ? (
              <>
                <BodyText size={10} weight="semibold" color={colors.accentRamp[700]} style={styles.detailsLabel}>
                  ABOUT
                </BodyText>
                <BodyText
                  size={12.5}
                  lineHeightRatio={1.42}
                  color={colors.neutral[800]}
                  numberOfLines={more ? 5 : 2}
                >
                  {site.description}
                </BodyText>
              </>
            ) : null}
            <View style={styles.switch} accessibilityRole="tablist">
              {(['features', 'facts'] as const).map((key) => {
                const active = tab === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setTab(key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    style={[styles.switchOption, active && styles.switchActive]}
                  >
                    <BodyText
                      size={10.5}
                      weight="semibold"
                      color={active ? colors.neutral[100] : colors.neutral[700]}
                    >
                      {key === 'features' ? 'Features' : 'Facts'}
                    </BodyText>
                  </Pressable>
                );
              })}
            </View>
            {/* Lowered, just the tab titles show; the arrow opens the rows. */}
            {(more ? rows : []).map((row) => (
              <View key={row.label} style={styles.factRow}>
                <BodyText
                  size={12}
                  weight="medium"
                  color={colors.neutral[700]}
                  style={styles.factLabel}
                  numberOfLines={1}
                >
                  {row.label}
                </BodyText>
                <BodyText size={12} weight="semibold" color={row.color} numberOfLines={1}>
                  {row.value}
                </BodyText>
              </View>
            ))}
          </View>

          {/* A small arrow to show more of the park (or less), raising the deck. */}
          {onToggleMore ? (
            <Pressable
              onPress={onToggleMore}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={more ? 'Show less about the park' : 'Show more about the park'}
              style={({ pressed }) => [styles.moreToggle, pressed && styles.moreTogglePressed]}
            >
              <ChevronIcon up={more} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Which facts go under each tab; effort, feature and crowds are the tags above. */
const FEATURES = new Set(['Best time to go', 'Typical stay', 'Permit or lottery']);
const FACTS = new Set(['Annual visits', 'Average per day']);

/** A small chevron, down for "more", up for "less". */
function ChevronIcon({ up }: { up: boolean }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path
        d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}
        fill="none"
        stroke={colors.neutral[700]}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** How long a held press waits before the tip shows, and how long it stays. */
const TIP_DELAY = 350;
const TIP_LINGER = 2200;

/**
 * "Not for now": a snooze clock that sets the park aside for a while. An
 * icon to save room on the card; holding it (or hovering, in a browser)
 * shows a short tip saying what it does.
 */
function SnoozeButton({ siteName, onSnooze }: { siteName: string; onSnooze: () => void }) {
  const [tip, setTip] = useState(false);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showTip(linger: boolean) {
    if (hide.current) clearTimeout(hide.current);
    setTip(true);
    if (linger) hide.current = setTimeout(() => setTip(false), TIP_LINGER);
  }

  useEffect(
    () => () => {
      if (hide.current) clearTimeout(hide.current);
    },
    [],
  );

  return (
    <View>
      <Pressable
        onPress={onSnooze}
        // A held press shows the tip instead of setting the park aside.
        onLongPress={() => showTip(true)}
        delayLongPress={TIP_DELAY}
        onHoverIn={() => showTip(false)}
        onHoverOut={() => setTip(false)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Not for now: set ${siteName} aside`}
        accessibilityHint="Leaves it out of your recommendations for 30 days. It isn't a dislike."
        style={({ pressed }) => [styles.expand, pressed && styles.expandPressed]}
      >
        <SnoozeIcon />
      </Pressable>
      {tip ? (
        <View style={styles.tip} pointerEvents="none">
          <BodyText size={12} weight="semibold" color={colors.neutral[100]}>
            Not for now
          </BodyText>
          <BodyText size={11} lineHeightRatio={1.35} color={colors.neutral[300]}>
            Sets this park aside from your picks for 30 days. Not a dislike.
          </BodyText>
        </View>
      ) : null}
    </View>
  );
}

/** A clock with a little "z": snooze, as on a phone's alarm. */
function SnoozeIcon() {
  const ink = colors.neutral[800];
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24">
      <Path
        d="M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 1.5"
        fill="none"
        stroke={ink}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16.5 2.5h4l-4 4h4"
        fill="none"
        stroke={ink}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
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
    // Above the lines below it, which the snooze tip opens over.
    zIndex: 2,
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
  tip: {
    position: 'absolute',
    top: 34,
    right: -6,
    width: 190,
    gap: 2,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[900],
    zIndex: 10,
    ...shadow.md,
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
  details: {
    flex: 1,
    // Shrinks to the room there is (clipping the end), so the arrow below
    // never gets pushed out of the card.
    minHeight: 0,
    overflow: 'hidden',
    gap: 3,
    marginTop: space[2],
  },
  detailsLabel: {
    letterSpacing: 1,
  },
  // The same pill switch as the park's page and Settings.
  // Compact: sized to its two titles, so it fits the lowered card.
  switch: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: 2,
    padding: 2,
    marginTop: 6,
    marginBottom: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[200],
  },
  switchOption: {
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  switchActive: {
    backgroundColor: colors.accent,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[2],
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  factLabel: {
    flex: 1,
  },
  moreToggle: {
    alignSelf: 'center',
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[200],
  },
  moreTogglePressed: {
    backgroundColor: colors.neutral[300],
  },
  tags: {
    flexDirection: 'row',
    gap: 6,
    marginTop: space[2],
    overflow: 'hidden',
  },
});
