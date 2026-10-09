/**
 * The Explore map: US state outlines tinted by region, with a pin per park.
 *
 * Built with react-native-svg over d3-geo's Albers USA projection, which
 * is the projection the design prototype used — it tucks Alaska and
 * Hawaii into the lower left so the whole country fits a phone-shaped
 * box. react-native-maps was deliberately not used here: it does not run
 * on web at all, and tile imagery cannot carry the Organic palette.
 *
 * Three kinds of pin share the map. Parks in `rankById` are the
 * recommendation engine's picks and get a large numbered pin that matches
 * their card below the map; numbers are reserved for them. Parks in
 * `matchIds` (the Explore filters) get a larger dot in the match colour,
 * never a number. Every other park is a small dot styled by its visit
 * status, and fades back so the picks and matches read first.
 *
 * With `featureIcons` on (the 62-park view), focusing a region or zooming
 * in past ICON_ZOOM swaps each park's dot for a badge with its signature feature (see
 * FeatureGlyph). The badge's ring keeps the dot's meaning: status, match,
 * or pick, and picks keep their number in a corner bubble. At full-country
 * size there is no room for them, so the dots stay.
 *
 * Passing `focusRegion` zooms the map onto that region and hides every
 * other region and its pins. Pinching zooms around the fingers, and once
 * zoomed in a one-finger drag pans; at full-country size a drag is left to
 * the page so it still scrolls. The zoom is a transform on the state
 * outlines; pins are placed in screen space instead, so they keep their
 * size and spread apart as the map grows.
 *
 * A consequence of Albers USA worth knowing: it has no projection for
 * territories, so American Samoa and the Virgin Islands return null and
 * are absent from the map. The prototype notes the same limitation.
 */

import { geoAlbersUsa, geoPath } from 'd3-geo';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';

import type { Site, SiteStatus } from '../data/parks';
import { REGIONS, regionForState, STATE_REGION, type RegionId } from '../data/regions';
import { US_STATES } from '../data/usStates';
import { colors, fonts, radius, shadow } from '../theme';
import { ExpandIcon } from './ExpandIcon';
import { featureForPark, FeatureGlyph, type Feature } from './FeatureGlyph';
import { terrainTone } from './TerrainIcon';
import { BodyText } from './Typography';

/**
 * What the projection is sized to: every state but Alaska. Alaska's inset
 * trails its Aleutian Islands far to the left, so fitting to it pushed the
 * lower 48 off-centre and shrank them. Without it the map is about 8%
 * larger and centred; only the far tip of the Aleutians (no parks there)
 * runs off the left edge, and Alaska's parks all stay in view.
 */
const FIT_COLLECTION = {
  type: 'FeatureCollection' as const,
  features: US_STATES.filter((state) => state.id !== '02'),
};

/** How each visit status draws as a small dot. Shared with the map key. */
export const STATUS_DOT: Record<SiteStatus, { fill: string; stroke: string; label: string }> = {
  visited: { fill: colors.accentRamp[700], stroke: colors.neutral[100], label: 'Visited' },
  wishlist: { fill: colors.neutral[100], stroke: colors.accent2Ramp[700], label: 'Wishlist' },
  new: { fill: colors.neutral[600], stroke: colors.neutral[100], label: 'Not yet' },
};

/** The numbered pin's fill. Shared with the map key. */
export const PICK_FILL = colors.accent;

/** A park that matches the active filters. Shared with the map key. */
export const MATCH_DOT = { fill: colors.accent2Ramp[600], stroke: colors.neutral[100] };

/** Small dots are hard to hit with a finger, so each gets a wider invisible target. */
const HIT_RADIUS = 11;

/** How far in the map must be zoomed before feature badges replace dots. */
const ICON_ZOOM = 1.6;
/** A feature badge's radius, and its glyph's width. */
const BADGE_R = 12;
const GLYPH_SIZE = 15;
/** How far the selected badge's glow reaches past its ring. */
const HALO = 9;

