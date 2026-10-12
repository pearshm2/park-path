/**
 * A park's map drawn in the app's own style: the boundary in its region's
 * tint, roads in grey, trails on top (dashed where temporarily closed),
 * visitor centers as green stars and you as a red one. Pinch to zoom.
 *
 * Drawn at RESOLUTION times the frame's size and fitted down, so zooming
 * in shows real detail (see ZoomableView). Line widths are scaled to match,
 * so at the fitted size everything looks as it would drawn 1:1.
 */

import { geoMercator } from 'd3-geo';
import { useMemo } from 'react';
import Svg, { G, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { MapPath, ParkMap, Place } from '../../api/parkMaps';
import { colors, fonts } from '../../theme';
import { starPath, VISITOR_CENTER_STAR, YOU_STAR } from './stars';
import { ZoomableView } from './ZoomableView';

const RESOLUTION = 2.5;
const PAD = 12;

export const TRAIL_INK = colors.accentRamp[800];
export const TRAIL_SELECTED = colors.accent;
export const ROAD_INK = colors.neutral[500];

export type MapSelection = { trail: string } | { place: Place } | null;

export function DrawnParkMap({
  map,
  width,
  height,
  tint,
  you,
  selection,
  onSelect,
}: {
  map: ParkMap;
  width: number;
  height: number;
  /** The park's region colour, for the land inside the boundary. */
  tint: string;
  /** Where the phone is, [longitude, latitude]; drawn if it's on the map. */
  you: [number, number] | null;
  selection: MapSelection;
  onSelect: (selection: MapSelection) => void;
}) {
  const w = width * RESOLUTION;
  const h = height * RESOLUTION;
  const r = RESOLUTION; // multiplies every size below

  const drawn = useMemo(() => {
    const fitTo = map.boundary.length
      ? map.boundary.flat()
      : [...map.trails, ...map.roads].flatMap((line) => line.paths.flat());
    if (fitTo.length === 0) return null;

    // Projected point by point rather than through geoPath: the NPS rings
    // wind the way GeoJSON specifies, which d3's spherical polygons read
    // as "everything but the park".
    const projection = geoMercator().fitExtent(
      [
        [PAD * r, PAD * r],
        [w - PAD * r, h - PAD * r],
      ],
      { type: 'MultiPoint', coordinates: fitTo },
    );
    const project = (point: [number, number]) => projection(point) ?? [0, 0];
    const toD = (paths: MapPath[], close = false) =>
      paths
        .map(
          (path) =>
            path
              .map((point, i) => {
                const [x, y] = project(point);
                return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join('') + (close ? 'Z' : ''),
        )
        .join('');

    return {
      project,
      boundary: toD(map.boundary, true),
      roads: map.roads.map((road, i) => ({ key: i, kind: road.kind, d: toD(road.paths) })),
      trails: map.trails.map((trail, i) => ({
        key: i,
        name: trail.name,
        closed: trail.closed,
        d: toD(trail.paths),
      })),
      places: map.places.map((place, i) => {
        const [x, y] = project(place.point);
        return { key: i, place, x, y };
      }),
    };
  }, [map, w, h, r]);

  if (!drawn) return null;

  const selectedTrail = selection && 'trail' in selection ? selection.trail : null;
  const selectedPlace = selection && 'place' in selection ? selection.place : null;
  const [youX, youY] = you ? drawn.project(you) : [-1, -1];
  const youOnMap = you !== null && youX >= 0 && youX <= w && youY >= 0 && youY <= h;

  return (
    <ZoomableView width={width} height={height} contentWidth={w} contentHeight={h}>
      <Svg width={w} height={h}>
        <Rect x={0} y={0} width={w} height={h} fill={colors.neutral[100]} />
        {drawn.boundary ? (
          <Path
            d={drawn.boundary}
            fill={tint}
            fillRule="evenodd"
            stroke={colors.neutral[600]}
            strokeWidth={1 * r}
            strokeLinejoin="round"
          />
        ) : null}
        {drawn.roads.map((road) => (
          <Path
            key={`road-${road.key}`}
            d={road.d}
            fill="none"
            stroke={ROAD_INK}
            strokeWidth={(road.kind === 'primary' ? 2.2 : road.kind === 'secondary' ? 1.6 : 1) * r}
            strokeDasharray={road.kind === '4wd' ? [3 * r, 3 * r] : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {drawn.trails.map((trail) => (
          <Path
            key={`trail-${trail.key}`}
            d={trail.d}
            fill="none"
            stroke={TRAIL_INK}
            strokeOpacity={selectedTrail && trail.name !== selectedTrail ? 0.45 : 1}
            strokeWidth={1.4 * r}
            strokeDasharray={trail.closed ? [2 * r, 3 * r] : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {/* The selected trail again, on top of everything else. */}
        {drawn.trails
          .filter((trail) => trail.name !== null && trail.name === selectedTrail)
          .map((trail) => (
            <Path
              key={`selected-${trail.key}`}
              d={trail.d}
              fill="none"
              stroke={TRAIL_SELECTED}
              strokeWidth={3.5 * r}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        {/* Wide, nearly invisible copies of the named trails, so a thin
            line is still easy to tap. */}
        {drawn.trails
          .filter((trail) => trail.name !== null)
          .map((trail) => (
            <Path
              key={`hit-${trail.key}`}
              d={trail.d}
              fill="none"
              stroke="#000"
              strokeOpacity={0.01}
              strokeWidth={14 * r}
              onPress={() =>
                onSelect(trail.name === selectedTrail ? null : { trail: trail.name! })
              }
            />
          ))}
        {drawn.places.map(({ key, place, x, y }) => {
          const active = selectedPlace === place;
          return (
            <G key={`place-${key}`} onPress={() => onSelect(active ? null : { place })}>
              {/* A bigger invisible circle of a target around the star. */}
              <Path d={starPath(x, y, 16 * r)} fill="#000" fillOpacity={0.01} />
              <Path
                d={starPath(x, y, (active ? 10 : 8) * r)}
                fill={VISITOR_CENTER_STAR}
                stroke={colors.neutral[100]}
                strokeWidth={1.4 * r}
                strokeLinejoin="round"
              />
            </G>
          );
        })}
        {youOnMap ? (
          <G>
            <Path
              d={starPath(youX, youY, 10 * r)}
              fill={YOU_STAR}
              stroke={colors.neutral[100]}
              strokeWidth={1.8 * r}
              strokeLinejoin="round"
            />
            {/* Twice: a pale outline first, so the label reads on any colour. */}
            {[true, false].map((halo) => (
              <SvgText
                key={halo ? 'halo' : 'text'}
                x={youX + 13 * r}
                y={youY + 4 * r}
                fontSize={11 * r}
                fontFamily={fonts.bodySemibold}
                fill={halo ? colors.neutral[100] : YOU_STAR}
                stroke={halo ? colors.neutral[100] : undefined}
                strokeWidth={halo ? 3 * r : 0}
                strokeLinejoin="round"
              >
                You are here
              </SvgText>
            ))}
          </G>
        ) : null}
      </Svg>
    </ZoomableView>
  );
}

/** True when `you` falls inside the area the map shows (roughly, by bounds). */
export function isOnMap(map: ParkMap, you: [number, number] | null): boolean {
  if (!you) return false;
  const points = map.boundary.length
    ? map.boundary.flat()
    : [...map.trails, ...map.roads].flatMap((line) => line.paths.flat());
  if (points.length === 0) return false;
  const lons = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  return (
    you[0] >= Math.min(...lons) &&
    you[0] <= Math.max(...lons) &&
    you[1] >= Math.min(...lats) &&
    you[1] <= Math.max(...lats)
  );
}
