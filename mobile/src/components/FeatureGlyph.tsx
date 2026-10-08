/**
 * A glyph for each national park's signature feature: Old Faithful's
 * geyser for Yellowstone, a stone arch for Arches, a giant conifer for
 * Redwood. The map draws these on the 62-park view once it is zoomed in
 * far enough for them to read (see ParkMap).
 *
 * Drawn on the same 24-unit grid and stroke weight as TerrainIcon, so the
 * two sets sit together. Terrain has nine families; this is finer, which
 * is the point: seventeen parks share "mountain" but not a feature.
 *
 * Sized to be dropped straight into another <Svg> as a group, because the
 * map is one Svg and nested Svg elements don't hit-test reliably.
 */

import { G, Path } from 'react-native-svg';

export type Feature =
  | 'arch'
  | 'cactus'
  | 'canyon'
  | 'cave'
  | 'cliffHouse'
  | 'conifer'
  | 'dome'
  | 'dunes'
  | 'gatewayArch'
  | 'geyser'
  | 'glacier'
  | 'lake'
  | 'lighthouse'
  | 'mesa'
  | 'reef'
  | 'ridges'
  | 'saltFlat'
  | 'snowPeak'
  | 'spires'
  | 'volcano'
  | 'wetland';

const WAVE = 'M2 20c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0';

const PATHS: Record<Feature, string[]> = {
  // A stone bridge over open sky.
  arch: ['M2 20h20', 'M4 20V9h16v11', 'M8 20v-5a4 4 0 018 0v5'],
  // A saguaro.
  cactus: ['M10 21V5a2 2 0 014 0v16', 'M10 13H7a2 2 0 01-2-2V8', 'M14 11h3a2 2 0 002-2V6', 'M6 21h12'],
  // Two walls dropping to a river.
  canyon: ['M2 5h5l2 15', 'M22 5h-5l-2 15', 'M9 20h6'],
  // A cave mouth with stalactites.
  cave: ['M3 20v-8a9 9 0 0118 0v8', 'M8 9l1 3 1-3', 'M14 9l1 3 1-3'],
  // Dwellings tucked under an overhang.
  cliffHouse: ['M2 5h20', 'M4 5c0 5 16 5 16 0', 'M6 20v-5h5v5', 'M13 20v-4h5v4', 'M2 20h20'],
  // A tall tiered conifer.
  conifer: ['M12 2l4 6h-2l4 6h-3l3 6H6l3-6H6l4-6H8z', 'M12 20v2'],
  // Half Dome: a rounded back and a sheer face.
  dome: ['M3 20v-7c0-5 4-9 9-9 3 0 5 1 6 3v13', 'M2 20h20'],
  dunes: ['M2 18c4-6 8-6 11 0', 'M10 18c3-4 6-4 10 0', 'M2 21h20'],
  // St. Louis's Gateway Arch.
  gatewayArch: ['M4 21C4 9 8 3 12 3s8 6 8 18', 'M8 21c0-9 2-13 4-13s4 4 4 13'],
  // A spout from a mound, steam curling off it.
  geyser: ['M4 20h16', 'M7 20c0-3 2-4 5-4s5 1 5 4', 'M12 16V7', 'M12 9c-2-1-3-3-2-6', 'M12 9c2-1 3-3 2-6'],
  // Tidewater ice meeting the sea.
  glacier: ['M3 15V8l4-3 4 3 4-2 6 3v6', 'M3 15h18', WAVE],
  // A canoe on still water.
  lake: ['M3 12h18l-3 4H6z', 'M12 12V4l5 6', WAVE],
  lighthouse: ['M10 21l1-14h2l1 14', 'M9 7h6', 'M10 4h4v3h-4z', 'M3 21h18', 'M16 5h3', 'M5 5h3'],
  // A flat-topped butte in layers.
  mesa: ['M2 20h20', 'M4 20l2-7h12l2 7', 'M8 13l1-4h6l1 4'],
  // A reef fish.
  reef: ['M3 12c3-4 9-5 13 0-4 5-10 4-13 0z', 'M16 12l5-4v8z', 'M7 11h.01'],
  // Layered ridgelines fading into haze.
  ridges: ['M2 15l5-5 4 3 5-6 6 6', 'M2 20l6-4 5 2 4-3 5 3'],
  // Sun over a cracked salt pan.
  saltFlat: ['M12 3a3 3 0 100 6 3 3 0 000-6z', 'M2 14h20', 'M4 18h4', 'M11 18h4', 'M18 18h2'],
  // A peak with a snowcap.
  snowPeak: ['M2 20l7-13 5 8 2-3 6 8z', 'M6.5 11.5l2.5 1 2-1.5'],
  // Hoodoos and pinnacles.
  spires: ['M2 20h20', 'M5 20v-8l1.5-3L8 12v8', 'M11 20V8l1.5-3L14 8v12', 'M17 20v-6l1.5-2.5L20 14v6'],
  // A cone with a plume.
  volcano: ['M2 20l7-11h6l7 11z', 'M10 6c0-2 2-2 2-4', 'M14 6c0-2-1-3 0-4'],
  // Reeds over water.
  wetland: [WAVE, 'M7 17V8', 'M12 17V5', 'M17 17V9', 'M7 8c-2 0-3 1-3 3', 'M17 9c2 0 3 1 3 3'],
};

