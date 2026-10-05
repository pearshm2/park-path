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
import { colors } from '../theme';

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

/** Band fill behind the glyph, and the glyph's own colour. */
const TONES: Record<TerrainGroup, { band: string; ink: string }> = {
  mountain: { band: colors.accent2Ramp[300], ink: colors.accent2Ramp[800] },
  canyon: { band: colors.accentRamp[300], ink: colors.accentRamp[800] },
  desert: { band: colors.accentRamp[200], ink: colors.accentRamp[800] },
  forest: { band: colors.accent2Ramp[400], ink: colors.accent2Ramp[900] },
  coast: { band: colors.accent2Ramp[200], ink: colors.accent2Ramp[800] },
  water: { band: colors.accent2Ramp[100], ink: colors.accent2Ramp[700] },
  dunes: { band: colors.accentRamp[100], ink: colors.accentRamp[700] },
  caves: { band: colors.neutral[300], ink: colors.neutral[800] },
  badlands: { band: colors.neutral[200], ink: colors.neutral[700] },
};

export function terrainTone(group: TerrainGroup) {
  return TONES[group] ?? { band: colors.neutral[200], ink: colors.neutral[800] };
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
