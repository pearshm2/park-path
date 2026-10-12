/**
 * What the park map views share: trail colours, what's selected, and
 * whether a location falls within the park.
 */

import type { ParkMap, Place } from '../../api/parkMaps';
import { colors } from '../../theme';

export const TRAIL_INK = colors.accentRamp[800];
export const TRAIL_SELECTED = colors.accent;

/** A tapped trail (by name, since the NPS splits trails into parts) or visitor center. */
export type MapSelection = { trail: string } | { place: Place } | null;

/** True when `you` falls inside the park's bounds (roughly: its bounding box). */
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
