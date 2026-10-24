/**
 * The picture in the middle of a park's passport stamp: original line art
 * of what the park is known for (its `feature` in the curated data), in the
 * spirit of the pictorial stamps at park visitor centres but drawn for
 * ParkPath, not copied from them.
 *
 * Each drawing is a handful of strokes on a 48 x 48 grid, in the same
 * rounded line style as the app's other icons. Parks without one yet show
 * their terrain icon instead, so every stamp has a picture.
 *
 * `ParkArt` draws it as its own SVG; `parkArtShapes` gives the shapes to
 * place inside another SVG (the ink stamp).
 */

import { Fragment, type ReactNode } from 'react';
import Svg, { Circle, G, Path } from 'react-native-svg';

import type { TerrainGroup } from '../../data/parks';

type Stroke = { d: string; fill?: boolean };
type Drawing = { strokes: Stroke[]; dots?: [number, number, number][] };

const DRAWINGS: Record<string, Drawing> = {
  // Acadia: Bass Harbor Head light on the granite shore, the sun rising
  // over the sea (Cadillac Mountain sees the country's first sunrise).
  acad: {
    strokes: [
      { d: 'M5 30a7 7 0 0 1 14 0' },
      { d: 'M2 30H17' },
      { d: 'M12 20.5v-3' },
      { d: 'M5.6 23.6l-2-2' },
      { d: 'M18.4 23.6l2-2' },
      { d: 'M33.5 29.5L35 16h4l1.5 13.5' },
      { d: 'M34.5 16v-3.5h5V16' },
      { d: 'M33.8 12.5L37 9.5l3.2 3' },
      { d: 'M42.5 12.5l3.5-1.5' },
      { d: 'M42.5 15.5l3.5 1' },
      { d: 'M18 35l5-5 4 1.5 4-2h12l4 5.5' },
      { d: 'M2 40c3-2 5-2 8 0s5 2 8 0 5-2 8 0 5 2 8 0 5-2 8 0' },
      { d: 'M10 45c3-2 5-2 8 0s5 2 8 0 5-2 8 0' },
    ],
  },
  // Shenandoah: the Blue Ridge, ridge behind hazy ridge to the horizon,
  // the sun coming up over them.
  shen: {
    strokes: [
      { d: 'M9 17a5 5 0 0 1 10 0' },
      { d: 'M14 9v-3' },
      { d: 'M7.5 11.5l-2-2' },
      { d: 'M20.5 11.5l2-2' },
      { d: 'M2 21C8 15 12 15 17 18S27 12 33 14s10 3 13 5' },
      { d: 'M2 29c5-5 11-6 17-3s11-5 17-3 8 4 10 4' },
      { d: 'M2 37c7-5 13-5 19-2s12-5 18-3 6 3 7 3' },
      { d: 'M2 45c7-4 13-4 19-1s12-4 18-2 6 2 7 2' },
      { d: 'M33 8l2 1.5L37 8' },
    ],
  },
  // Grand Canyon: the canyon in profile, rim to rim, its walls stepping
  // down in terraces to the Colorado River, with a condor overhead.
  grca: {
    strokes: [
      { d: 'M2 13h8l3 6h4l2 7h3l1 7h2l1-7h3l2-7h4l3-6h8' },
      { d: 'M4 21h9' },
      { d: 'M35 21h9' },
      { d: 'M6 28h12' },
      { d: 'M30 28h12' },
      { d: 'M14 37c3-2 6-2 10 0s7 2 10 0' },
      { d: 'M14 43c3-2 6-2 10 0s7 2 10 0' },
      { d: 'M27 6c2-2 4-2 5 0 1-2 3-2 5 0' },
    ],
  },
  // Zion: towering sandstone cliffs either side of the Virgin River,
  // streaked top to bottom, the sun in the gap between them.
  zion: {
    strokes: [
      { d: 'M3 46V14c2-6 6-8 9-6 3 2 4 8 5 14v24' },
      { d: 'M45 46V10c-2-5-6-6-9-3-3 3-4 9-5 16v23' },
      { d: 'M8 17v22' },
      { d: 'M12 13v8' },
      { d: 'M40 14v24' },
      { d: 'M36 11v8' },
      { d: 'M24 9a3 3 0 1 0 0.01 0' },
      { d: 'M18 41c2-1.5 4-1.5 6 0s4 1.5 6 0' },
    ],
  },
  // Rocky Mountain: snow-capped peaks above the alpine tundra, with
  // wildflowers in the foreground.
  romo: {
    strokes: [
      { d: 'M2 32l10-15 4 5 8-14 8 12 4-4 10 16' },
      { d: 'M20.5 14.5l3.5-6.5 3.5 6.5-1.8-1.2-1.7 1.7-1.7-1.7z', fill: true },
      { d: 'M2 36c8-2 16-2 22 0s14 2 22 0' },
      { d: 'M11 46v-5' },
      { d: 'M21 46v-4' },
      { d: 'M31 46v-5' },
      { d: 'M39 46l1.5-4 1.5 4' },
    ],
    dots: [
      [11, 40, 2],
      [21, 41, 2],
      [31, 40, 2],
    ],
  },
  // Great Smoky Mountains: forested ridges in the mist they're named for,
  // and the synchronous fireflies of Elkmont.
  grsm: {
    strokes: [
      { d: 'M2 21c8-8 14-8 20-4s12-6 24 0' },
      { d: 'M2 30c7-6 13-6 20-3s13-5 24 0' },
      { d: 'M6 25h10' },
      { d: 'M28 23.5h12' },
      { d: 'M5 46l6-11 6 11z' },
      { d: 'M15 46l5-9 5 9z' },
    ],
    dots: [
      [31, 38, 1.4],
      [37, 34, 1.4],
      [42, 40, 1.4],
      [34, 44, 1.4],
      [44, 33, 1.4],
    ],
  },
};

