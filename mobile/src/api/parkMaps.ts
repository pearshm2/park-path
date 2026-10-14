/**
 * A national park's official NPS brochure maps, from GET /sites/{code}/map
 * (the backend copies them from the NPS map collection; see
 * api/app/brochure_maps.py), with where each visitor center is labelled
 * on them.
 *
 * The endpoint also returns the park's trails, roads and boundary. Only the
 * trails' names are used, as suggestions for a trip's location stamp.
 */

import { API_BASE_URL, ApiError, request } from './client';

/** Where a label is printed on a brochure map, in the image's pixels. */
export type MapLabel = { name: string; x: number; y: number; width: number; height: number };

/** One of the park's official NPS brochure maps, as an image. */
export type BrochureMap = {
  title: string;
  uri: string;
  width: number;
  height: number;
  /** The visitor centers labelled on this map. */
  visitorCenters: MapLabel[];
};

export type ParkMap = {
  /** Main map first; parks in separate units have one per unit. */
  brochures: BrochureMap[];
  /** The park's maps page on nps.gov. */
  officialMapUrl: string;
  /** Its named trails, A to Z. */
  trailNames: string[];
};

type ParkMapOut = {
  brochures: {
    title: string;
    url: string;
    width: number;
    height: number;
    visitor_centers: MapLabel[];
  }[];
  trails: { name: string | null }[];
  official_map_url: string;
};

/** The park's maps, or null if there aren't any (not synced, or no NPS data). */
export async function fetchParkMap(siteId: string): Promise<ParkMap | null> {
  try {
    const raw = await request<ParkMapOut>(`/sites/${encodeURIComponent(siteId)}/map`);
    return {
      brochures: raw.brochures.map(({ url, visitor_centers, ...brochure }) => ({
        ...brochure,
        uri: `${API_BASE_URL}${url}`,
        visitorCenters: visitor_centers,
      })),
      officialMapUrl: raw.official_map_url,
      trailNames: [...new Set(raw.trails.flatMap((t) => (t.name ? [t.name] : [])))].sort(),
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** The official maps page, for parks with no maps of our own. */
export function officialMapUrl(siteId: string): string {
  return `https://www.nps.gov/${siteId}/planyourvisit/maps.htm`;
}
