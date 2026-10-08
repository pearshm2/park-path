/**
 * The Explore map: US state outlines tinted by region, with a pin per park.
 *
 * Built with react-native-svg over d3-geo's Albers USA projection, which
 * is the projection the design prototype used — it tucks Alaska and
 * Hawaii into the lower left so the whole country fits a phone-shaped
 * box. react-native-maps was deliberately not used here: it does not run
 * on web at all, and tile imagery cannot carry the Organic palette.
 *
 * Two kinds of pin share the map. Parks in `rankById` are the quiz's
 * picks and get a large numbered pin that matches their card below the
 * map. Every other park is a small dot styled by its visit status, and
 * fades back while there are picks to show, so the picks read first.
 *
 * A consequence of Albers USA worth knowing: it has no projection for
 * territories, so American Samoa and the Virgin Islands return null and
 * are absent from the map. The prototype notes the same limitation.
 */

import { geoAlbersUsa, geoPath } from 'd3-geo';
import { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';

import type { Site, SiteStatus } from '../data/parks';
import { STATE_REGION } from '../data/regions';
import { US_STATES } from '../data/usStates';
import { colors, fonts } from '../theme';

/** d3-geo wants a FeatureCollection to fit the projection against. */
const STATES_COLLECTION = {
  type: 'FeatureCollection' as const,
  features: US_STATES,
};

/** How each visit status draws as a small dot. Shared with the map key. */
export const STATUS_DOT: Record<SiteStatus, { fill: string; stroke: string; label: string }> = {
  visited: { fill: colors.accentRamp[700], stroke: colors.neutral[100], label: 'Visited' },
  wishlist: { fill: colors.neutral[100], stroke: colors.accent2Ramp[700], label: 'Wishlist' },
  new: { fill: colors.neutral[600], stroke: colors.neutral[100], label: 'Not yet' },
};

/** The numbered pin's fill. Shared with the map key. */
export const PICK_FILL = colors.accent;

/** Small dots are hard to hit with a finger, so each gets a wider invisible target. */
const HIT_RADIUS = 11;

type ParkMapProps = {
  sites: Site[];
  /** Site id -> 1-based rank, for the parks drawn as numbered pins. */
  rankById?: ReadonlyMap<string, number>;
  selectedId?: string | null;
  onSelectSite?: (site: Site) => void;
  style?: StyleProp<ViewStyle>;
};

export function ParkMap({ sites, rankById, selectedId, onSelectSite, style }: ParkMapProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  function onLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    // Avoid re-projecting on sub-pixel layout jitter.
    if (Math.abs(width - size.width) > 1 || Math.abs(height - size.height) > 1) {
      setSize({ width, height });
    }
  }

  const { statePaths, dots } = useMemo(() => {
    if (size.width < 1 || size.height < 1) {
      return { statePaths: [] as { id: string; d: string }[], dots: [] as PlacedDot[] };
    }

    // A little padding so coastal outlines are not flush to the edge.
    const projection = geoAlbersUsa().fitExtent(
      [
        [8, 8],
        [size.width - 8, size.height - 8],
      ],
      STATES_COLLECTION,
    );
    const toPath = geoPath(projection);

    const paths = US_STATES.flatMap((feature) => {
      const d = toPath(feature);
      return d ? [{ id: feature.id, d }] : [];
    });

    const placed = sites.flatMap<PlacedDot>((site) => {
      // Lon/lat order, which is what GeoJSON and d3 expect.
      const point = projection([site.lon, site.lat]);
      if (!point) return []; // Outside the Albers USA domain.
      return [{ site, x: point[0], y: point[1] }];
    });

    return { statePaths: paths, dots: placed };
  }, [size.width, size.height, sites]);

  const hasPicks = (rankById?.size ?? 0) > 0;
  const picks = dots.filter((dot) => rankById?.has(dot.site.id));
  const others = dots.filter((dot) => !rankById?.has(dot.site.id));
  // Draw #1 last so it sits on top where pins overlap.
  picks.sort((a, b) => rankById!.get(b.site.id)! - rankById!.get(a.site.id)!);

  return (
    <View style={[styles.container, style]} onLayout={onLayout}>
      {size.width > 0 && size.height > 0 ? (
        <Svg width={size.width} height={size.height}>
          <G>
            {statePaths.map((state) => (
              <Path
                key={state.id}
                d={state.d}
                fill={STATE_REGION[state.id]?.fill ?? colors.neutral[300]}
                stroke={colors.bg}
                strokeWidth={1}
              />
            ))}
          </G>

          <G opacity={hasPicks ? 0.6 : 1}>
            {others.map(({ site, x, y }) => {
              const selected = site.id === selectedId;
              const look = STATUS_DOT[site.status];
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
            {picks.map(({ site, x, y }) => {
              const selected = site.id === selectedId;
              const r = selected ? 12 : 10;
              return (
                <G key={site.id} onPress={onSelectSite ? () => onSelectSite(site) : undefined}>
                  <Circle
                    cx={x}
                    cy={y}
                    r={r}
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
                    {String(rankById!.get(site.id))}
                  </SvgText>
                </G>
              );
            })}
          </G>
        </Svg>
      ) : null}
    </View>
  );
}

type PlacedDot = { site: Site; x: number; y: number };

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
});