/** The terrain icons' strokes (on a 24 grid), for parks without a drawing. */
const TERRAIN: Record<TerrainGroup, string[]> = {
  mountain: ['M2 19l7-12 4 7 2-3 5 8H2z'],
  canyon: ['M3 20V10l4-3 4 3v10', 'M13 20V7l4-2 4 2v13', 'M2 20h20'],
  desert: ['M12 4a3 3 0 100 6 3 3 0 000-6z', 'M2 20c3-5 6-5 9 0', 'M11 20c2-3 4-3 6-1'],
  forest: ['M12 3l5 9h-3l3 5H7l3-5H7z', 'M12 17v4'],
  coast: ['M7 11l5-6 5 6', 'M2 16c2-2 4-2 6 0s4 2 6 0 4-2 6 0', 'M2 20c2-2 4-2 6 0s4 2 6 0 4-2 6 0'],
  water: ['M12 3s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z'],
  dunes: ['M2 18c4-6 8-6 11 0', 'M10 18c3-4 6-4 10 0', 'M2 21h20'],
  caves: ['M3 20V13a9 9 0 0118 0v7', 'M9 20v-4a3 3 0 016 0v4'],
  badlands: ['M2 20l5-9 3 5 3-7 4 6 3-3v8z'],
};

/** Whether a park has its own drawing (rather than its terrain icon). */
export function hasParkArt(code: string): boolean {
  return code in DRAWINGS;
}

/**
 * The drawing's shapes on a 48 x 48 grid, to place inside another SVG
 * (wrap them in a <G> to move or scale them).
 */
export function parkArtShapes({
  code,
  group,
  color,
  strokeWidth = 2,
}: {
  code: string;
  group: TerrainGroup | null;
  color: string;
  strokeWidth?: number;
}): ReactNode {
  const drawing = DRAWINGS[code];
  const line = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (!drawing) {
    // The terrain icon, scaled up to the 48 grid and inset a little.
    return (
      <G transform="translate(6 6) scale(1.5)">
        {TERRAIN[group ?? 'mountain'].map((d) => (
          <Path key={d} d={d} fill="none" {...line} strokeWidth={strokeWidth / 1.5} />
        ))}
      </G>
    );
  }
  return (
    <Fragment>
      {drawing.strokes.map((s) => (
        <Path key={s.d} d={s.d} fill={s.fill ? color : 'none'} {...line} />
      ))}
      {drawing.dots?.map(([cx, cy, r]) => (
        <Circle key={`${cx},${cy}`} cx={cx} cy={cy} r={r} fill={color} />
      ))}
    </Fragment>
  );
}

/** A park's drawing as its own picture. */
export function ParkArt({
  code,
  group,
  size = 40,
  color,
  strokeWidth,
}: {
  code: string;
  group: TerrainGroup | null;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {parkArtShapes({ code, group, color, strokeWidth })}
    </Svg>
  );
}
