/**
 * The shape of a park site as the app uses it.
 *
 * The data itself comes from the API's GET /sites (see src/api/parks.ts,
 * which maps the API's fields onto these). This file used to hold 120
 * bundled fixtures; their hand-entered terrain, effort, seasons and so
 * on now live in api/data/curated_sites.json.
 *
 * Curated fields are null for sites nobody has filled in yet (most of the
 * ~470 non-park units), so anything reading them must cope with null.
 */

export type TerrainGroup = "badlands" | "canyon" | "caves" | "coast" | "desert" | "dunes" | "forest" | "mountain" | "water";
export type Season = "winter" | "spring" | "summer" | "fall";
export type SiteStatus = "new" | "visited" | "wishlist";

/** 1 = easy walks, 2 = half-day hikes, 3 = all-day strenuous. */
export type EffortLevel = 1 | 2 | 3;

export type Site = {
  /** NPS park code, e.g. "zion". */
  id: string;
  /** Without the designation: "Zion", not "Zion National Park". */
  name: string;
  /** e.g. "National Park", "National Seashore" */
  kind: string;
  /** Display string, may list several: "TN / NC" */
  state: string;
  lat: number;
  lon: number;
  /** One of the 63 national parks, whatever NPS calls it. */
  isNamedPark: boolean;
  /** Recent annual recreation visits, in millions. */
  vis: number | null;
  group: TerrainGroup | null;
  /** Short terrain descriptor, e.g. "Slot canyon" */
  feature: string | null;
  effort: EffortLevel | null;
  /** Typical trip length in days. */
  days: number | null;
  /** Empty when unknown. */
  seasons: Season[];
  permit: boolean | null;
  status: SiteStatus;
  /** NPS's own description, a paragraph long. */
  description: string | null;
  imageUrl: string | null;
  npsUrl: string | null;
};
