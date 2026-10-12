/**
 * A national park's own map — boundary, roads and trails — from
 * GET /sites/{code}/map, which the backend fills from the NPS's public GIS
 * data (api/app/park_map_sync.py). Coordinates are [longitude, latitude].
 */

import { ApiError, request } from './client';

/** A line or ring: [longitude, latitude] points. */
export type MapPath = [number, number][];

export type TrailUse = 'hike' | 'horse' | 'bike' | 'motorized';

export type Trail = {
  /** null for unnamed connectors, which are drawn but not listed. */
  name: string | null;
  uses: TrailUse[];
  surface: string | null;
  /** Temporarily closed. */
  closed: boolean;
  lengthMiles: number;
  paths: MapPath[];
};

export type Road = {
  name: string | null;
  kind: 'primary' | 'secondary' | 'local' | '4wd';
  paths: MapPath[];
};

export type ParkMap = {
  /** Rings, drawn with the even-odd fill rule. */
  boundary: MapPath[];
  roads: Road[];
  trails: Trail[];
  /** The park's maps page on nps.gov, with the official brochure map. */
  officialMapUrl: string;
};

type TrailOut = Omit<Trail, 'lengthMiles'> & { length_miles: number };
type ParkMapOut = {
  boundary: MapPath[];
  roads: Road[];
  trails: TrailOut[];
  official_map_url: string;
};

/** The park's map, or null if there isn't one (not synced, or no NPS data). */
export async function fetchParkMap(siteId: string): Promise<ParkMap | null> {
  try {
    const raw = await request<ParkMapOut>(`/sites/${encodeURIComponent(siteId)}/map`);
    return {
      boundary: raw.boundary,
      roads: raw.roads,
      trails: raw.trails.map(({ length_miles, ...trail }) => ({ ...trail, lengthMiles: length_miles })),
      officialMapUrl: raw.official_map_url,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** The official maps page, for parks with no map data of our own. */
export function officialMapUrl(siteId: string): string {
  return `https://www.nps.gov/${siteId}/planyourvisit/maps.htm`;
}