/** Room left around a zoomed region, and the most it may be magnified. */
const ZOOM_PADDING = 22;
const MAX_ZOOM = 4;
const ZOOM_MS = 380;

/** Limits on pinching: never smaller than the whole country, up to 8x. */
const PINCH_MIN = 1;
const PINCH_MAX = 8;

/** Scale then translate, applied to projected map coordinates. */
type View2D = { k: number; tx: number; ty: number };
const IDENTITY: View2D = { k: 1, tx: 0, ty: 0 };

type ParkMapProps = {
  sites: Site[];
  /** Site id -> 1-based rank, for the parks drawn as numbered pins. */
  rankById?: ReadonlyMap<string, number>;
  /** Parks matching the active filters, drawn in the match colour. */
  matchIds?: ReadonlySet<string>;
  selectedId?: string | null;
  /** Zooms onto this region; omit for the whole country. */
  focusRegion?: RegionId | null;
  /** Show feature badges once zoomed in. Meant for the national parks view. */
  featureIcons?: boolean;
  /** Show the badges at every zoom, for a map big enough to fit them (full screen). */
  iconsAtAnyZoom?: boolean;
  /** Shows a button in the bottom corner that opens the map full screen. */
  onExpand?: () => void;
  /**
   * Extra room for the map's own buttons, for a map that runs under the
   * notch or status bar (the full-screen view).
   */
  controlInset?: { top?: number; right?: number; bottom?: number };
  onSelectSite?: (site: Site) => void;
  style?: StyleProp<ViewStyle>;
};

