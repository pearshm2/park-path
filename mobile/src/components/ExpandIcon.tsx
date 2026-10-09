/**
 * Two arrows pointing out to opposite corners: "see more of this". Used by
 * the card's detail button and the map's full-screen button.
 */

import Svg, { Path } from 'react-native-svg';

const PATHS = ['M14 4h6v6', 'M10 20H4v-6', 'M20 4l-6.5 6.5', 'M4 20l6.5-6.5'];

export function ExpandIcon({ size = 14, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {PATHS.map((d) => (
        <Path
          key={d}
          d={d}
          stroke={color}
          strokeWidth={2.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
