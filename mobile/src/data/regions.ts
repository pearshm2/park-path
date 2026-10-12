/**
 * The ten map regions from the Explore mockup, and which states fall in
 * each. States are keyed by the FIPS id that src/data/usStates.ts uses.
 *
 * The fills are pastel tints picked from the mockup. The Organic tokens
 * have no categorical palette, so they live here rather than in the
 * theme; they only ever sit behind the pins, never behind text.
 *
 * Each region also has a deeper, richer shade of its tint, which the map
 * fills it with (inside a gold edge) once every national park in it is
 * visited.
 */

import type { Site } from './parks';

export type RegionId =
  | 'pnw'
  | 'california'
  | 'southwest'
  | 'rockies'
  | 'plains'
  | 'midwest'
  | 'northeast'
  | 'appalachia'
  | 'gulf'
  | 'akhi';

export type Region = {
  id: RegionId;
  label: string;
  fill: string;
  /** The region's fill once you've visited all its national parks. */
  earned: string;
  /** FIPS state ids. */
  states: string[];
};

export const REGIONS: Region[] = [
  { id: 'pnw', label: 'Pacific Northwest', fill: '#c8dcc0', earned: '#7fae6e', states: ['53', '41', '16'] },
  { id: 'california', label: 'California & Sierra', fill: '#dbe6b9', earned: '#a9c35a', states: ['06', '32'] },
  { id: 'southwest', label: 'Southwest desert', fill: '#f0c39c', earned: '#e08a4a', states: ['04', '35', '49'] },
  { id: 'rockies', label: 'Rocky Mountains', fill: '#d9c0a2', earned: '#b98a55', states: ['30', '56', '08'] },
  {
    id: 'plains',
    label: 'Great Plains',
    fill: '#ebe2a9', earned: '#d9c64a',
    states: ['38', '46', '31', '20', '40', '48'],
  },
  {
    id: 'midwest',
    label: 'Great Lakes & Midwest',
    fill: '#b6c6a3', earned: '#7d9a5c',
    states: ['27', '55', '26', '19', '17', '18', '39', '29'],
  },
  {
    id: 'northeast',
    label: 'Northeast',
    fill: '#f2c3be', earned: '#e07f75',
    states: ['23', '33', '50', '25', '44', '09', '36', '34', '42'],
  },
  {
    id: 'appalachia',
    label: 'Appalachia & Mid-Atlantic',
    fill: '#cdc8a0', earned: '#a59d55',
    states: ['54', '51', '21', '47', '37', '24', '10', '11'],
  },
  {
    id: 'gulf',
    label: 'Gulf & Deep South',
    fill: '#f2d19c', earned: '#e6ad45',
    states: ['05', '22', '28', '01', '13', '12', '45'],
  },
  { id: 'akhi', label: 'Alaska & Hawaii', fill: '#e6c7bc', earned: '#cc8f7a', states: ['02', '15'] },
];

/** State FIPS id -> region, for coloring the outlines. */
export const STATE_REGION: Record<string, Region> = Object.fromEntries(
  REGIONS.flatMap((region) => region.states.map((state) => [state, region])),
);

/** Postal code -> FIPS id, for the codes that appear in site.state. */
export const STATE_FIPS: Record<string, string> = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09', DE: '10',
  DC: '11', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17', IN: '18', IA: '19',
  KS: '20', KY: '21', LA: '22', ME: '23', MD: '24', MA: '25', MI: '26', MN: '27',
  MS: '28', MO: '29', MT: '30', NE: '31', NV: '32', NH: '33', NJ: '34', NM: '35',
  NY: '36', NC: '37', ND: '38', OH: '39', OK: '40', OR: '41', PA: '42', RI: '44',
  SC: '45', SD: '46', TN: '47', TX: '48', UT: '49', VT: '50', VA: '51', WA: '53',
  WV: '54', WI: '55', WY: '56',
};

/**
 * The region a site sits in, from the first state it lists — "WY / MT / ID"
 * counts as Wyoming. Territories have no region and return undefined.
 */
export function regionForState(state: string): Region | undefined {
  const first = state.split('/')[0].trim();
  const fips = STATE_FIPS[first];
  return fips ? STATE_REGION[fips] : undefined;
}

/**
 * The regions where you've visited every site passed in, for marking them
 * on the map. Pass what the map is counting: the national parks on the
 * parks map, every site on the all-sites map.
 */
export function completedRegions(parks: Site[]): Set<RegionId> {
  const done = new Set<RegionId>();
  const missing = new Set<RegionId>();
  for (const park of parks) {
    const region = regionForState(park.state)?.id;
    if (!region) continue;
    if (park.status === 'visited') done.add(region);
    else missing.add(region);
  }
  for (const region of missing) done.delete(region);
  return done;
}
