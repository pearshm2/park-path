/**
 * Park data access, from the API's GET /sites.
 *
 * The API's field names are mapped onto the app's Site shape here, so
 * nothing above this file knows or cares what the backend calls things.
 *
 * Scoring/ranking deliberately does NOT live here — see
 * src/api/provisionalMatches.ts and the banner at the top of it.
 */

import { geoContains, type GeoPermissibleObjects } from 'd3-geo';

import type { EffortLevel, Season, Site, SiteStatus, TerrainGroup } from '../data/parks';
import { STATE_FIPS } from '../data/regions';
import { US_STATES } from '../data/usStates';
import { request } from './client';

export type SiteScope = 'parks' | 'all';

/** One site as GET /sites returns it (api/app/schemas.py, SiteOut). */
type SiteOut = {
  park_code: string;
  name: string;
  designation: string | null;
  states: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  nps_url: string | null;
  image_url: string | null;
  is_named_park: boolean;
  terrain_group: string | null;
  feature: string | null;
  effort: number | null;
  typical_days: number | null;
  seasons: string[] | null;
  permit_required: boolean | null;
  annual_visits_millions: number | null;
};

/**
 * PLACEHOLDER: visited and wishlist are per-person, and the API has no
 * table for them yet. These are the statuses the old bundled fixtures
 * carried, kept so the map key and the wishlist view still have something
 * to show. Delete once GET /me/sites (or similar) exists.
 */
const DEMO_STATUS: Record<string, SiteStatus> = {
  grca: 'visited',
  romo: 'visited',
  yose: 'visited',
  zion: 'wishlist',
  yell: 'wishlist',
  olym: 'wishlist',
};

/** NPS writes some names in title case all the way: "Gates Of The Arctic". */
const SMALL_WORDS = /(?<=\s)(Of|The|And|In|On|At|To|For)(?=\s)/g;

/**
 * "Zion National Park" -> "Zion", since the card shows the designation
 * anyway. Parkways keep theirs: "Blue Ridge Parkway" is the road's name.
 */
function shortName(name: string, designation: string | null): string {
  const tidy = name.replace(SMALL_WORDS, (word) => word.toLowerCase());
  if (!designation || designation === 'Parkway') return tidy;
  const suffix = ` ${designation}`;
  return tidy.toLowerCase().endsWith(suffix.toLowerCase()) && tidy.length > suffix.length
    ? tidy.slice(0, -suffix.length)
    : tidy;
}

const STATE_SHAPES = new Map(US_STATES.map((shape) => [shape.id, shape]));

/**
 * NPS lists a site's states alphabetically, but the app files a site
 * under the region of its first state, which would put Yellowstone
 * ("ID,MT,WY") in the Pacific Northwest. So the state its coordinates
 * fall in goes first.
 */
function orderStates(codes: string[], lon: number, lat: number): string[] {
  const home = codes.find((code) => {
    const shape = STATE_SHAPES.get(STATE_FIPS[code]);
    return shape !== undefined && geoContains(shape as GeoPermissibleObjects, [lon, lat]);
  });
  return home ? [home, ...codes.filter((code) => code !== home)] : codes;
}

function toSite(raw: SiteOut): Site | null {
  // A site with no coordinates can't go on the map. None do today, but
  // the columns are nullable.
  if (raw.latitude === null || raw.longitude === null) return null;

  return {
    id: raw.park_code,
    name: shortName(raw.name, raw.designation),
    kind: raw.designation ?? (raw.is_named_park ? 'National Park' : 'NPS site'),
    state: orderStates(
      (raw.states ?? '').split(',').filter(Boolean),
      raw.longitude,
      raw.latitude,
    ).join(' / '),
    lat: raw.latitude,
    lon: raw.longitude,
    isNamedPark: raw.is_named_park,
    vis: raw.annual_visits_millions,
    group: raw.terrain_group as TerrainGroup | null,
    feature: raw.feature,
    effort: raw.effort as EffortLevel | null,
    days: raw.typical_days,
    seasons: (raw.seasons ?? []) as Season[],
    permit: raw.permit_required,
    status: DEMO_STATUS[raw.park_code] ?? 'new',
    description: raw.description,
    imageUrl: raw.image_url,
    npsUrl: raw.nps_url,
  };
}

/**
 * Every site is fetched once and shared: the parks are a subset, and
 * several screens ask for both. A failed fetch is forgotten so the next
 * call retries.
 */
let allSites: Promise<Site[]> | null = null;

function fetchAllSites(): Promise<Site[]> {
  allSites ??= request<SiteOut[]>('/sites?scope=all')
    .then((rows) => rows.flatMap((row) => toSite(row) ?? []))
    .catch((error: unknown) => {
      allSites = null;
      throw error;
    });
  return allSites;
}

/** All sites, or just the 63 national parks. */
export async function listSites(scope: SiteScope = 'parks'): Promise<Site[]> {
  const sites = await fetchAllSites();
  return scope === 'parks' ? sites.filter((site) => site.isNamedPark) : sites;
}
