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
 * Regions in `completedRegions` (every site visited) are filled in a
 * richer shade inside a gold edge, with a stamp in the middle, and their
 * pins are tucked away until the region is focused or `revealedRegion`
 * (unless `tuckCompleted` is off, for a map of the places you've been).
 *
 * Passing `focusRegion` zooms the map onto that region and hides every
 * other region and its pins; with `onSelectRegion`, tapping a region's land
 * asks for that. Pinching zooms around the fingers, and once
 * zoomed in a one-finger drag pans; at full-country size a drag is left to
 * the page so it still scrolls. The zoom is a transform on the state
 * outlines; pins are placed in screen space instead, so they keep their
 * size and spread apart as the map grows.
 *
 * The view (zoom and position) lives on the UI thread, in shared values:
 * pinching, dragging and easing onto a region move the outlines and every
 * pin there, frame by frame, without React redrawing the map. React only
 * hears about a move when it starts and ends, and re-places the feature
 * badges then. The outlines are projected once per width; the box's height
 * (which changes as the key and the card sheet open and close) is part of
 * the view, so it costs a move, not a new projection.
 *
 * A consequence of Albers USA worth knowing: it has no projection for
 * territories, so American Samoa and the Virgin Islands return null and
 * are absent from the map. The prototype notes the same limitation.
 */

import {
  geoAlbersUsa,
  geoContains,
  geoPath,
  type GeoPath,
  type GeoProjection,
} from 'd3-geo';
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path, Text as SvgText, type GProps } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import type { Site, SiteStatus } from '../data/parks';
import { REGIONS, regionForState, STATE_REGION, type RegionId } from '../data/regions';
import { US_STATES, type StateFeature } from '../data/usStates';
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

/** Small dots are hard to hit with a finger, so taps reach this far from one. */
const HIT_RADIUS = 11;

/** How far in the map must be zoomed before feature badges replace dots. */
const ICON_ZOOM = 1.6;
/** A feature badge's radius, and its glyph's width. */
const BADGE_R = 12;
const GLYPH_SIZE = 15;
/** The edge round a completed region, and how much of it shows outside. */
const EARNED_EDGE = '#c8961e';
const EARNED_EDGE_WIDTH = 5;
/** The completed-region stamp's radius. */
const STAMP_R = 17;
/** How far the selected badge's glow reaches past its ring. */
const HALO = 9;
/**
 * Past this share of on-screen badges overlapping a neighbour, a pinched
 * map goes back to dots: pinching out, the badges bunch up long before
 * the zoom drops under ICON_ZOOM.
 */
const CROWD_SHARE = 0.3;

/** Room left round the whole country, so coastlines aren't flush to the edge. */
const FIT_PADDING = 8;
/** Room left around a zoomed region, and the most it may be magnified. */
const ZOOM_PADDING = 22;
const ZOOM_PADDING_X = 40;
const MAX_ZOOM = 4;
const ZOOM_EASE = { duration: 380, easing: Easing.inOut(Easing.cubic) };

/** Limits on pinching, against the whole country: never smaller, up to 8x. */
const PINCH_MIN = 1;
const PINCH_MAX = 8;

