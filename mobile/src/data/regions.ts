/**
 * The ten map regions from the Explore mockup, and which states fall in
 * each. States are keyed by the FIPS id that src/data/usStates.ts uses.
 *
 * The fills are pastel tints picked from the mockup. The Organic tokens
 * have no categorical palette, so they live here rather than in the
 * theme; they only ever sit behind the pins, never behind text.
 */

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
  /** FIPS state ids. */
  states: string[];
};

export const REGIONS: Region[] = [
  { id: 'pnw', label: 'Pacific Northwest', fill: '#c8dcc0', states: ['53', '41', '16'] },
  { id: 'california', label: 'California & Sierra', fill: '#dbe6b9', states: ['06', '32'] },
  { id: 'southwest', label: 'Southwest desert', fill: '#f0c39c', states: ['04', '35', '49'] },
  { id: 'rockies', label: 'Rocky Mountains', fill: '#d9c0a2', states: ['30', '56', '08'] },
  {
    id: 'plains',
    label: 'Great Plains',
    fill: '#ebe2a9',
    states: ['38', '46', '31', '20', '40', '48'],
  },
  {
    id: 'midwest',
    label: 'Great Lakes & Midwest',
    fill: '#b6c6a3',
    states: ['27', '55', '26', '19', '17', '18', '39', '29'],
  },
  {
    id: 'northeast',
    label: 'Northeast',
    fill: '#f2c3be',
    states: ['23', '33', '50', '25', '44', '09', '36', '34', '42'],
  },
  {
    id: 'appalachia',
    label: 'Appalachia & Mid-Atlantic',
    fill: '#cdc8a0',
    states: ['54', '51', '21', '47', '37', '24', '10', '11'],
  },
  {
    id: 'gulf',
    label: 'Gulf & Deep South',
    fill: '#f2d19c',
    states: ['05', '22', '28', '01', '13', '12', '45'],
  },
  { id: 'akhi', label: 'Alaska & Hawaii', fill: '#e6c7bc', states: ['02', '15'] },
];

/** State FIPS id -> region, for coloring the outlines. */
export const STATE_REGION: Record<string, Region> = Object.fromEntries(
  REGIONS.flatMap((region) => region.states.map((state) => [state, region])),
);
