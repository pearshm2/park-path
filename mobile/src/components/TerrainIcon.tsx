/**
 * A glyph and a colour for each terrain family.
 *
 * The design prototype anchors every feed card with a photograph. There
 * are no photographs in this project yet, so each card gets a tinted
 * band with its terrain mark instead — enough to make the list scannable
 * at a glance, and swappable for real imagery later without touching the
 * card's layout.
 *
 * Colours stay inside the two accent ramps rather than reaching for new
 * hues: the design system has exactly two accents and warns against
 * desaturating the palette, so variety comes from ramp steps.
 */

import Svg, { Path } from 'react-native-svg';

import type { TerrainGroup } from '../data/parks';
import { colors, DAY } from '../theme';
import type { Palette } from '../theme/tokens';

/** Stroke weight the design system uses for every icon. */
const STROKE = 2.75;

const PATHS: Record<TerrainGroup, string[]> = {
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

type Step = { ramp: 'accentRamp' | 'accent2Ramp' | 'neutral'; band: 100 | 200 | 300 | 400; ink: 700 | 800 | 900 };

/** Band fill behind the glyph, and the glyph's own colour, as steps of a ramp. */
const TONES: Record<TerrainGroup, Step> = {
  mountain: { ramp: 'accent2Ramp', band: 300, ink: 800 },
  canyon: { ramp: 'accentRamp', band: 300, ink: 800 },
  desert: { ramp: 'accentRamp', band: 200, ink: 800 },
  forest: { ramp: 'accent2Ramp', band: 400, ink: 900 },
  coast: { ramp: 'accent2Ramp', band: 200, ink: 800 },
  water: { ramp: 'accent2Ramp', band: 100, ink: 700 },
  dunes: { ramp: 'accentRamp', band: 100, ink: 700 },
  caves: { ramp: 'neutral', band: 300, ink: 800 },
  badlands: { ramp: 'neutral', band: 200, ink: 700 },
};
/** A site with no curated terrain gets the neutral tone. */
const PLAIN: Step = { ramp: 'neutral', band: 200, ink: 800 };

function toneIn(palette: Palette, group: TerrainGroup | null) {
  const step = (group && TONES[group]) ?? PLAIN;
  const ramp = palette[step.ramp];
  return { band: ramp[step.band], ink: ramp[step.ink] };
}

/** A terrain's colours in the palette in use. */
export function terrainTone(group: TerrainGroup | null) {
  return toneIn(colors, group);
}

/**
 * A terrain's colours for a park marker on a map: always the daytime ones,
 * so the markers stand out from the land in the dark palettes as they do
 * in light mode.
 */
export function markerTone(group: TerrainGroup | null) {
  return toneIn(DAY, group);
}

/** Human label for a terrain family, matching the quiz's wording. */
export const TERRAIN_LABEL: Record<TerrainGroup, string> = {
  mountain: 'Mountains',
  canyon: 'Canyons & rock',
  desert: 'Desert',
  forest: 'Forest',
  coast: 'Coast & islands',
  water: 'Lakes & wetland',
  dunes: 'Dunes',
  caves: 'Caves',
  badlands: 'Badlands',
};

export function TerrainIcon({
  group,
  size = 28,
  color,
}: {
  group: TerrainGroup;
  size?: number;
  color?: string;
}) {
  const paths = PATHS[group] ?? PATHS.mountain;
  const stroke = color ?? terrainTone(group).ink;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {paths.map((d) => (
        <Path
          key={d}
          d={d}
          stroke={stroke}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
