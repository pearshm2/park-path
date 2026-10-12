/**
 * A park on a real map — Apple Maps on iPhone, Google Maps on Android —
 * with the NPS trails drawn on top and still tappable, visitor centers as
 * green stars and you as a red one. Pinch, pan and rotate are the map's own.
 *
 * Roads and labels come from the base map, so only the park's outline and
 * its trails are drawn. Satellite and terrain views show what the ground
 * actually looks like.
 */

import { useMemo, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, type LatLng, type MapType } from 'react-native-maps';

import type { ParkMap } from '../../api/parkMaps';
import { colors } from '../../theme';
import { BodyText } from '../Typography';
import { TRAIL_INK, TRAIL_SELECTED, type MapSelection } from './shared';
import { StarIcon, VISITOR_CENTER_STAR, YOU_STAR } from './stars';

export type RealMapStyle = 'standard' | 'terrain' | 'satellite';

const MAP_TYPE: Record<RealMapStyle, MapType> = {
  standard: 'standard',
  // Android has a shaded-relief terrain map; Apple Maps doesn't, so its
  // nearest is the muted standard map with the trails standing out.
  terrain: Platform.OS === 'android' ? 'terrain' : 'mutedStandard',
  satellite: 'hybrid',
};

const toLatLng = ([longitude, latitude]: [number, number]): LatLng => ({ latitude, longitude });

export function RealParkMap({
  map,
  mapStyle,
  you,
  selection,
  onSelect,
}: {
  map: ParkMap;
  mapStyle: RealMapStyle;
  you: [number, number] | null;
  selection: MapSelection;
  onSelect: (selection: MapSelection) => void;
}) {
  const ref = useRef<MapView>(null);
  const selectedTrail = selection && 'trail' in selection ? selection.trail : null;

  const lines = useMemo(
    () => ({
      boundary: map.boundary.map((ring) => ring.map(toLatLng)),
      trails: map.trails.flatMap((trail, i) =>
        trail.paths.map((path, j) => ({
          key: `${i}-${j}`,
          name: trail.name,
          closed: trail.closed,
          coordinates: path.map(toLatLng),
        })),
      ),
    }),
    [map],
  );

  // Frame the whole park once the map is ready.
  const fitPark = () => {
    const points = lines.boundary.length
      ? lines.boundary.flat()
      : lines.trails.flatMap((trail) => trail.coordinates);
    if (points.length === 0) return;
    ref.current?.fitToCoordinates(points, {
      edgePadding: { top: 30, right: 30, bottom: 30, left: 30 },
      animated: false,
    });
  };

  const satellite = mapStyle === 'satellite';

  return (
    <MapView
      ref={ref}
      style={StyleSheet.absoluteFill}
      mapType={MAP_TYPE[mapStyle]}
      onMapReady={fitPark}
      showsCompass
      showsScale
      toolbarEnabled={false}
    >
      {lines.boundary.map((ring, i) => (
        <Polyline
          key={`boundary-${i}`}
          coordinates={ring}
          strokeColor={satellite ? '#ffffff' : colors.accent2Ramp[700]}
          strokeWidth={2}
          lineDashPattern={[8, 5]}
        />
      ))}
      {lines.trails.map((trail) => {
        const active = trail.name !== null && trail.name === selectedTrail;
        return (
          <Polyline
            key={`trail-${trail.key}-${active}`}
            coordinates={trail.coordinates}
            strokeColor={active ? TRAIL_SELECTED : satellite ? '#ffd27a' : TRAIL_INK}
            strokeWidth={active ? 5 : 2.5}
            lineDashPattern={trail.closed ? [4, 4] : undefined}
            zIndex={active ? 2 : 1}
            tappable={trail.name !== null}
            onPress={() => onSelect(active ? null : { trail: trail.name! })}
          />
        );
      })}
      {map.places.map((place, i) => (
        <Marker
          key={`place-${i}`}
          coordinate={toLatLng(place.point)}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
          onPress={() => onSelect({ place })}
        >
          <StarIcon color={VISITOR_CENTER_STAR} size={24} />
        </Marker>
      ))}
      {you ? (
        <Marker coordinate={toLatLng(you)} anchor={{ x: 0.12, y: 0.5 }} zIndex={10}>
          <View style={styles.you}>
            <StarIcon color={YOU_STAR} size={28} />
            <View style={styles.youLabel}>
              <BodyText size={11} weight="semibold" color={YOU_STAR}>
                You are here
              </BodyText>
            </View>
          </View>
        </Marker>
      ) : null}
    </MapView>
  );
}

const styles = StyleSheet.create({
  you: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  youLabel: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: colors.neutral[100],
  },
});