/** Scale then translate, applied to projected map coordinates. */
type View2D = { k: number; tx: number; ty: number };
const IDENTITY: View2D = { k: 1, tx: 0, ty: 0 };
/** The view as the UI thread holds it. */
type LiveView = { k: SharedValue<number>; tx: SharedValue<number>; ty: SharedValue<number> };

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
  /** Regions to mark as completed: every national park in them visited. */
  completedRegions?: ReadonlySet<RegionId>;
  /** A completed region whose pins show anyway, without zooming onto it. */
  revealedRegion?: RegionId | null;
  /**
   * Tuck a completed region's pins away behind its stamp. On by default;
   * off for the map of your visits, where those pins are the point.
   */
  tuckCompleted?: boolean;
  /** Tapping a region's land (not a pin), while no region is in focus. */
  onSelectRegion?: (region: RegionId) => void;
  style?: StyleProp<ViewStyle>;
  /**
   * Draw the map on a taller canvas than its box: `top` px above it and
   * `height` tall in all, so that zoomed in it slides behind what's laid
   * over it (Explore's key and card sheet) rather than stopping at a hard
   * edge. The whole map still fits the box at rest, and only the box takes
   * touches. Keep `height` steady as the box moves: on Android a new canvas
   * size rebuilds every outline, a stall of a tenth of a second.
   */
  canvas?: { top: number; height: number };
  /** The box's y and height within its parent, when they change. */
  onFrame?: (y: number, height: number) => void;
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
  onSelectRegion,
  completedRegions,
  revealedRegion,
  tuckCompleted = true,
  style,
  canvas,
  onFrame,
}: ParkMapProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Zooming back out of a region, only that region is drawn until the zoom
  // ends, and the rest of the country comes in then: on Android each frame
  // of the whole country is slow to draw, and the region alone is quick.
  const [lastFocus, setLastFocus] = useState(focusRegion ?? null);
  const [leaving, setLeaving] = useState<RegionId | null>(null);
  if ((focusRegion ?? null) !== lastFocus) {
    setLastFocus(focusRegion ?? null);
    setLeaving(focusRegion == null ? lastFocus : null);
  }
  /** The region drawn alone, if any: the one in focus, or being left. */
  const shownRegion = focusRegion ?? leaving;

  function onLayout(event: LayoutChangeEvent) {
    const { width, height, y } = event.nativeEvent.layout;
    onFrame?.(y, height);
    // Avoid re-projecting on sub-pixel layout jitter.
    if (Math.abs(width - size.width) > 1 || Math.abs(height - size.height) > 1) {
      setSize({ width, height });
    }
  }

  // Projected for the box's width alone: the box's height is fitted by the
  // view (`base`), so the key or the card sheet changing it doesn't re-run
  // the projection and redraw every outline.
  const projected = useMemo(() => {
    if (size.width < 1) return null;

    const projection = geoAlbersUsa().fitWidth(size.width - FIT_PADDING * 2, FIT_COLLECTION);
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

    return { projection, toPath, statePaths, dots, bounds: toPath.bounds(FIT_COLLECTION) };
  }, [size.width, sites]);

  /** The whole country, fitted to the box. Pinch limits are against this. */
  const base = useMemo<View2D>(() => {
    if (!projected || size.height < 1) return IDENTITY;
    return frameBounds(projected.bounds, size, FIT_PADDING, FIT_PADDING, Infinity);
  }, [projected, size]);

  /** Where the map should end up: the whole country, or framed on a region. */
  const target = useMemo<View2D>(() => {
    const region = REGIONS.find((r) => r.id === focusRegion);
    if (!projected || !region || size.height < 1) return base;

    const { toPath } = projected;
    const bounds = toPath.bounds({
      type: 'FeatureCollection',
      features: US_STATES.filter((feature) => region.states.includes(feature.id)).map(
        (feature) => mainLand(feature, toPath),
      ),
    });
    // Wider at the sides: an edge park's badge (and the expand button in
    // the corner) needs the room.
    return frameBounds(bounds, size, ZOOM_PADDING_X, ZOOM_PADDING, base.k * MAX_ZOOM);
  }, [projected, focusRegion, size, base]);

  // The live view, on the UI thread.
  const k = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const live: LiveView = { k, tx, ty };

  /** The target the user last pinched or dragged away from, if any. */
  const [movedFrom, setMovedFrom] = useState<View2D | null>(null);
  /** Where the last pinch or drag left the map. */
  const [gestureView, setGestureView] = useState<View2D>(IDENTITY);
  // A new target (another park, or none) clears the Reset button by itself.
  const moved = movedFrom === target;
  /**
   * The view React draws the badges for: where the map rests, or is easing
   * to. While a finger moves it, the badges ride along where they were.
   */
  const settled = moved ? gestureView : target;
  // How far above the box the drawing starts, and how tall it is.
  const lift = canvas && canvas.height > 0 ? canvas.top : 0;
  const drawHeight = canvas && canvas.height > 0 ? Math.round(canvas.height) : size.height;

  // Ease onto a newly focused region, or back out of one. A new target for
  // the same focus means the box changed size (the key or the card sheet
  // opened or closed), and the map goes straight to its new fit: on
  // Android each frame of the whole country costs tens of milliseconds to
  // draw, so one jump looks better than an ease that stutters. (If an ease
  // is still under way, as when a tap focuses a region and opens the sheet
  // together, it's re-aimed for the time it has left.) The first target,
  // once the box is measured, is where the map starts.
  const placedFocus = useRef<RegionId | null | undefined>(undefined);
  const easingUntil = useRef(0);
  useEffect(() => {
    if (!projected || size.height < 1) return;
    const focus = focusRegion ?? null;
    const now = Date.now();
    let duration = 0;
    if (placedFocus.current !== undefined && placedFocus.current !== focus) {
      duration = ZOOM_EASE.duration;
      easingUntil.current = now + duration;
    } else if (now < easingUntil.current) {
      duration = easingUntil.current - now;
    }
    placedFocus.current = focus;
    if (duration === 0) {
      k.set(target.k);
      tx.set(target.tx);
      ty.set(target.ty);
      return;
    }
    const ease = { ...ZOOM_EASE, duration };
    k.set(
      withTiming(target.k, ease, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(setLeaving, null);
      }),
    );
    tx.set(withTiming(target.tx, ease));
    ty.set(withTiming(target.ty, ease));
  }, [target, focusRegion, projected, size.height, k, tx, ty]);

  function reset() {
    setMovedFrom(null);
    k.set(withTiming(target.k, ZOOM_EASE));
    tx.set(withTiming(target.tx, ZOOM_EASE));
    ty.set(withTiming(target.ty, ZOOM_EASE));
  }
  function beginMove(atK: number, atX: number, atY: number) {
    setLeaving(null);
    setMovedFrom(target);
    setGestureView({ k: atK, tx: atX, ty: atY });
  }
  function endMove(atK: number, atX: number, atY: number) {
    setGestureView({ k: atK, tx: atX, ty: atY });
  }

  // What a pinch or drag may do, as plain numbers for the UI thread: zoom
  // between the whole country and PINCH_MAX, and keep the middle of the
  // box on the map (where the whole country's box is, at that zoom).
  const minK = base.k * PINCH_MIN;
  const maxK = base.k * PINCH_MAX;
  const halfW = size.width / 2;
  const halfH = size.height / 2;
  const left = -base.tx / base.k;
  const right = (size.width - base.tx) / base.k;
  const top = -base.ty / base.k;
  const bottom = (size.height - base.ty) / base.k;
  const gestureStart = useSharedValue({ k: 1, tx: 0, ty: 0, focalX: 0, focalY: 0 });

  // Gesture callbacks run on the UI thread and move the shared values, so
  // the map follows the fingers without waiting on React.
  const pinch = Gesture.Pinch()
    .onStart((event) => {
      gestureStart.set({
        k: k.get(),
        tx: tx.get(),
        ty: ty.get(),
        focalX: event.focalX,
        focalY: event.focalY,
      });
      scheduleOnRN(beginMove, k.get(), tx.get(), ty.get());
    })
    .onUpdate((event) => {
      const start = gestureStart.get();
      const nextK = Math.min(Math.max(start.k * event.scale, minK), maxK);
      const ratio = nextK / start.k;
      // Keep the point under the fingers fixed, and follow the fingers as they move.
      k.set(nextK);
      tx.set(
        Math.min(
          Math.max(event.focalX - (start.focalX - start.tx) * ratio, halfW - nextK * right),
          halfW - nextK * left,
        ),
      );
      ty.set(
        Math.min(
          Math.max(event.focalY - (start.focalY - start.ty) * ratio, halfH - nextK * bottom),
          halfH - nextK * top,
        ),
      );
    })
    .onEnd(() => {
      scheduleOnRN(endMove, k.get(), tx.get(), ty.get());
    });

  const pan = Gesture.Pan()
    .maxPointers(1)
    // At full-country size a drag belongs to the page, so it can scroll.
    .enabled(settled.k > base.k * 1.05)
    .onStart(() => {
      gestureStart.set({ k: k.get(), tx: tx.get(), ty: ty.get(), focalX: 0, focalY: 0 });
      scheduleOnRN(beginMove, k.get(), tx.get(), ty.get());
    })
    .onUpdate((event) => {
      const start = gestureStart.get();
      tx.set(
        Math.min(Math.max(start.tx + event.translationX, halfW - start.k * right), halfW - start.k * left),
      );
      ty.set(
        Math.min(Math.max(start.ty + event.translationY, halfH - start.k * bottom), halfH - start.k * top),
      );
    })
    .onEnd(() => {
      scheduleOnRN(endMove, k.get(), tx.get(), ty.get());
    });

  const regionsTappable = onSelectRegion != null && focusRegion == null;

  // Built once per layout and drawn at the live view's zoom, so moving the
  // map never rebuilds them. While a region is in focus the others are
  // hidden, not removed: on Android an outline drawn for the first time
  // (or again, after being removed) has its shape rebuilt, a stall when
  // most of the country comes back at once.
  //
  // Completed regions go in three layers: their gold-edged region groups
  // go after the others, and in each, a wide gold stroke round each state
  // with the states' fills on top. The fills cover the gold everywhere but
  // the region's outer edge (where states inside it meet, both sides are
  // filled), so the gold rings the region as a whole, not each state in it.
  const stateShapes = useMemo(() => {
    if (!projected) return [];
    const states = projected.statePaths.map((state) => {
      const region = STATE_REGION[state.id];
      return { ...state, region, earned: region != null && completedRegions?.has(region.id) };
    });
    const land = (state: (typeof states)[number]) => (
      <Path
        key={state.id}
        d={state.d}
        fill={state.earned ? state.region.earned : (state.region?.fill ?? colors.neutral[300])}
        stroke={colors.bg}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    );
    const edge = (state: (typeof states)[number]) => (
      <Path
        key={`edge-${state.id}`}
        d={state.d}
        fill="none"
        stroke={EARNED_EDGE}
        strokeWidth={EARNED_EDGE_WIDTH}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    );
    const groups = [...REGIONS.map((region) => region.id), null].map((id) => {
      const inGroup = states.filter((state) => (state.region?.id ?? null) === id);
      const earned = inGroup.some((state) => state.earned);
      return { id, earned, inGroup };
    });
    // Completed regions last, so their gold edge sits over their neighbours.
    groups.sort((a, b) => Number(a.earned) - Number(b.earned));
    return groups.map(({ id, earned, inGroup }) => (
      <G
        key={id ?? 'none'}
        display={shownRegion != null && id !== shownRegion ? 'none' : undefined}
      >
        {earned ? [...inGroup.map(edge), ...inGroup.map(land)] : inGroup.map(land)}
      </G>
    ));
  }, [projected, shownRegion, completedRegions]);

  /** Where each completed region's stamp goes, in map coordinates. */
  const stampSpots = useMemo(() => {
    if (!projected || !completedRegions?.size) return [];
    return REGIONS.filter((region) => completedRegions.has(region.id)).map((region) => ({
      region: region.id,
      ...regionCentre(region.states, projected),
    }));
  }, [projected, completedRegions]);

  if (!projected || size.height < 1) {
    return <View style={[styles.container, style]} onLayout={onLayout} />;
  }

  /** Where a point in map coordinates lands in the box, at a view. */
  const place = ({ x, y }: Point, view: View2D = settled) => ({
    x: x * view.k + view.tx,
    y: y * view.k + view.ty,
  });
  const hasPicks = (rankById?.size ?? 0) > 0;
  /** A completed region's pins stay tucked away unless it's opened up. */
  const tucked = (dot: PlacedDot) => {
    if (!tuckCompleted) return false;
    const region = regionForState(dot.site.state)?.id;
    return (
      region != null &&
      completedRegions?.has(region) === true &&
      region !== shownRegion &&
      region !== revealedRegion &&
      dot.site.id !== selectedId
    );
  };
  // While a region is in focus, only its pins (and the selected one) show.
  const visible = (
    shownRegion
      ? projected.dots.filter(
          (dot) =>
            dot.site.id === selectedId || regionForState(dot.site.state)?.id === shownRegion,
        )
      : projected.dots
  ).filter((dot) => !tucked(dot));
  const picks = visible.filter((dot) => rankById?.has(dot.site.id));
  const unranked = visible.filter((dot) => !rankById?.has(dot.site.id));
  const matched = unranked.filter((dot) => matchIds?.has(dot.site.id));
  const others = unranked.filter((dot) => !matchIds?.has(dot.site.id));
  const filtering = (matchIds?.size ?? 0) > 0;
  // A region in focus always gets badges: Alaska & Hawaii spans so much of
  // the map that framing it barely zooms in at all.
  // On the whole map, badges follow a pinch only (`moved`): while it eases
  // back out of a region it passes through the same zoom, and every park in
  // the country would flash up as a badge on the way.
  // Only parks on screen get badges. Off-screen ones would be pulled in to
  // the edges when the badges are kept inside the map, and pile up there.
  const onScreen = visible.flatMap((dot) => {
    const at = place(dot);
    const inView =
      at.x >= -BADGE_R && at.x <= size.width + BADGE_R &&
      at.y >= -BADGE_R && at.y <= size.height + BADGE_R;
    return inView && featureForPark(dot.site.id) ? [{ id: dot.site.id, ...at }] : [];
  });
  const pinchedIn = moved && settled.k >= base.k * ICON_ZOOM && !crowded(onScreen);
  const showIcons = featureIcons && (iconsAtAnyZoom || focusRegion != null || pinchedIn);
  /** How far the parks that aren't picks or matches fade back. */
  const othersFade = filtering ? 0.35 : hasPicks && !showIcons ? 0.6 : 1;
  const badged = new Set(showIcons ? onScreen.map((spot) => spot.id) : []);
  /** The park's feature, when it's on screen with badges showing and has one. */
  const badgeFor = (site: Site) => (badged.has(site.id) ? featureForPark(site.id) : undefined);
  /** Where each badge is drawn, nudged apart where parks sit close together. */
  const badgeSpots = showIcons
    ? spreadBadges(onScreen, selectedId, size)
    : new Map<string, Point>();
  /** How far a park's badge was nudged off it, which holds while the map moves. */
  const nudgeFor = (dot: PlacedDot): Point | undefined => {
    const spot = badgeSpots.get(dot.site.id);
    if (!spot) return undefined;
    const at = place(dot);
    return { x: spot.x - at.x, y: spot.y - at.y };
  };
  /** What a pin draws, as plain values: a pin whose values are unchanged isn't re-rendered. */
  const pinProps = (dot: PlacedDot, kind: PinKind) => {
    const nudge = nudgeFor(dot);
    return {
      site: dot.site,
      x: dot.x,
      y: dot.y,
      k,
      tx,
      ty,
      lift,
      kind,
      selected: dot.site.id === selectedId,
      rank: kind === 'pick' ? rankById?.get(dot.site.id) : undefined,
      feature: badgeFor(dot.site),
      nudgeX: nudge?.x,
      nudgeY: nudge?.y,
      fade: kind === 'other' ? othersFade : 1,
    };
  };
  // Draw #1 last so it sits on top where pins overlap.
  picks.sort((a, b) => rankById!.get(b.site.id)! - rankById!.get(a.site.id)!);
  // The selected park goes on top of its own group, glow and all.
  const selectedLast = (a: PlacedDot, b: PlacedDot) =>
    Number(a.site.id === selectedId) - Number(b.site.id === selectedId);
  others.sort(selectedLast);
  matched.sort(selectedLast);
  picks.sort(selectedLast);

  // Taps are worked out here rather than by the SVG shapes themselves: on
  // Android, react-native-svg kept the states' touch areas where they were
  // drawn while zoomed, so after zooming in and back out a tap landed on
  // whichever state used to be under the finger. Working from the current
  // view is exact at any zoom.
  const showStamps = shownRegion == null && tuckCompleted;
  /** The pin under a tap, nearest first; badges and numbered pins are bigger targets. */
  function siteAt(x: number, y: number, view: View2D): Site | undefined {
    let hit: Site | undefined;
    let nearest = Infinity;
    for (const dot of visible) {
      const at = place(dot, view);
      const nudge = nudgeFor(dot);
      const spot = nudge ? { x: at.x + nudge.x, y: at.y + nudge.y } : at;
      const reach = nudge
        ? BADGE_R + 4
        : rankById?.has(dot.site.id)
          ? 13
          : HIT_RADIUS;
      const distance = Math.hypot(spot.x - x, spot.y - y);
      if (distance <= reach && distance < nearest) {
        hit = dot.site;
        nearest = distance;
      }
    }
    return hit;
  }
  /** The region under a tap: a completed region's stamp, or the state it lands in. */
  function regionAt(x: number, y: number, view: View2D): RegionId | undefined {
    if (showStamps) {
      for (const spot of stampSpots) {
        if (spot.region === revealedRegion) continue;
        const at = place(spot, view);
        if (Math.hypot(at.x - x, at.y - y) <= STAMP_R) return spot.region;
      }
    }
    if (!regionsTappable || !projected) return undefined;
    const lonLat = projected.projection.invert?.([(x - view.tx) / view.k, (y - view.ty) / view.k]);
    if (!lonLat) return undefined;
    const state = US_STATES.find((feature) => geoContains(feature, lonLat));
    return state ? STATE_REGION[state.id]?.id : undefined;
  }

  const tap = Gesture.Tap()
    .runOnJS(true)
    .maxDistance(10)
    .onEnd((event, success) => {
      if (!success) return;
      // Where the map is right now, which may be mid-ease.
      const view = { k: k.get(), tx: tx.get(), ty: ty.get() };
      const site = siteAt(event.x, event.y, view);
      if (site) {
        onSelectSite?.(site);
        return;
      }
      const region = regionAt(event.x, event.y, view);
      if (region && onSelectRegion) onSelectRegion(region);
    });
  const gesture = Gesture.Simultaneous(pinch, pan, tap);

  return (
    <View
      style={[styles.container, lift !== 0 && styles.bleeding, style]}
      onLayout={onLayout}
    >
      <GestureDetector gesture={gesture}>
        {/* Touches are taken by the box, not the Svg, which moves against
            it as the box moves on the canvas. */}
        <View style={StyleSheet.absoluteFill} collapsable={false}>
        <Svg
          width={size.width}
          height={drawHeight}
          // Out of the layout, so drawing past the box never changes its size
          // (which would feed back into the screen's layout).
          style={
            lift !== 0 ? { position: 'absolute', top: -lift, left: 0 } : undefined
          }
        >
          {/* Everything is drawn in the box's coordinates, moved down by the
              canvas above it (`lift`). */}
          <Zoomed view={live} lift={lift}>
            {stateShapes}
          </Zoomed>

          {/* Stamps on the completed regions, while their pins are tucked away. */}
          {showStamps
            ? stampSpots
                .filter((spot) => spot.region !== revealedRegion)
                .map((spot) => (
                  <Pinned key={spot.region} at={spot} view={live} lift={lift}>
                    <CompleteStamp />
                  </Pinned>
                ))
            : null}

          {/* Unmatched parks recede further while a filter is on. Badges
              stay at full strength: the picks' numbers already stand out.
              The fade is set on each shape, not on a group around them: on
              Android a translucent group is drawn through a whole extra
              canvas-sized bitmap, on every frame the map moves. */}
          <G>{others.map((dot) => <ParkPin key={dot.site.id} {...pinProps(dot, 'other')} />)}</G>
          <G>{matched.map((dot) => <ParkPin key={dot.site.id} {...pinProps(dot, 'match')} />)}</G>
          <G>{picks.map((dot) => <ParkPin key={dot.site.id} {...pinProps(dot, 'pick')} />)}</G>
        </Svg>
        </View>
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

const AnimatedG = Animated.createAnimatedComponent(
  // `matrix` is the native group's transform, which the animated props set
  // directly; G's own props only describe it as `transform`.
  G as unknown as ComponentType<GProps & { matrix?: number[] }>,
);

/**
 * The state outlines at the live view's zoom. The transform is set on the
 * UI thread each frame; React never re-renders it for a move.
 */
function Zoomed({ view, lift, children }: { view: LiveView; lift: number; children: ReactNode }) {
  const animatedProps = useAnimatedProps(() => {
    const scale = view.k.get();
    return { matrix: [scale, 0, 0, scale, view.tx.get(), view.ty.get() + lift] };
  });
  return <AnimatedG animatedProps={animatedProps}>{children}</AnimatedG>;
}

type PinKind = 'other' | 'match' | 'pick';

/**
 * One park's pin: a dot (styled by visit status, or the match colour), a
 * numbered pick, or a feature badge. Memoised on plain values, so opening
 * the card sheet or selecting a park re-renders only the pins that change;
 * re-rendering all of them (each with its UI-thread position) cost a
 * noticeable pause before the map moved.
 */
const ParkPin = memo(function ParkPin({
  site,
  x,
  y,
  k,
  tx,
  ty,
  lift,
  kind,
  selected,
  rank,
  feature,
  nudgeX,
  nudgeY,
  fade,
}: {
  site: Site;
  x: number;
  y: number;
  k: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  lift: number;
  kind: PinKind;
  selected: boolean;
  rank?: number;
  feature?: Feature;
  nudgeX?: number;
  nudgeY?: number;
  fade: number;
}) {
  const nudge = nudgeX != null && nudgeY != null ? { x: nudgeX, y: nudgeY } : undefined;
  let body: ReactNode;
  if (feature) {
    const ring =
      kind === 'pick'
        ? PICK_FILL
        : kind === 'match'
          ? MATCH_DOT.fill
          : site.status === 'new'
            ? STATUS_DOT.new.stroke
            : STATUS_RING[site.status];
    const r = selected ? BADGE_R + 2 : BADGE_R;
    // A pick's number rides on the badge's upper-right edge.
    const nx = (nudge?.x ?? 0) + r * 0.75;
    const ny = (nudge?.y ?? 0) - r * 0.75;
    body = (
      <>
        <FeatureBadge
          site={site}
          nudge={nudge}
          feature={feature}
          ring={ring}
          selected={selected}
          opacity={fade}
        />
        {kind === 'pick' ? (
          <>
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
          </>
        ) : null}
      </>
    );
  } else if (kind === 'pick') {
    body = (
      <>
        <Circle
          r={selected ? 12 : 10}
          fill={selected ? colors.accentRamp[700] : PICK_FILL}
          stroke={colors.neutral[100]}
          strokeWidth={2}
        />
        <SvgText
          // SVG text sits on its baseline; nudge down to centre it.
          y={3.8}
          textAnchor="middle"
          fontSize={11}
          fontFamily={fonts.bodyBold}
          fontWeight="bold"
          fill={colors.neutral[100]}
        >
          {String(rank)}
        </SvgText>
      </>
    );
  } else if (kind === 'match') {
    body = (
      <Circle
        r={selected ? 8 : 6}
        fill={MATCH_DOT.fill}
        stroke={selected ? colors.text : MATCH_DOT.stroke}
        strokeWidth={selected ? 2.5 : 1.75}
      />
    );
  } else {
    const look = STATUS_DOT[site.status];
    body = (
      <Circle
        r={selected ? 7 : 4}
        fill={look.fill}
        stroke={selected ? colors.text : look.stroke}
        strokeWidth={selected ? 2.5 : 1.5}
        opacity={fade}
      />
    );
  }
  return (
    <Pinned at={{ x, y }} view={{ k, tx, ty }} lift={lift}>
      {body}
    </Pinned>
  );
});

/**
 * Something drawn round its own origin and kept at a map point as the map
 * moves: a pin keeps its size while the land under it zooms.
 */
function Pinned({
  at,
  view,
  lift,
  children,
}: {
  at: Point;
  view: LiveView;
  lift: number;
  children: ReactNode;
}) {
  const { x, y } = at;
  const animatedProps = useAnimatedProps(() => {
    const scale = view.k.get();
    return { matrix: [1, 0, 0, 1, x * scale + view.tx.get(), y * scale + view.ty.get() + lift] };
  });
  return <AnimatedG animatedProps={animatedProps}>{children}</AnimatedG>;
}

/** The view that fits `bounds` (in map coordinates) into the box, padded and capped. */
function frameBounds(
  [[x0, y0], [x1, y1]]: [[number, number], [number, number]],
  size: { width: number; height: number },
  padX: number,
  padY: number,
  maxK: number,
): View2D {
  const k = Math.min(
    (size.width - padX * 2) / Math.max(x1 - x0, 1),
    (size.height - padY * 2) / Math.max(y1 - y0, 1),
    maxK,
  );
  return {
    k,
    tx: size.width / 2 - k * ((x0 + x1) / 2),
    ty: size.height / 2 - k * ((y0 + y1) / 2),
  };
}

/** The badge ring for parks you've been to or saved; a plain white edge otherwise. */
const STATUS_RING: Record<Exclude<SiteStatus, 'new'>, string> = {
  visited: colors.accentRamp[700],
  wishlist: colors.accent2Ramp[700],
};

type Point = { x: number; y: number };

/** Whether too many badges would overlap a neighbour to read (see CROWD_SHARE). */
function crowded(points: Point[]): boolean {
  if (points.length < 2) return false;
  const gap = BADGE_R * 2;
  let overlapping = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = 0; j < points.length; j++) {
      if (i !== j && Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) < gap) {
        overlapping++;
        break;
      }
    }
  }
  return overlapping > points.length * CROWD_SHARE;
}

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
 * A park's feature glyph on its terrain colour, ringed to show its status,
 * drawn round the park (the origin). When the badge has been nudged off its
 * park (`nudge`), a thin line and a dot mark where the park really is.
 */
