/**
 * The Explore map: US state outlines with a dot per park.
 *
 * Built with react-native-svg over d3-geo's Albers USA projection, which
 * is the projection the design prototype used — it tucks Alaska and
 * Hawaii into the lower left so the whole country fits a phone-shaped
 * box. react-native-maps was deliberately not used here: it does not run
 * on web at all, and tile imagery cannot carry the Organic palette.
 *
 * A consequence of Albers USA worth knowing: it has no projection for
 * territories, so American Samoa and the Virgin Islands return null and
 * are absent from the map. The prototype notes the same limitation.
 */

import { geoAlbersUsa, geoPath } from 'd3-geo';
import { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import type { Site } from '../data/parks';
import { US_STATES } from '../data/usStates';
import { colors } from '../theme';

/** d3-geo wants a FeatureCollection to fit the projection against. */
const STATES_COLLECTION = {
  type: 'FeatureCollection' as const,
  features: US_STATES,
};

type ParkMapProps = {
  sites: Site[];
  selectedId?: string | null;
  onSelectSite?: (site: Site) => void;
  style?: StyleProp<ViewStyle>;
};

export function ParkMap({ sites, selectedId, onSelectSite, style }: ParkMapProps) {
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

  return (
    <View style={[styles.container, style]} onLayout={onLayout}>
      {size.width > 0 && size.height > 0 ? (
        <Svg width={size.width} height={size.height}>
          <G>
            {statePaths.map((state) => (
              <Path
                key={state.id}
                d={state.d}
                fill={colors.accent2Ramp[200]}
                stroke={colors.bg}
                strokeWidth={1}
              />
            ))}
          </G>
          <G>
            {dots.map(({ site, x, y }) => {
              const selected = site.id === selectedId;
              return (
                <Circle
                  key={site.id}
                  cx={x}
                  cy={y}
                  r={selected ? 7 : 4}
                  fill={selected ? colors.accentRamp[600] : colors.accent}
                  stroke={colors.neutral[100]}
                  strokeWidth={selected ? 2.75 : 1.5}
                  onPress={onSelectSite ? () => onSelectSite(site) : undefined}
                />
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
    flex: 1,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
});
