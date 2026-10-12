/**
 * The stars on a park's map: green for a visitor center, red for "you are
 * here", like the star on the map board at a visitor center. Used as the
 * real map's markers and in the legend.
 */

import Svg, { Path, type NumberProp } from 'react-native-svg';

import { colors } from '../../theme';

export const VISITOR_CENTER_STAR = colors.accent2Ramp[700];
export const YOU_STAR = '#d1352b';

/** A five-pointed star centred on (cx, cy), with outer radius r. */
export function starPath(cx: number, cy: number, r: number): string {
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    return `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`;
  });
  return `M${points.join('L')}Z`;
}

/** A star as its own small SVG, for map markers and legends. */
export function StarIcon({ color, size = 22 }: { color: string; size?: NumberProp }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={starPath(12, 12.8, 11)}
        fill={color}
        stroke={colors.neutral[100]}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