export function ParkMap({
  sites,
  rankById,
  matchIds,
  selectedId,
  focusRegion,
  featureIcons = false,
  iconsAtAnyZoom = false,
  onExpand,
  controlInset,
  onSelectSite,
  style,
}: ParkMapProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  function onLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    // Avoid re-projecting on sub-pixel layout jitter.
    if (Math.abs(width - size.width) > 1 || Math.abs(height - size.height) > 1) {
      setSize({ width, height });
    }
  }

  const projected = useMemo(() => {
    if (size.width < 1 || size.height < 1) return null;

    // A little padding so coastal outlines are not flush to the edge.
    const projection = geoAlbersUsa().fitExtent(
      [
        [8, 8],
        [size.width - 8, size.height - 8],
      ],
      FIT_COLLECTION,
    );
    const toPath = geoPath(projection);

    const statePaths = US_STATES.flatMap((feature) => {
      const d = toPath(feature);
      return d ? [{ id: feature.id, d }] : [];
    });

    const dots = sites.flatMap<PlacedDot>((site) => {
      // Lon/lat order, which is what GeoJSON and d3 expect.
      const point = projection([site.lon, site.lat]);
      if (!point) return []; // Outside the Albers USA domain.
      return [{ site, x: point[0], y: point[1] }];
    });

    return { toPath, statePaths, dots };
  }, [size.width, size.height, sites]);

  /** Where the map should end up: the whole country, or framed on a region. */
  const target = useMemo<View2D>(() => {
    const region = REGIONS.find((r) => r.id === focusRegion);
    if (!projected || !region) return IDENTITY;

    const [[x0, y0], [x1, y1]] = projected.toPath.bounds({
      type: 'FeatureCollection',
      features: US_STATES.filter((feature) => region.states.includes(feature.id)),
    });
    const k = Math.min(
      (size.width - ZOOM_PADDING * 2) / Math.max(x1 - x0, 1),
      (size.height - ZOOM_PADDING * 2) / Math.max(y1 - y0, 1),
      MAX_ZOOM,
    );
    return {
      k,
      tx: size.width / 2 - k * ((x0 + x1) / 2),
      ty: size.height / 2 - k * ((y0 + y1) / 2),
    };
  }, [projected, focusRegion, size.width, size.height]);

  const { view, moved, beginGesture, pinchTo, panBy, reset } = useMapView(target, size);

  // Callbacks run on the JS thread (runOnJS) because the view is React
  // state; the map is light enough for that to keep up.
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart((event) => beginGesture(event.focalX, event.focalY))
    .onUpdate((event) => pinchTo(event.scale, event.focalX, event.focalY));

  const pan = Gesture.Pan()
    .runOnJS(true)
    .maxPointers(1)
    // At full-country size a drag belongs to the page, so it can scroll.
    .enabled(view.k > 1.05)
    .onStart(() => beginGesture(0, 0))
    .onUpdate((event) => panBy(event.translationX, event.translationY));

  const gesture = Gesture.Simultaneous(pinch, pan);

  // Built once per layout, so each frame of a zoom only moves the group.
  // While a region is in focus the others are left out entirely.
  const stateShapes = useMemo(
    () =>
      projected?.statePaths.flatMap((state) => {
        const region = STATE_REGION[state.id];
        if (focusRegion != null && region?.id !== focusRegion) return [];
        return [
          <Path
            key={state.id}
            d={state.d}
            fill={region?.fill ?? colors.neutral[300]}
            stroke={colors.bg}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />,
        ];
      }) ?? [],
    [projected, focusRegion],
  );

  if (!projected) {
    return <View style={[styles.container, style]} onLayout={onLayout} />;
  }

  const place = ({ x, y }: PlacedDot) => ({
    x: x * view.k + view.tx,
    y: y * view.k + view.ty,
  });
  const hasPicks = (rankById?.size ?? 0) > 0;
  // While a region is in focus, only its pins (and the selected one) show.
  const visible = focusRegion
    ? projected.dots.filter(
        (dot) => dot.site.id === selectedId || regionForState(dot.site.state)?.id === focusRegion,
      )
    : projected.dots;
  const picks = visible.filter((dot) => rankById?.has(dot.site.id));
  const unranked = visible.filter((dot) => !rankById?.has(dot.site.id));
  const matched = unranked.filter((dot) => matchIds?.has(dot.site.id));
  const others = unranked.filter((dot) => !matchIds?.has(dot.site.id));
  const filtering = (matchIds?.size ?? 0) > 0;
  // A region in focus always gets badges: Alaska & Hawaii spans so much of
  // the map that framing it barely zooms in at all.
  const showIcons =
    featureIcons && (iconsAtAnyZoom || focusRegion != null || view.k >= ICON_ZOOM);
  /** The park's feature, when badges are showing and it has one. */
  const badgeFor = (site: Site) => (showIcons ? featureForPark(site.id) : undefined);
  /** Where each badge is drawn, nudged apart where parks sit close together. */
  const badgeSpots = showIcons
    ? spreadBadges(
        visible.flatMap((dot) =>
          featureForPark(dot.site.id) ? [{ id: dot.site.id, ...place(dot) }] : [],
        ),
        selectedId,
        size,
      )
    : new Map<string, Point>();
  // Draw #1 last so it sits on top where pins overlap.
  picks.sort((a, b) => rankById!.get(b.site.id)! - rankById!.get(a.site.id)!);
  // The selected park goes on top of its own group, glow and all.
  const selectedLast = (a: PlacedDot, b: PlacedDot) =>
    Number(a.site.id === selectedId) - Number(b.site.id === selectedId);
  others.sort(selectedLast);
  matched.sort(selectedLast);
  picks.sort(selectedLast);

  return (
    <View style={[styles.container, style]} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <Svg width={size.width} height={size.height}>
          <G transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>{stateShapes}</G>

          {/* Unmatched parks recede further while a filter is on. */}
          {/* Badges stay at full strength: the picks' numbers already stand out. */}
          <G opacity={filtering ? 0.35 : hasPicks && !showIcons ? 0.6 : 1}>
            {others.map((dot) => {
              const { site } = dot;
              const { x, y } = place(dot);
              const selected = site.id === selectedId;
              const look = STATUS_DOT[site.status];
              const feature = badgeFor(site);
              if (feature) {
                const ring = site.status === 'new' ? look.stroke : STATUS_RING[site.status];
                return (
                  <G key={site.id} onPress={onSelectSite ? () => onSelectSite(site) : undefined}>
                    <FeatureBadge
                      site={site}
                      x={x}
                      y={y}
                      at={badgeSpots.get(site.id)}
                      feature={feature}
                      ring={ring}
                      selected={selected}
                    />
                  </G>
                );
              }
              return (
                <G key={site.id} onPress={onSelectSite ? () => onSelectSite(site) : undefined}>
                  <Circle cx={x} cy={y} r={HIT_RADIUS} fill="transparent" />
                  <Circle
                    cx={x}
                    cy={y}
                    r={selected ? 7 : 4}
                    fill={look.fill}
                    stroke={selected ? colors.text : look.stroke}
                    strokeWidth={selected ? 2.5 : 1.5}
                  />
                </G>
              );
            })}
          </G>

          <G>
            {matched.map((dot) => {
              const { site } = dot;
              const { x, y } = place(dot);
              const selected = site.id === selectedId;
              const feature = badgeFor(site);
              if (feature) {
                return (
                  <G key={site.id} onPress={onSelectSite ? () => onSelectSite(site) : undefined}>
                    <FeatureBadge
                      site={site}
                      x={x}
                      y={y}
                      at={badgeSpots.get(site.id)}
                      feature={feature}
                      ring={MATCH_DOT.fill}
                      selected={selected}
                    />
                  </G>
                );
              }
              return (
                <G key={site.id} onPress={onSelectSite ? () => onSelectSite(site) : undefined}>
                  <Circle cx={x} cy={y} r={HIT_RADIUS} fill="transparent" />
                  <Circle
                    cx={x}
                    cy={y}
                    r={selected ? 8 : 6}
                    fill={MATCH_DOT.fill}
                    stroke={selected ? colors.text : MATCH_DOT.stroke}
                    strokeWidth={selected ? 2.5 : 1.75}
                  />
                </G>
              );
            })}
          </G>

          <G>
            {picks.map((dot) => {
              const { site } = dot;
              const { x, y } = place(dot);
              const selected = site.id === selectedId;
              const rank = rankById!.get(site.id)!;
              const feature = badgeFor(site);
              if (feature) {
                const r = selected ? BADGE_R + 2 : BADGE_R;
                const spot = badgeSpots.get(site.id) ?? { x, y };
                // The number rides on the badge's upper-right edge.
                const nx = spot.x + r * 0.75;
                const ny = spot.y - r * 0.75;
                return (
                  <G key={site.id} onPress={onSelectSite ? () => onSelectSite(site) : undefined}>
                    <FeatureBadge
                      site={site}
                      x={x}
                      y={y}
                      at={badgeSpots.get(site.id)}
                      feature={feature}
                      ring={PICK_FILL}
                      selected={selected}
                    />
                    <Circle
                      cx={nx}
                      cy={ny}
                      r={7.5}
                      fill={PICK_FILL}
                      stroke={colors.neutral[100]}
                      strokeWidth={1.5}
                    />
                    <SvgText
                      x={nx}
                      y={ny + 3.2}
                      textAnchor="middle"
                      fontSize={9.5}
                      fontFamily={fonts.bodyBold}
                      fontWeight="bold"
                      fill={colors.neutral[100]}
                    >
                      {String(rank)}
                    </SvgText>
                  </G>
                );
              }
              return (
                <G key={site.id} onPress={onSelectSite ? () => onSelectSite(site) : undefined}>
                  <Circle
                    cx={x}
                    cy={y}
                    r={selected ? 12 : 10}
                    fill={selected ? colors.accentRamp[700] : PICK_FILL}
                    stroke={colors.neutral[100]}
                    strokeWidth={2}
                  />
                  <SvgText
                    x={x}
                    // SVG text sits on its baseline; nudge down to centre it.
                    y={y + 3.8}
                    textAnchor="middle"
                    fontSize={11}
                    fontFamily={fonts.bodyBold}
                    fontWeight="bold"
                    fill={colors.neutral[100]}
                  >
                    {String(rank)}
                  </SvgText>
                </G>
              );
            })}
          </G>
        </Svg>
      </GestureDetector>

      {onExpand ? (
        <Pressable
          onPress={onExpand}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Open the map full screen"
          style={({ pressed }) => [
            styles.expand,
            controlInset && {
              bottom: 8 + (controlInset.bottom ?? 0),
              right: 12 + (controlInset.right ?? 0),
            },
            pressed && styles.resetPressed,
          ]}
        >
          <ExpandIcon size={16} color={colors.accentRamp[700]} />
        </Pressable>
      ) : null}

      {moved ? (
        <Pressable
          onPress={reset}
          accessibilityRole="button"
          accessibilityLabel="Reset the map zoom"
          hitSlop={8}
          style={({ pressed }) => [
            styles.reset,
            controlInset && {
              top: 8 + (controlInset.top ?? 0),
              right: 12 + (controlInset.right ?? 0),
            },
            pressed && styles.resetPressed,
          ]}
        >
          <BodyText size={12} weight="semibold" color={colors.accentRamp[700]}>
            Reset
          </BodyText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** The badge ring for parks you've been to or saved; a plain white edge otherwise. */
const STATUS_RING: Record<Exclude<SiteStatus, 'new'>, string> = {
  visited: colors.accentRamp[700],
  wishlist: colors.accent2Ramp[700],
};

type Point = { x: number; y: number };

/**
 * Pushes overlapping badges apart so each one can be read and tapped.
 * Utah's five parks overlap even at region zoom without this, and more
 * so when large text shrinks the map. Thirty rounds of pairwise nudging
 * settle the dozen or so badges a region shows, cheaply enough to rerun
 * on every frame of a zoom.
 */
function spreadBadges(
  points: (Point & { id: string })[],
  selectedId?: string | null,
  bounds?: { width: number; height: number },
): Map<string, Point> {
  const spots = points.map(({ x, y }) => ({ x, y }));
  const baseGap = BADGE_R * 2 + 2;
  for (let round = 0; round < 30; round++) {
    let moved = false;
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        const a = spots[i];
        const b = spots[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        // The selected badge's glow needs room too, so neighbours don't cover it.
        const gap =
          baseGap + (points[i].id === selectedId || points[j].id === selectedId ? HALO : 0);
        if (d >= gap) continue;
        if (d < 0.01) {
          // Same spot: split them along a fixed angle so it's stable.
          dx = Math.cos(j);
          dy = Math.sin(j);
          d = 1;
        }
        const push = (gap - d) / 2;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
        moved = true;
      }
    }
    // Keep every badge on screen: pushing apart a crowded area can
    // otherwise shove one past the map's edge.
    if (bounds) {
      const pad = BADGE_R + 3;
      for (const spot of spots) {
        spot.x = Math.min(Math.max(spot.x, pad), bounds.width - pad);
        spot.y = Math.min(Math.max(spot.y, pad), bounds.height - pad);
      }
    }
    if (!moved) break;
  }
  return new Map(points.map(({ id }, i) => [id, spots[i]]));
}

/**
 * A park's feature glyph on its terrain colour, ringed to show its status.
 * When the badge has been nudged off its park (`at`), a thin line and a
 * dot mark where the park really is.
 */
function FeatureBadge({
  site,
  x,
  y,
  at,
  feature,
  ring,
  selected,
}: {
  site: Site;
  x: number;
  y: number;
  at?: Point;
  feature: Feature;
  ring: string;
  selected: boolean;
}) {
  const tone = terrainTone(site.group);
  const r = selected ? BADGE_R + 2 : BADGE_R;
  const bx = at?.x ?? x;
  const by = at?.y ?? y;
  const nudged = Math.hypot(bx - x, by - y) > 3;
  return (
    <>
      {nudged ? (
        <>
          <Path d={`M${x} ${y}L${bx} ${by}`} stroke={tone.ink} strokeWidth={1.25} opacity={0.6} />
          <Circle cx={x} cy={y} r={2.25} fill={tone.ink} />
        </>
      ) : null}
      {selected ? (
        // A soft glow and a thin accent ring outside the black one, so the
        // selected park stands out from its neighbours.
        <>
          <Circle cx={bx} cy={by} r={r + HALO} fill={colors.accent} opacity={0.2} />
          <Circle cx={bx} cy={by} r={r + 4.5} fill="none" stroke={colors.accent} strokeWidth={2} />
        </>
      ) : null}
      <Circle
        cx={bx}
        cy={by}
        r={r}
        fill={tone.band}
        stroke={selected ? colors.text : ring}
        strokeWidth={selected ? 3 : 2.5}
      />
      <FeatureGlyph feature={feature} cx={bx} cy={by} size={GLYPH_SIZE} color={tone.ink} />
    </>
  );
}

/**
 * The map's current view. Eases to `target` whenever it changes; pinch and
 * pan move it directly, and `reset` eases back to `target`.
 */
function useMapView(target: View2D, size: { width: number; height: number }) {
  const [view, setViewState] = useState(target);
  /** The target the user last pinched or dragged away from, if any. */
  const [movedFrom, setMovedFrom] = useState<View2D | null>(null);
  const current = useRef(target);
  const frame = useRef(0);
  const gestureStart = useRef({ view: IDENTITY, focalX: 0, focalY: 0 });

  const setView = useCallback((next: View2D) => {
    cancelAnimationFrame(frame.current);
    current.current = next;
    setViewState(next);
  }, []);

  /** Keeps the map from being dragged or pinched entirely out of the box. */
  const clamp = useCallback(
    (next: View2D): View2D => {
      const k = Math.min(Math.max(next.k, PINCH_MIN), PINCH_MAX);
      const { width: w, height: h } = size;
      return {
        k,
        tx: Math.min(Math.max(next.tx, w / 2 - w * k), w / 2),
        ty: Math.min(Math.max(next.ty, h / 2 - h * k), h / 2),
      };
    },
    [size],
  );

  const animateTo = useCallback((to: View2D) => {
    cancelAnimationFrame(frame.current);
    const from = current.current;
    const start = Date.now();

    const step = () => {
      const t = Math.min((Date.now() - start) / ZOOM_MS, 1);
      const ease = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; // ease-in-out cubic
      const next = {
        k: from.k + (to.k - from.k) * ease,
        tx: from.tx + (to.tx - from.tx) * ease,
        ty: from.ty + (to.ty - from.ty) * ease,
      };
      current.current = next;
      setViewState(next);
      if (t < 1) frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    animateTo(target);
  }, [target, animateTo]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const beginGesture = useCallback(
    (focalX: number, focalY: number) => {
      gestureStart.current = { view: current.current, focalX, focalY };
      setMovedFrom(target);
    },
    [target],
  );

  const pinchTo = useCallback(
    (scale: number, focalX: number, focalY: number) => {
      const start = gestureStart.current;
      const k = Math.min(Math.max(start.view.k * scale, PINCH_MIN), PINCH_MAX);
      const ratio = k / start.view.k;
      // Keep the point under the fingers fixed, and follow the fingers as they move.
      setView(
        clamp({
          k,
          tx: focalX - (start.focalX - start.view.tx) * ratio,
          ty: focalY - (start.focalY - start.view.ty) * ratio,
        }),
      );
    },
    [clamp, setView],
  );

  const panBy = useCallback(
    (dx: number, dy: number) => {
      const start = gestureStart.current.view;
      setView(clamp({ k: start.k, tx: start.tx + dx, ty: start.ty + dy }));
    },
    [clamp, setView],
  );

  const reset = useCallback(() => {
    setMovedFrom(null);
    animateTo(target);
  }, [animateTo, target]);

  // A new target (another park, or none) clears the Reset button by itself.
  const moved = movedFrom === target;

  return { view, moved, beginGesture, pinchTo, panBy, reset };
}

type PlacedDot = { site: Site; x: number; y: number };

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  reset: {
    position: 'absolute',
    top: 8,
    right: 12,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[100],
    ...shadow.sm,
  },
  expand: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.neutral[100],
    ...shadow.sm,
  },
  resetPressed: {
    opacity: 0.8,
  },
});
