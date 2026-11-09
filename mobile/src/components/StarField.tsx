/**
 * A faint night sky behind the tab screens in the dark palettes
 * (theme/appearance.ts): scattered stars of a few sizes, and three
 * constellations traced in thin lines (the Big Dipper, Cassiopeia and
 * Orion's belt and shoulders). Nothing moves, and nothing is bright
 * enough to compete with the screen: it's a detail to notice, not look
 * at. Drawn once per screen; nothing in light mode.
 *
 * Positions are fixed (from a seeded shuffle), so the sky is the same on
 * every screen and every launch.
 */

import { memo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Line } from 'react-native-svg';

import { colors, isDark } from '../theme';

/** A small seeded random number generator, so the sky never changes. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

type Star = { x: number; y: number; r: number; o: number };

/** Scattered stars, in 0-1 coordinates of the screen. */
const STARS: Star[] = (() => {
  const random = seeded(7);
  return Array.from({ length: 70 }, () => {
    const big = random() > 0.88;
    return { x: random(), y: random(), r: big ? 1.3 : 0.6 + random() * 0.5, o: big ? 0.5 : 0.18 + random() * 0.22 };
  });
})();

/**
 * Constellations: their stars (0-1 of the screen's width; y in the same
 * units from their anchor), and which pairs are joined.
 */
const CONSTELLATIONS: { at: [number, number]; scale: number; stars: [number, number][]; lines: [number, number][] }[] = [
  // The Big Dipper, high on the right, clear of the screen titles.
  {
    at: [0.5, 0.16],
    scale: 0.42,
    stars: [[0, 0.1], [0.17, 0.06], [0.31, 0.1], [0.45, 0.15], [0.5, 0.3], [0.71, 0.32], [0.74, 0.14]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
  },
  // Cassiopeia's W, on the right.
  {
    at: [0.66, 0.38],
    scale: 0.3,
    stars: [[0, 0], [0.22, 0.2], [0.45, 0.06], [0.68, 0.24], [0.9, 0.04]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  // Orion's shoulders, belt and feet, low on the left.
  {
    at: [0.12, 0.66],
    scale: 0.3,
    stars: [[0.05, 0], [0.62, 0.04], [0.26, 0.32], [0.34, 0.34], [0.42, 0.36], [0.02, 0.7], [0.66, 0.66]],
    lines: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]],
  },
];

export const StarField = memo(function StarField() {
  const { width, height } = useWindowDimensions();
  if (!isDark) return null;
  const ink = colors.onColor;
  return (
    <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
      {STARS.map((star, i) => (
        <Circle key={i} cx={star.x * width} cy={star.y * height} r={star.r} fill={ink} opacity={star.o} />
      ))}
      {CONSTELLATIONS.map((c, i) => {
        const point = ([x, y]: [number, number]) => ({
          x: (c.at[0] + x * c.scale) * width,
          y: c.at[1] * height + y * c.scale * width,
        });
        return (
          <G key={i}>
            {c.lines.map(([a, b]) => {
              const from = point(c.stars[a]);
              const to = point(c.stars[b]);
              return (
                <Line
                  key={`${a}-${b}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={ink}
                  strokeWidth={0.6}
                  opacity={0.12}
                />
              );
            })}
            {c.stars.map((s, j) => {
              const p = point(s);
              return <Circle key={j} cx={p.x} cy={p.y} r={1.4} fill={ink} opacity={0.45} />;
            })}
          </G>
        );
      })}
    </Svg>
  );
});
