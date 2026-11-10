/**
 * The quiet detail behind the tab screens: a night sky in the dark
 * palettes (StarField), and in light mode its daytime twin, a trail map's
 * contour lines (the rings of height on a hiking map) around a few
 * "summits". Both are still, faint and fixed, so they're the same on
 * every screen and never compete with what's on it.
 *
 * Drawn once, behind all the tabs (app/(tabs)/_layout.tsx), whose screens
 * are see-through over it. On Android each <Svg> keeps a full-screen
 * bitmap of its own, so one per tab (as it first was) cost five of them.
 */

import { memo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, isDark } from '../theme';
import { StarField } from './StarField';

/** A small seeded random number generator, so the map never changes. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** Summits: where each set of rings centres (0-1 of the screen), and how many rings. */
const SUMMITS: { x: number; y: number; rings: number; seed: number }[] = [
  { x: 0.92, y: 0.12, rings: 7, seed: 3 },
  { x: 0.05, y: 0.52, rings: 6, seed: 11 },
  { x: 0.82, y: 0.86, rings: 8, seed: 23 },
];

/**
 * One closed, wobbly ring: a circle whose radius rises and falls with a
 * few slow waves, so neighbouring rings bunch and spread like real
 * contours on a slope.
 */
function ring(cx: number, cy: number, radius: number, waves: { k: number; a: number; p: number }[]): string {
  const steps = 72;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const r = radius * (1 + waves.reduce((sum, w) => sum + w.a * Math.sin(w.k * t + w.p), 0));
    const x = cx + r * Math.cos(t);
    const y = cy + r * Math.sin(t) * 0.82;
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `${d}Z`;
}

function contours(width: number, height: number): string[] {
  return SUMMITS.flatMap((summit) => {
    const random = seeded(summit.seed);
    const waves = [2, 3, 5].map((k) => ({ k, a: 0.04 + random() * 0.07, p: random() * Math.PI * 2 }));
    const step = width * (0.055 + random() * 0.02);
    return Array.from({ length: summit.rings }, (_, i) => {
      // Each ring out drifts a little, as a slope isn't even all round.
      const drift = i * step * 0.12;
      return ring(summit.x * width + drift, summit.y * height - drift * 0.6, step * (i + 1), waves);
    });
  });
}

const TrailMap = memo(function TrailMap() {
  const { width, height } = useWindowDimensions();
  return (
    <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
      {contours(width, height).map((d, i) => (
        <Path key={i} d={d} fill="none" stroke={colors.neutral[600]} strokeWidth={1} opacity={i % 5 === 4 ? 0.16 : 0.09} />
      ))}
    </Svg>
  );
});

/** The backdrop for the current palette. */
export function Backdrop() {
  return isDark ? <StarField /> : <TrailMap />;
}