function FeatureBadge({
  site,
  nudge,
  feature,
  ring,
  selected,
  opacity = 1,
}: {
  site: Site;
  nudge?: Point;
  feature: Feature;
  ring: string;
  selected: boolean;
  /** Set on each shape, not a group (see where the pins fade). */
  opacity?: number;
}) {
  const tone = terrainTone(site.group);
  const r = selected ? BADGE_R + 2 : BADGE_R;
  const bx = nudge?.x ?? 0;
  const by = nudge?.y ?? 0;
  const nudged = Math.hypot(bx, by) > 3;
  return (
    <>
      {nudged ? (
        <>
          <Path
            d={`M0 0L${bx} ${by}`}
            stroke={tone.ink}
            strokeWidth={1.25}
            opacity={0.6 * opacity}
          />
          <Circle r={2.25} fill={tone.ink} opacity={opacity} />
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
        opacity={opacity}
      />
      <FeatureGlyph
        feature={feature}
        cx={bx}
        cy={by}
        size={GLYPH_SIZE}
        color={tone.ink}
        opacity={opacity}
      />
    </>
  );
}

type PlacedDot = { site: Site; x: number; y: number };

/**
 * A passport-style stamp for a completed region: a gold double ring, the
 * inner one dashed, round a check mark, set at a slight tilt.
 */
function CompleteStamp() {
  const r = STAMP_R;
  return (
    <G transform="rotate(-12)">
      <Circle r={r} fill={colors.neutral[100]} opacity={0.92} />
      <Circle r={r} fill="none" stroke={EARNED_EDGE} strokeWidth={2.5} />
      <Circle
        r={r - 4.5}
        fill="none"
        stroke={EARNED_EDGE}
        strokeWidth={1.25}
        strokeDasharray="2.5 2"
      />
      <Path
        d={`M${-r * 0.36} ${r * 0.02}L${-r * 0.08} ${r * 0.3}L${r * 0.4} ${-r * 0.26}`}
        fill="none"
        stroke={EARNED_EDGE}
        strokeWidth={3.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </G>
  );
}

/**
 * Where a region's stamp sits: the middle of its land, weighted by each
 * state's size. If that point falls outside the region (Alaska & Hawaii's
 * middle is open sea), it goes on the biggest state's centre instead.
 */
function regionCentre(
  stateIds: string[],
  { projection, toPath }: { projection: GeoProjection; toPath: GeoPath },
): Point {
  const states = US_STATES.filter((state) => stateIds.includes(state.id)).map((state) =>
    mainLand(state, toPath),
  );
  let sum = 0;
  let x = 0;
  let y = 0;
  let biggest = { area: 0, at: [0, 0] as [number, number] };
  for (const state of states) {
    const area = toPath.area(state);
    const [cx, cy] = toPath.centroid(state);
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
    sum += area;
    x += cx * area;
    y += cy * area;
    if (area > biggest.area) biggest = { area, at: [cx, cy] };
  }
  if (sum === 0) return { x: biggest.at[0], y: biggest.at[1] };
  const centre: [number, number] = [x / sum, y / sum];
  const lonLat = projection.invert?.(centre);
  const inside = lonLat != null && states.some((state) => geoContains(state, lonLat));
  const [px, py] = inside ? centre : biggest.at;
  return { x: px, y: py };
}

/** Islands smaller than this share of a state's largest landmass don't count when framing it. */
const MIN_LAND_SHARE = 0.01;

/**
 * A state's main landmasses only, for framing a region zoom. Alaska's
 * outline trails the Aleutian chain far to the west (its tip even wraps
 * past the date line, drawn out towards Hawaii), which framed Alaska &
 * Hawaii far too wide. Hawaii's main islands all stay; no park sits on a
 * dropped island.
 */
function mainLand(feature: StateFeature, toPath: GeoPath): StateFeature {
  if (feature.geometry.type !== 'MultiPolygon') return feature;
  const polygons = feature.geometry.coordinates;
  const areas = polygons.map((coordinates) => toPath.area({ type: 'Polygon', coordinates }));
  const largest = Math.max(...areas);
  return {
    ...feature,
    geometry: {
      type: 'MultiPolygon',
      coordinates: polygons.filter((_, index) => areas[index] >= largest * MIN_LAND_SHARE),
    },
  };
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  // Drawing past the box (see `canvas`): let it, and let what's beyond show
  // through, since the page around it is the same colour.
  bleeding: {
    overflow: 'visible',
    backgroundColor: 'transparent',
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