/**
 * Each national park's feature, by NPS park code. Old fixture codes are
 * listed too (haup, sequ, kica) so this works before and after the app
 * moves to the API's codes (havo, seki).
 */
const FEATURE_BY_PARK: Record<string, Feature> = {
  acad: 'lighthouse',
  arch: 'arch',
  badl: 'spires',
  bibe: 'canyon',
  bisc: 'reef',
  blca: 'canyon',
  brca: 'spires',
  cany: 'mesa',
  care: 'mesa',
  cave: 'cave',
  chis: 'lighthouse',
  cong: 'wetland',
  crla: 'lake',
  cuva: 'ridges',
  dena: 'snowPeak',
  deva: 'saltFlat',
  drto: 'reef',
  ever: 'wetland',
  gaar: 'snowPeak',
  glac: 'snowPeak',
  glba: 'glacier',
  grba: 'conifer',
  grca: 'canyon',
  grsa: 'dunes',
  grsm: 'ridges',
  grte: 'snowPeak',
  gumo: 'mesa',
  hale: 'volcano',
  haup: 'volcano',
  havo: 'volcano',
  hosp: 'geyser',
  indu: 'dunes',
  isro: 'lake',
  jeff: 'gatewayArch',
  jotr: 'cactus',
  katm: 'reef',
  kefj: 'glacier',
  kica: 'conifer',
  kova: 'dunes',
  lacl: 'lake',
  lavo: 'geyser',
  maca: 'cave',
  meve: 'cliffHouse',
  mora: 'volcano',
  neri: 'canyon',
  noca: 'snowPeak',
  npsa: 'reef',
  olym: 'conifer',
  pefo: 'mesa',
  pinn: 'spires',
  redw: 'conifer',
  romo: 'snowPeak',
  sagu: 'cactus',
  seki: 'conifer',
  sequ: 'conifer',
  shen: 'ridges',
  thro: 'spires',
  viis: 'reef',
  voya: 'lake',
  whsa: 'dunes',
  wica: 'cave',
  wrst: 'snowPeak',
  yell: 'geyser',
  yose: 'dome',
  zion: 'canyon',
};

export function featureForPark(parkId: string): Feature | undefined {
  return FEATURE_BY_PARK[parkId];
}

/** Stroke weight in grid units, matching TerrainIcon. */
const STROKE = 2.75;

/**
 * The glyph as an Svg group, centred on (cx, cy) and `size` points wide.
 * The stroke scales with it, as TerrainIcon's does.
 */
export function FeatureGlyph({
  feature,
  cx,
  cy,
  size,
  color,
}: {
  feature: Feature;
  cx: number;
  cy: number;
  size: number;
  color: string;
}) {
  const k = size / 24;
  return (
    <G transform={`translate(${cx - size / 2} ${cy - size / 2}) scale(${k})`}>
      {PATHS[feature].map((d) => (
        <Path
          key={d}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </G>
  );
}
