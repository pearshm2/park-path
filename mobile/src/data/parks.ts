/**
 * Park site fixtures, ported from the design prototype's
 * parkpath-data.js. 120 sites: all 63 named national parks plus
 * other NPS units, with real coordinates and visitation.
 *
 * GENERATED — do not hand-edit. These stand in for the /parks endpoint
 * until the backend grows one; src/api/parks.ts reads from here so the
 * swap to a real fetch is a one-file change.
 *
 * Visitation and coordinates came from the prototype and are approximate —
 * check against NPS figures before relying on them.
 */

export type TerrainGroup = "badlands" | "canyon" | "caves" | "coast" | "desert" | "dunes" | "forest" | "mountain" | "water";
export type Season = "winter" | "spring" | "summer" | "fall";
export type SiteStatus = "new" | "visited" | "wishlist";

/** 1 = easy walks, 2 = half-day hikes, 3 = all-day strenuous. */
export type EffortLevel = 1 | 2 | 3;

export type Site = {
  id: string;
  name: string;
  /** e.g. "National Park", "National Seashore" */
  kind: string;
  /** Display string, may list several: "TN / NC" */
  state: string;
  lat: number;
  lon: number;
  /** Recent annual recreation visits, in millions. */
  vis: number;
  group: TerrainGroup;
  /** Short terrain descriptor, e.g. "Slot canyon" */
  feature: string;
  effort: EffortLevel;
  /** Typical trip length in days. */
  days: number;
  seasons: Season[];
  permit: boolean;
  status: SiteStatus;
  blurb: string;
};

export const SITE_KINDS = ["National Battlefield","National Historical Park","National Lakeshore","National Military Park","National Monument","National Park","National Parkway","National Preserve","National Recreation Area","National Seashore"] as const;

export const SITES: Site[] = [
  {
    "id": "grsm",
    "name": "Great Smoky Mountains",
    "kind": "National Park",
    "state": "TN / NC",
    "lat": 35.61,
    "lon": -83.49,
    "vis": 13.3,
    "group": "mountain",
    "feature": "Ridge forest",
    "effort": 2,
    "days": 3,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "The most visited park in the system. Layered ridgelines, wildflowers in April, fog most mornings."
  },
  {
    "id": "zion",
    "name": "Zion",
    "kind": "National Park",
    "state": "UT",
    "lat": 37.3,
    "lon": -113.03,
    "vis": 4.6,
    "group": "canyon",
    "feature": "Slot canyon",
    "effort": 3,
    "days": 3,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": true,
    "status": "wishlist",
    "blurb": "A river cut a narrow corridor through sandstone. Shuttle-only in the main canyon, permits for the Narrows."
  },
  {
    "id": "grca",
    "name": "Grand Canyon",
    "kind": "National Park",
    "state": "AZ",
    "lat": 36.1,
    "lon": -112.11,
    "vis": 4.7,
    "group": "canyon",
    "feature": "Rim and inner gorge",
    "effort": 3,
    "days": 4,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": true,
    "status": "visited",
    "blurb": "A mile deep and eighteen wide. Rim walks are easy; anything below the rim is a serious day."
  },
  {
    "id": "yell",
    "name": "Yellowstone",
    "kind": "National Park",
    "state": "WY / MT / ID",
    "lat": 44.6,
    "lon": -110.5,
    "vis": 4.5,
    "group": "mountain",
    "feature": "Geothermal basin",
    "effort": 2,
    "days": 5,
    "seasons": [
      "summer",
      "fall"
    ],
    "permit": false,
    "status": "wishlist",
    "blurb": "Half the world’s geysers sit on a caldera. Long drives between basins, wildlife at dawn."
  },
  {
    "id": "romo",
    "name": "Rocky Mountain",
    "kind": "National Park",
    "state": "CO",
    "lat": 40.34,
    "lon": -105.68,
    "vis": 4.1,
    "group": "mountain",
    "feature": "Alpine tundra",
    "effort": 3,
    "days": 3,
    "seasons": [
      "summer",
      "fall"
    ],
    "permit": true,
    "status": "visited",
    "blurb": "Sixty peaks over 12,000 feet, ninety minutes from Denver. Timed entry through the summer."
  },
  {
    "id": "acad",
    "name": "Acadia",
    "kind": "National Park",
    "state": "ME",
    "lat": 44.35,
    "lon": -68.21,
    "vis": 3.9,
    "group": "coast",
    "feature": "Granite coast",
    "effort": 2,
    "days": 3,
    "seasons": [
      "summer",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Where the mountains meet the Atlantic. Carriage roads for easy miles, cold water, early sunrise."
  },
  {
    "id": "yose",
    "name": "Yosemite",
    "kind": "National Park",
    "state": "CA",
    "lat": 37.85,
    "lon": -119.57,
    "vis": 3.9,
    "group": "mountain",
    "feature": "Granite valley",
    "effort": 3,
    "days": 4,
    "seasons": [
      "spring",
      "summer"
    ],
    "permit": true,
    "status": "visited",
    "blurb": "Waterfalls peak in May. The valley floor is crowded; the high country empties out by comparison."
  },
  {
    "id": "grte",
    "name": "Grand Teton",
    "kind": "National Park",
    "state": "WY",
    "lat": 43.79,
    "lon": -110.68,
    "vis": 3.4,
    "group": "mountain",
    "feature": "Glacial range",
    "effort": 3,
    "days": 3,
    "seasons": [
      "summer",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "A range with no foothills, rising straight out of the sage flats. Lake loops for gentler days."
  },
  {
    "id": "jotr",
    "name": "Joshua Tree",
    "kind": "National Park",
    "state": "CA",
    "lat": 33.87,
    "lon": -115.9,
    "vis": 3.3,
    "group": "desert",
    "feature": "High desert",
    "effort": 1,
    "days": 2,
    "seasons": [
      "winter",
      "spring"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Two deserts meet here. Boulder fields, short scrambles, and the darkest skies within reach of LA."
  },
  {
    "id": "cuva",
    "name": "Cuyahoga Valley",
    "kind": "National Park",
    "state": "OH",
    "lat": 41.26,
    "lon": -81.57,
    "vis": 2.9,
    "group": "forest",
    "feature": "River valley",
    "effort": 1,
    "days": 1,
    "seasons": [
      "spring",
      "summer",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "A towpath trail along a restored canal, threaded between two cities. Easy, and rarely on anyone’s list."
  },
  {
    "id": "indu",
    "name": "Indiana Dunes",
    "kind": "National Park",
    "state": "IN",
    "lat": 41.65,
    "lon": -87.05,
    "vis": 2.8,
    "group": "coast",
    "feature": "Lake dunes",
    "effort": 1,
    "days": 1,
    "seasons": [
      "summer",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Fifteen miles of Lake Michigan shore, with dune ridges holding a surprising range of plant life."
  },
  {
    "id": "brca",
    "name": "Bryce Canyon",
    "kind": "National Park",
    "state": "UT",
    "lat": 37.59,
    "lon": -112.19,
    "vis": 2.5,
    "group": "canyon",
    "feature": "Hoodoo amphitheater",
    "effort": 2,
    "days": 2,
    "seasons": [
      "spring",
      "summer",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Not a canyon but a series of amphitheaters full of hoodoos. Sits at 8,000 feet, so summers stay mild."
  },
  {
    "id": "olym",
    "name": "Olympic",
    "kind": "National Park",
    "state": "WA",
    "lat": 47.8,
    "lon": -123.6,
    "vis": 2.9,
    "group": "forest",
    "feature": "Temperate rainforest",
    "effort": 2,
    "days": 4,
    "seasons": [
      "summer",
      "fall"
    ],
    "permit": false,
    "status": "wishlist",
    "blurb": "Three parks in one: coast, rainforest, and glaciated peaks, each a couple of hours from the others."
  },
  {
    "id": "glac",
    "name": "Glacier",
    "kind": "National Park",
    "state": "MT",
    "lat": 48.76,
    "lon": -113.79,
    "vis": 2.9,
    "group": "mountain",
    "feature": "Glacial valley",
    "effort": 3,
    "days": 4,
    "seasons": [
      "summer"
    ],
    "permit": true,
    "status": "new",
    "blurb": "Going-to-the-Sun Road opens late and closes early. Vehicle reservations in peak season."
  },
  {
    "id": "haup",
    "name": "Hawai‘i Volcanoes",
    "kind": "National Park",
    "state": "HI",
    "lat": 19.42,
    "lon": -155.29,
    "vis": 1.6,
    "group": "desert",
    "feature": "Active volcano",
    "effort": 2,
    "days": 3,
    "seasons": [
      "winter",
      "spring"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Lava fields you can walk across, a caldera that occasionally reactivates, and rainforest on the flank."
  },
  {
    "id": "mora",
    "name": "Mount Rainier",
    "kind": "National Park",
    "state": "WA",
    "lat": 46.85,
    "lon": -121.76,
    "vis": 1.6,
    "group": "mountain",
    "feature": "Volcano meadow",
    "effort": 3,
    "days": 3,
    "seasons": [
      "summer"
    ],
    "permit": true,
    "status": "new",
    "blurb": "One glaciated volcano with wildflower meadows around its base. Timed entry to Paradise in summer."
  },
  {
    "id": "shen",
    "name": "Shenandoah",
    "kind": "National Park",
    "state": "VA",
    "lat": 38.53,
    "lon": -78.35,
    "vis": 1.6,
    "group": "forest",
    "feature": "Blue Ridge",
    "effort": 2,
    "days": 2,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "A hundred miles of ridge road with overlooks, waterfall hollows below, and Washington two hours away."
  },
  {
    "id": "arch",
    "name": "Arches",
    "kind": "National Park",
    "state": "UT",
    "lat": 38.73,
    "lon": -109.59,
    "vis": 1.5,
    "group": "desert",
    "feature": "Sandstone arches",
    "effort": 2,
    "days": 2,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": true,
    "status": "new",
    "blurb": "Two thousand arches in a compact park. Timed entry April to October; go at first light."
  },
  {
    "id": "sequ",
    "name": "Sequoia",
    "kind": "National Park",
    "state": "CA",
    "lat": 36.49,
    "lon": -118.57,
    "vis": 1.2,
    "group": "forest",
    "feature": "Giant sequoia grove",
    "effort": 2,
    "days": 3,
    "seasons": [
      "summer",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "The largest trees on earth, in groves that stay cool in August. The road up is slow and steep."
  },
  {
    "id": "care",
    "name": "Capitol Reef",
    "kind": "National Park",
    "state": "UT",
    "lat": 38.37,
    "lon": -111.26,
    "vis": 1.2,
    "group": "canyon",
    "feature": "Monocline cliffs",
    "effort": 2,
    "days": 2,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "A hundred-mile fold in the crust, with a historic orchard at its center. No timed entry, no shuttle."
  },
  {
    "id": "deva",
    "name": "Death Valley",
    "kind": "National Park",
    "state": "CA / NV",
    "lat": 36.51,
    "lon": -117.08,
    "vis": 1.1,
    "group": "desert",
    "feature": "Salt basin",
    "effort": 2,
    "days": 3,
    "seasons": [
      "winter",
      "spring"
    ],
    "permit": false,
    "status": "new",
    "blurb": "The lowest, driest, hottest place in North America. A winter park, not a summer one."
  },
  {
    "id": "badl",
    "name": "Badlands",
    "kind": "National Park",
    "state": "SD",
    "lat": 43.85,
    "lon": -102.34,
    "vis": 1,
    "group": "badlands",
    "feature": "Eroded spires",
    "effort": 2,
    "days": 2,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Layered buttes above mixed-grass prairie. Off-trail hiking is allowed anywhere in the park."
  },
  {
    "id": "ever",
    "name": "Everglades",
    "kind": "National Park",
    "state": "FL",
    "lat": 25.29,
    "lon": -80.9,
    "vis": 0.8,
    "group": "water",
    "feature": "Sawgrass wetland",
    "effort": 1,
    "days": 2,
    "seasons": [
      "winter"
    ],
    "permit": false,
    "status": "new",
    "blurb": "A river sixty miles wide, moving inches an hour. Boardwalks and paddle trails; go in the dry season."
  },
  {
    "id": "cany",
    "name": "Canyonlands",
    "kind": "National Park",
    "state": "UT",
    "lat": 38.2,
    "lon": -109.93,
    "vis": 0.8,
    "group": "canyon",
    "feature": "Mesa and river",
    "effort": 3,
    "days": 3,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": true,
    "status": "new",
    "blurb": "Four districts split by two rivers, with no quick way between them. Backcountry permits for most of it."
  },
  {
    "id": "thro",
    "name": "Theodore Roosevelt",
    "kind": "National Park",
    "state": "ND",
    "lat": 46.98,
    "lon": -103.54,
    "vis": 0.7,
    "group": "badlands",
    "feature": "Prairie badlands",
    "effort": 2,
    "days": 2,
    "seasons": [
      "summer",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Bison on the road, painted canyon walls, and almost no one there. A scenic loop makes an easy day."
  },
  {
    "id": "wica",
    "name": "Wind Cave",
    "kind": "National Park",
    "state": "SD",
    "lat": 43.57,
    "lon": -103.48,
    "vis": 0.7,
    "group": "caves",
    "feature": "Boxwork cave",
    "effort": 1,
    "days": 1,
    "seasons": [
      "summer"
    ],
    "permit": false,
    "status": "new",
    "blurb": "One of the longest caves in the world, under prairie that carries its own bison herd."
  },
  {
    "id": "crla",
    "name": "Crater Lake",
    "kind": "National Park",
    "state": "OR",
    "lat": 42.94,
    "lon": -122.11,
    "vis": 0.6,
    "group": "mountain",
    "feature": "Caldera lake",
    "effort": 2,
    "days": 2,
    "seasons": [
      "summer"
    ],
    "permit": false,
    "status": "new",
    "blurb": "The deepest lake in the country, in a collapsed volcano. Snow closes the rim road most of the year."
  },
  {
    "id": "kica",
    "name": "Kings Canyon",
    "kind": "National Park",
    "state": "CA",
    "lat": 36.89,
    "lon": -118.55,
    "vis": 0.6,
    "group": "mountain",
    "feature": "Deep granite canyon",
    "effort": 3,
    "days": 3,
    "seasons": [
      "summer"
    ],
    "permit": true,
    "status": "new",
    "blurb": "A canyon deeper than the Grand, with a road that dead-ends at a trailhead into the high Sierra."
  },
  {
    "id": "meve",
    "name": "Mesa Verde",
    "kind": "National Park",
    "state": "CO",
    "lat": 37.23,
    "lon": -108.46,
    "vis": 0.5,
    "group": "canyon",
    "feature": "Cliff dwellings",
    "effort": 2,
    "days": 2,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": true,
    "status": "new",
    "blurb": "Six hundred cliff dwellings built into alcoves. Ticketed ranger tours for the major sites."
  },
  {
    "id": "bibe",
    "name": "Big Bend",
    "kind": "National Park",
    "state": "TX",
    "lat": 29.25,
    "lon": -103.25,
    "vis": 0.5,
    "group": "desert",
    "feature": "Desert river canyon",
    "effort": 3,
    "days": 4,
    "seasons": [
      "winter",
      "spring"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Chihuahuan desert, a mountain range, and the Rio Grande. Five hours from the nearest airport."
  },
  {
    "id": "grsa",
    "name": "Great Sand Dunes",
    "kind": "National Park",
    "state": "CO",
    "lat": 37.79,
    "lon": -105.59,
    "vis": 0.5,
    "group": "dunes",
    "feature": "Continental dunes",
    "effort": 2,
    "days": 1,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "The tallest dunes in North America against the Sangre de Cristos, with a seasonal creek at their base."
  },
  {
    "id": "pefo",
    "name": "Petrified Forest",
    "kind": "National Park",
    "state": "AZ",
    "lat": 34.91,
    "lon": -109.81,
    "vis": 0.5,
    "group": "desert",
    "feature": "Painted desert",
    "effort": 1,
    "days": 1,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Fossil logs turned to stone across banded badlands. A half-day drive with short walks off it."
  },
  {
    "id": "lavo",
    "name": "Lassen Volcanic",
    "kind": "National Park",
    "state": "CA",
    "lat": 40.49,
    "lon": -121.42,
    "vis": 0.4,
    "group": "mountain",
    "feature": "Hydrothermal peaks",
    "effort": 3,
    "days": 2,
    "seasons": [
      "summer"
    ],
    "permit": false,
    "status": "new",
    "blurb": "All four volcano types in one park, plus boiling ground, and a fraction of Yosemite’s crowds."
  },
  {
    "id": "dena",
    "name": "Denali",
    "kind": "National Park",
    "state": "AK",
    "lat": 63.33,
    "lon": -150.5,
    "vis": 0.4,
    "group": "mountain",
    "feature": "Subarctic range",
    "effort": 3,
    "days": 5,
    "seasons": [
      "summer"
    ],
    "permit": true,
    "status": "new",
    "blurb": "One road, mostly bus-only, into six million acres. Trailless hiking is the norm here."
  },
  {
    "id": "blca",
    "name": "Black Canyon of the Gunnison",
    "kind": "National Park",
    "state": "CO",
    "lat": 38.58,
    "lon": -107.74,
    "vis": 0.3,
    "group": "canyon",
    "feature": "Sheer gorge",
    "effort": 3,
    "days": 1,
    "seasons": [
      "summer",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Walls so steep and narrow that parts of the gorge get half an hour of sun a day."
  },
  {
    "id": "pinn",
    "name": "Pinnacles",
    "kind": "National Park",
    "state": "CA",
    "lat": 36.49,
    "lon": -121.16,
    "vis": 0.3,
    "group": "mountain",
    "feature": "Volcanic spires",
    "effort": 2,
    "days": 1,
    "seasons": [
      "winter",
      "spring"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Talus caves and condors, two hours from San Jose. Hot after May; a winter park in practice."
  },
  {
    "id": "cong",
    "name": "Congaree",
    "kind": "National Park",
    "state": "SC",
    "lat": 33.79,
    "lon": -80.78,
    "vis": 0.25,
    "group": "water",
    "feature": "Floodplain forest",
    "effort": 1,
    "days": 1,
    "seasons": [
      "winter",
      "spring"
    ],
    "permit": false,
    "status": "new",
    "blurb": "The largest old-growth bottomland hardwood forest left. A boardwalk loop, and paddling when it floods."
  },
  {
    "id": "voya",
    "name": "Voyageurs",
    "kind": "National Park",
    "state": "MN",
    "lat": 48.48,
    "lon": -92.83,
    "vis": 0.24,
    "group": "water",
    "feature": "Boundary lakes",
    "effort": 2,
    "days": 3,
    "seasons": [
      "summer"
    ],
    "permit": false,
    "status": "new",
    "blurb": "A park you travel by boat. Interconnected lakes on the Canadian border, aurora in the shoulder seasons."
  },
  {
    "id": "gumo",
    "name": "Guadalupe Mountains",
    "kind": "National Park",
    "state": "TX",
    "lat": 31.92,
    "lon": -104.87,
    "vis": 0.2,
    "group": "mountain",
    "feature": "Fossil reef",
    "effort": 3,
    "days": 2,
    "seasons": [
      "fall",
      "spring"
    ],
    "permit": false,
    "status": "new",
    "blurb": "An ancient reef pushed up into desert, holding a hidden maple canyon that turns in late October."
  },
  {
    "id": "grba",
    "name": "Great Basin",
    "kind": "National Park",
    "state": "NV",
    "lat": 38.98,
    "lon": -114.3,
    "vis": 0.14,
    "group": "mountain",
    "feature": "Bristlecone slopes",
    "effort": 3,
    "days": 2,
    "seasons": [
      "summer",
      "fall"
    ],
    "permit": true,
    "status": "new",
    "blurb": "Bristlecone pines, a marble cave, and a 13,000-foot peak, on a highway with almost no traffic."
  },
  {
    "id": "drto",
    "name": "Dry Tortugas",
    "kind": "National Park",
    "state": "FL",
    "lat": 24.63,
    "lon": -82.87,
    "vis": 0.08,
    "group": "coast",
    "feature": "Reef and fort",
    "effort": 1,
    "days": 2,
    "seasons": [
      "winter",
      "spring"
    ],
    "permit": true,
    "status": "new",
    "blurb": "Seventy miles past Key West by ferry or seaplane. A brick fort, clear water, and a hard cap on visitors."
  },
  {
    "id": "noca",
    "name": "North Cascades",
    "kind": "National Park",
    "state": "WA",
    "lat": 48.7,
    "lon": -121.2,
    "vis": 0.04,
    "group": "mountain",
    "feature": "Glaciated wilderness",
    "effort": 3,
    "days": 3,
    "seasons": [
      "summer"
    ],
    "permit": true,
    "status": "new",
    "blurb": "More glaciers than anywhere outside Alaska, three hours from Seattle, and virtually empty."
  },
  {
    "id": "katm",
    "name": "Katmai",
    "kind": "National Park",
    "state": "AK",
    "lat": 58.6,
    "lon": -155,
    "vis": 0.04,
    "group": "water",
    "feature": "Salmon river",
    "effort": 3,
    "days": 4,
    "seasons": [
      "summer"
    ],
    "permit": true,
    "status": "new",
    "blurb": "Brown bears fishing a falls, reachable only by float plane. Trip length is set by the weather."
  },
  {
    "id": "isro",
    "name": "Isle Royale",
    "kind": "National Park",
    "state": "MI",
    "lat": 48.1,
    "lon": -88.55,
    "vis": 0.03,
    "group": "water",
    "feature": "Island wilderness",
    "effort": 3,
    "days": 4,
    "seasons": [
      "summer"
    ],
    "permit": true,
    "status": "new",
    "blurb": "An island in Lake Superior with no roads and no cars. Closed entirely from November to April."
  },
  {
    "id": "crmo",
    "name": "Craters of the Moon",
    "kind": "National Monument",
    "state": "ID",
    "lat": 43.42,
    "lon": -113.52,
    "vis": 0.25,
    "group": "desert",
    "feature": "Lava field",
    "effort": 2,
    "days": 1,
    "seasons": [
      "spring",
      "summer"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Eight hundred square miles of basalt flows and cinder cones, with caves you can enter on a permit."
  },
  {
    "id": "band",
    "name": "Bandelier",
    "kind": "National Monument",
    "state": "NM",
    "lat": 35.78,
    "lon": -106.27,
    "vis": 0.19,
    "group": "canyon",
    "feature": "Ancestral cliff sites",
    "effort": 2,
    "days": 1,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Carved cavates and a canyon-floor pueblo, with ladders up to the alcoves. Shuttle in summer."
  },
  {
    "id": "nabr",
    "name": "Natural Bridges",
    "kind": "National Monument",
    "state": "UT",
    "lat": 37.6,
    "lon": -110.01,
    "vis": 0.09,
    "group": "canyon",
    "feature": "Stone bridges",
    "effort": 2,
    "days": 1,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Three large natural bridges over a canyon, and the first International Dark Sky Park."
  },
  {
    "id": "muwo",
    "name": "Muir Woods",
    "kind": "National Monument",
    "state": "CA",
    "lat": 37.9,
    "lon": -122.58,
    "vis": 0.9,
    "group": "forest",
    "feature": "Coast redwoods",
    "effort": 1,
    "days": 1,
    "seasons": [
      "spring",
      "summer",
      "fall"
    ],
    "permit": true,
    "status": "new",
    "blurb": "Old-growth redwoods thirty minutes from San Francisco. Parking and shuttle reservations required."
  },
  {
    "id": "redw",
    "name": "Redwood",
    "kind": "National Park",
    "state": "CA",
    "lat": 41.21,
    "lon": -124,
    "vis": 0.9,
    "group": "forest",
    "feature": "Tallest trees",
    "effort": 2,
    "days": 2,
    "seasons": [
      "summer",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "The tallest trees on earth in fog belt groves, with fifty miles of undeveloped coast alongside them."
  },
  {
    "id": "sagu",
    "name": "Saguaro",
    "kind": "National Park",
    "state": "AZ",
    "lat": 32.25,
    "lon": -110.5,
    "vis": 1,
    "group": "desert",
    "feature": "Cactus forest",
    "effort": 2,
    "days": 1,
    "seasons": [
      "winter",
      "spring"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Two districts flanking Tucson, both dense with giant saguaro. Hike early; the desert is unforgiving after ten."
  },
  {
    "id": "whsa",
    "name": "White Sands",
    "kind": "National Park",
    "state": "NM",
    "lat": 32.78,
    "lon": -106.17,
    "vis": 0.6,
    "group": "dunes",
    "feature": "Gypsum dunes",
    "effort": 1,
    "days": 1,
    "seasons": [
      "winter",
      "spring"
    ],
    "permit": false,
    "status": "new",
    "blurb": "The largest gypsum dunefield in the world, closed occasionally for missile tests next door."
  },
  {
    "id": "cave",
    "name": "Carlsbad Caverns",
    "kind": "National Park",
    "state": "NM",
    "lat": 32.17,
    "lon": -104.44,
    "vis": 0.4,
    "group": "caves",
    "feature": "Show cave",
    "effort": 2,
    "days": 1,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": true,
    "status": "new",
    "blurb": "A room the size of six football fields, reached on foot down the natural entrance. Timed tickets required."
  },
  {
    "id": "maca",
    "name": "Mammoth Cave",
    "kind": "National Park",
    "state": "KY",
    "lat": 37.19,
    "lon": -86.1,
    "vis": 0.65,
    "group": "caves",
    "feature": "Longest cave",
    "effort": 1,
    "days": 2,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": true,
    "status": "new",
    "blurb": "Four hundred mapped miles under Kentucky hardwood. Every route below ground is a ticketed ranger tour."
  },
  {
    "id": "neri",
    "name": "New River Gorge",
    "kind": "National Park",
    "state": "WV",
    "lat": 37.92,
    "lon": -81.06,
    "vis": 1.8,
    "group": "forest",
    "feature": "River gorge",
    "effort": 2,
    "days": 2,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "The newest named park: whitewater, sandstone climbing, and a bridge you can walk under on a catwalk."
  },
  {
    "id": "hosp",
    "name": "Hot Springs",
    "kind": "National Park",
    "state": "AR",
    "lat": 34.51,
    "lon": -93.05,
    "vis": 2.5,
    "group": "forest",
    "feature": "Thermal springs",
    "effort": 1,
    "days": 1,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "A park wrapped around a town. Historic bathhouses on one side, wooded ridge trails on the other."
  },
  {
    "id": "jeff",
    "name": "Gateway Arch",
    "kind": "National Park",
    "state": "MO",
    "lat": 38.62,
    "lon": -90.19,
    "vis": 2.9,
    "group": "water",
    "feature": "Urban riverfront",
    "effort": 1,
    "days": 1,
    "seasons": [
      "spring",
      "summer",
      "fall"
    ],
    "permit": true,
    "status": "new",
    "blurb": "The smallest park in the system: an arch, a museum, and the Mississippi. Tram tickets sell out."
  },
  {
    "id": "bisc",
    "name": "Biscayne",
    "kind": "National Park",
    "state": "FL",
    "lat": 25.48,
    "lon": -80.21,
    "vis": 0.5,
    "group": "water",
    "feature": "Coral reef bay",
    "effort": 1,
    "days": 1,
    "seasons": [
      "winter",
      "spring"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Ninety-five percent water. Snorkel or paddle; there is very little of it you can see from shore."
  },
  {
    "id": "chis",
    "name": "Channel Islands",
    "kind": "National Park",
    "state": "CA",
    "lat": 34.01,
    "lon": -119.42,
    "vis": 0.4,
    "group": "coast",
    "feature": "Island archipelago",
    "effort": 3,
    "days": 2,
    "seasons": [
      "spring",
      "summer"
    ],
    "permit": true,
    "status": "new",
    "blurb": "Five islands off Ventura, boat access only. No services on most of them, so you carry everything."
  },
  {
    "id": "hale",
    "name": "Haleakalā",
    "kind": "National Park",
    "state": "HI",
    "lat": 20.72,
    "lon": -156.17,
    "vis": 0.85,
    "group": "mountain",
    "feature": "Volcanic summit",
    "effort": 2,
    "days": 1,
    "seasons": [
      "winter",
      "spring"
    ],
    "permit": true,
    "status": "new",
    "blurb": "A ten-thousand-foot crater above the clouds. Sunrise entry needs a reservation booked days ahead."
  },
  {
    "id": "kefj",
    "name": "Kenai Fjords",
    "kind": "National Park",
    "state": "AK",
    "lat": 59.92,
    "lon": -149.65,
    "vis": 0.4,
    "group": "water",
    "feature": "Tidewater glaciers",
    "effort": 2,
    "days": 2,
    "seasons": [
      "summer"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Glaciers calving into the sea, seen from a boat out of Seward. One road reaches Exit Glacier."
  },
  {
    "id": "glba",
    "name": "Glacier Bay",
    "kind": "National Park",
    "state": "AK",
    "lat": 58.5,
    "lon": -136,
    "vis": 0.7,
    "group": "water",
    "feature": "Glacial fjord",
    "effort": 2,
    "days": 3,
    "seasons": [
      "summer"
    ],
    "permit": true,
    "status": "new",
    "blurb": "Reachable by boat or plane only. Most visitors see it from a cruise deck; kayakers get the quiet version."
  },
  {
    "id": "wrst",
    "name": "Wrangell–St. Elias",
    "kind": "National Park",
    "state": "AK",
    "lat": 61,
    "lon": -142,
    "vis": 0.08,
    "group": "mountain",
    "feature": "Icefield range",
    "effort": 3,
    "days": 5,
    "seasons": [
      "summer"
    ],
    "permit": true,
    "status": "new",
    "blurb": "Bigger than Switzerland, with two gravel roads into it. Nine of the sixteen highest US peaks."
  },
  {
    "id": "lacl",
    "name": "Lake Clark",
    "kind": "National Park",
    "state": "AK",
    "lat": 60.42,
    "lon": -154.32,
    "vis": 0.02,
    "group": "water",
    "feature": "Salmon lakes",
    "effort": 3,
    "days": 4,
    "seasons": [
      "summer"
    ],
    "permit": true,
    "status": "new",
    "blurb": "No roads at all. Float planes from Anchorage land on lakes where bears fish the inlet streams."
  },
  {
    "id": "gaar",
    "name": "Gates of the Arctic",
    "kind": "National Park",
    "state": "AK",
    "lat": 67.78,
    "lon": -153.3,
    "vis": 0.01,
    "group": "mountain",
    "feature": "Brooks Range",
    "effort": 3,
    "days": 6,
    "seasons": [
      "summer"
    ],
    "permit": true,
    "status": "new",
    "blurb": "No trails, no campgrounds, no roads, above the Arctic Circle. The least visited park in the system."
  },
  {
    "id": "kova",
    "name": "Kobuk Valley",
    "kind": "National Park",
    "state": "AK",
    "lat": 67.33,
    "lon": -159.12,
    "vis": 0.02,
    "group": "dunes",
    "feature": "Arctic dunes",
    "effort": 3,
    "days": 5,
    "seasons": [
      "summer"
    ],
    "permit": true,
    "status": "new",
    "blurb": "Sand dunes above the Arctic Circle, crossed twice a year by half a million caribou."
  },
  {
    "id": "npsa",
    "name": "National Park of American Samoa",
    "kind": "National Park",
    "state": "AS",
    "lat": -14.26,
    "lon": -170.68,
    "vis": 0.05,
    "group": "coast",
    "feature": "Tropical reef and rainforest",
    "effort": 2,
    "days": 3,
    "seasons": [
      "winter",
      "spring"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Rainforest to reef across three islands in the South Pacific. Village-owned land, visited with permission."
  },
  {
    "id": "viis",
    "name": "Virgin Islands",
    "kind": "National Park",
    "state": "VI",
    "lat": 18.34,
    "lon": -64.73,
    "vis": 0.34,
    "group": "coast",
    "feature": "Caribbean reef",
    "effort": 1,
    "days": 3,
    "seasons": [
      "winter",
      "spring"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Two-thirds of St. John, plus the water around it. Trails to sugar mill ruins between the beaches."
  },
  {
    "id": "caco",
    "name": "Cape Cod",
    "kind": "National Seashore",
    "state": "MA",
    "lat": 41.9,
    "lon": -70,
    "vis": 4,
    "group": "coast",
    "feature": "Atlantic barrier beach",
    "effort": 1,
    "days": 2,
    "seasons": [
      "summer",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Forty miles of outer beach, kettle ponds behind the dunes, and cold water into July."
  },
  {
    "id": "caha",
    "name": "Cape Hatteras",
    "kind": "National Seashore",
    "state": "NC",
    "lat": 35.25,
    "lon": -75.53,
    "vis": 2.6,
    "group": "coast",
    "feature": "Outer Banks",
    "effort": 1,
    "days": 2,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Barrier islands strung along a shifting coast, with the tallest brick lighthouse in the country."
  },
  {
    "id": "asis",
    "name": "Assateague Island",
    "kind": "National Seashore",
    "state": "MD / VA",
    "lat": 38.05,
    "lon": -75.24,
    "vis": 2.7,
    "group": "coast",
    "feature": "Wild horse barrier island",
    "effort": 1,
    "days": 1,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Feral horses on the dunes, a paddle-in bay side, and biting flies in high summer."
  },
  {
    "id": "pais",
    "name": "Padre Island",
    "kind": "National Seashore",
    "state": "TX",
    "lat": 27,
    "lon": -97.3,
    "vis": 0.4,
    "group": "coast",
    "feature": "Longest undeveloped barrier island",
    "effort": 1,
    "days": 2,
    "seasons": [
      "winter",
      "spring"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Sixty miles of undeveloped Gulf beach. Drive the sand south and the crowds vanish within a mile."
  },
  {
    "id": "pore",
    "name": "Point Reyes",
    "kind": "National Seashore",
    "state": "CA",
    "lat": 38.06,
    "lon": -122.88,
    "vis": 2.2,
    "group": "coast",
    "feature": "Fog coast headland",
    "effort": 2,
    "days": 1,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "A peninsula sliding north on its own fault line, with elephant seals and a very loud lighthouse wind."
  },
  {
    "id": "guis",
    "name": "Gulf Islands",
    "kind": "National Seashore",
    "state": "FL / MS",
    "lat": 30.35,
    "lon": -87.1,
    "vis": 5.6,
    "group": "coast",
    "feature": "White quartz beach",
    "effort": 1,
    "days": 2,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Sugar-white barrier beaches across two states, with brick forts at either end."
  },
  {
    "id": "cana",
    "name": "Canaveral",
    "kind": "National Seashore",
    "state": "FL",
    "lat": 28.8,
    "lon": -80.75,
    "vis": 1.6,
    "group": "coast",
    "feature": "Undeveloped Atlantic beach",
    "effort": 1,
    "days": 1,
    "seasons": [
      "winter",
      "spring"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Twenty-four miles of beach next to the launch pads. Closures happen on launch days."
  },
  {
    "id": "fiis",
    "name": "Fire Island",
    "kind": "National Seashore",
    "state": "NY",
    "lat": 40.65,
    "lon": -73.1,
    "vis": 0.6,
    "group": "coast",
    "feature": "Barrier island",
    "effort": 1,
    "days": 1,
    "seasons": [
      "summer",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "A car-free barrier island an hour from Manhattan, with a sunken forest behind the dunes."
  },
  {
    "id": "cuis",
    "name": "Cumberland Island",
    "kind": "National Seashore",
    "state": "GA",
    "lat": 30.83,
    "lon": -81.44,
    "vis": 0.06,
    "group": "coast",
    "feature": "Maritime forest island",
    "effort": 2,
    "days": 2,
    "seasons": [
      "winter",
      "spring"
    ],
    "permit": true,
    "status": "new",
    "blurb": "Ferry-only, with a daily visitor cap. Live oaks, wild horses, and ruined mansions on an empty beach."
  },
  {
    "id": "slbe",
    "name": "Sleeping Bear Dunes",
    "kind": "National Lakeshore",
    "state": "MI",
    "lat": 44.88,
    "lon": -86.05,
    "vis": 1.7,
    "group": "dunes",
    "feature": "Perched lake dunes",
    "effort": 2,
    "days": 2,
    "seasons": [
      "summer",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Dunes four hundred feet above Lake Michigan, with a scenic drive along the top of them."
  },
  {
    "id": "piro",
    "name": "Pictured Rocks",
    "kind": "National Lakeshore",
    "state": "MI",
    "lat": 46.55,
    "lon": -86.35,
    "vis": 1,
    "group": "coast",
    "feature": "Sandstone cliffs",
    "effort": 2,
    "days": 2,
    "seasons": [
      "summer",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Mineral-stained cliffs above Lake Superior, best seen from the water or the North Country Trail above."
  },
  {
    "id": "apis",
    "name": "Apostle Islands",
    "kind": "National Lakeshore",
    "state": "WI",
    "lat": 46.92,
    "lon": -90.66,
    "vis": 0.25,
    "group": "water",
    "feature": "Island sea caves",
    "effort": 2,
    "days": 2,
    "seasons": [
      "summer"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Twenty-one islands and mainland sea caves. Kayak in summer; the ice caves only form some winters."
  },
  {
    "id": "glca",
    "name": "Glen Canyon",
    "kind": "National Recreation Area",
    "state": "UT / AZ",
    "lat": 37.07,
    "lon": -111.25,
    "vis": 5.2,
    "group": "canyon",
    "feature": "Reservoir slot canyons",
    "effort": 2,
    "days": 3,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Lake Powell in a drowned canyon system. Falling water levels keep reopening side canyons."
  },
  {
    "id": "lake",
    "name": "Lake Mead",
    "kind": "National Recreation Area",
    "state": "NV / AZ",
    "lat": 36.14,
    "lon": -114.42,
    "vis": 5.7,
    "group": "desert",
    "feature": "Desert reservoir",
    "effort": 1,
    "days": 2,
    "seasons": [
      "winter",
      "spring"
    ],
    "permit": false,
    "status": "new",
    "blurb": "The biggest reservoir in the country, forty minutes from Las Vegas, ringed by hot desert."
  },
  {
    "id": "dewa",
    "name": "Delaware Water Gap",
    "kind": "National Recreation Area",
    "state": "PA / NJ",
    "lat": 41.13,
    "lon": -74.95,
    "vis": 4.1,
    "group": "forest",
    "feature": "River gap",
    "effort": 2,
    "days": 1,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "A river cut through the Appalachian ridge, with waterfall trails and a stretch of the AT above it."
  },
  {
    "id": "cure",
    "name": "Curecanti",
    "kind": "National Recreation Area",
    "state": "CO",
    "lat": 38.45,
    "lon": -107.33,
    "vis": 0.9,
    "group": "canyon",
    "feature": "Reservoir canyon",
    "effort": 2,
    "days": 2,
    "seasons": [
      "summer",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Three reservoirs in the upper Black Canyon, with kokanee salmon and almost no one hiking."
  },
  {
    "id": "samo",
    "name": "Santa Monica Mountains",
    "kind": "National Recreation Area",
    "state": "CA",
    "lat": 34.1,
    "lon": -118.8,
    "vis": 0.9,
    "group": "coast",
    "feature": "Chaparral range",
    "effort": 2,
    "days": 1,
    "seasons": [
      "winter",
      "spring"
    ],
    "permit": false,
    "status": "new",
    "blurb": "The largest urban national park area, running from Hollywood to the ocean in a chain of canyons."
  },
  {
    "id": "whis",
    "name": "Whiskeytown",
    "kind": "National Recreation Area",
    "state": "CA",
    "lat": 40.63,
    "lon": -122.6,
    "vis": 0.6,
    "group": "forest",
    "feature": "Waterfall lake",
    "effort": 2,
    "days": 1,
    "seasons": [
      "spring",
      "summer"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Four waterfalls and a clear lake in northern California, recovering visibly from the 2018 fire."
  },
  {
    "id": "bicy",
    "name": "Big Cypress",
    "kind": "National Preserve",
    "state": "FL",
    "lat": 25.86,
    "lon": -81.03,
    "vis": 1,
    "group": "water",
    "feature": "Cypress swamp",
    "effort": 2,
    "days": 1,
    "seasons": [
      "winter"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Swamp walks and a scenic loop road where the panther signs are not decorative."
  },
  {
    "id": "moja",
    "name": "Mojave",
    "kind": "National Preserve",
    "state": "CA",
    "lat": 35.1,
    "lon": -115.7,
    "vis": 0.9,
    "group": "desert",
    "feature": "Joshua tree and cinder cones",
    "effort": 2,
    "days": 2,
    "seasons": [
      "winter",
      "spring"
    ],
    "permit": false,
    "status": "new",
    "blurb": "A million and a half acres between two interstates, with dunes that boom and lava tubes you can enter."
  },
  {
    "id": "vall",
    "name": "Valles Caldera",
    "kind": "National Preserve",
    "state": "NM",
    "lat": 35.87,
    "lon": -106.53,
    "vis": 0.05,
    "group": "mountain",
    "feature": "Volcanic grassland",
    "effort": 2,
    "days": 1,
    "seasons": [
      "summer",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "A collapsed supervolcano turned high grassland, with elk herds and a vehicle cap on backcountry roads."
  },
  {
    "id": "tapr",
    "name": "Tallgrass Prairie",
    "kind": "National Preserve",
    "state": "KS",
    "lat": 38.43,
    "lon": -96.56,
    "vis": 0.03,
    "group": "badlands",
    "feature": "Tallgrass prairie",
    "effort": 1,
    "days": 1,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "One of the last big stands of tallgrass, with a bison herd and a stone ranch house at its center."
  },
  {
    "id": "bela",
    "name": "Bering Land Bridge",
    "kind": "National Preserve",
    "state": "AK",
    "lat": 66.2,
    "lon": -164.4,
    "vis": 0.005,
    "group": "dunes",
    "feature": "Arctic tundra",
    "effort": 3,
    "days": 4,
    "seasons": [
      "summer"
    ],
    "permit": true,
    "status": "new",
    "blurb": "Remnant of the land bridge, reached by bush plane from Nome. Fewer visitors a year than most parks see hourly."
  },
  {
    "id": "deto",
    "name": "Devils Tower",
    "kind": "National Monument",
    "state": "WY",
    "lat": 44.59,
    "lon": -104.72,
    "vis": 0.5,
    "group": "mountain",
    "feature": "Igneous column",
    "effort": 2,
    "days": 1,
    "seasons": [
      "summer",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "A columnar butte that climbers close voluntarily each June out of respect for tribal ceremonies."
  },
  {
    "id": "dino",
    "name": "Dinosaur",
    "kind": "National Monument",
    "state": "CO / UT",
    "lat": 40.44,
    "lon": -109.3,
    "vis": 0.3,
    "group": "canyon",
    "feature": "Fossil quarry canyons",
    "effort": 2,
    "days": 2,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "A wall of fossil bone left in place, plus two river canyons most visitors never drive into."
  },
  {
    "id": "cebr",
    "name": "Cedar Breaks",
    "kind": "National Monument",
    "state": "UT",
    "lat": 37.63,
    "lon": -112.85,
    "vis": 0.7,
    "group": "canyon",
    "feature": "High amphitheater",
    "effort": 1,
    "days": 1,
    "seasons": [
      "summer",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "A hoodoo amphitheater at ten thousand feet, above the crowds at Bryce an hour away."
  },
  {
    "id": "chir",
    "name": "Chiricahua",
    "kind": "National Monument",
    "state": "AZ",
    "lat": 32.01,
    "lon": -109.35,
    "vis": 0.06,
    "group": "canyon",
    "feature": "Rock pinnacles",
    "effort": 2,
    "days": 1,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "A maze of balanced volcanic pinnacles in a sky island range, with a shuttle-served rim trail."
  },
  {
    "id": "colm",
    "name": "Colorado",
    "kind": "National Monument",
    "state": "CO",
    "lat": 39.05,
    "lon": -108.68,
    "vis": 0.4,
    "group": "canyon",
    "feature": "Red rock canyons",
    "effort": 2,
    "days": 1,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Sandstone canyons on the edge of Grand Junction, with a rim drive and desert bighorn."
  },
  {
    "id": "orpi",
    "name": "Organ Pipe Cactus",
    "kind": "National Monument",
    "state": "AZ",
    "lat": 32,
    "lon": -112.8,
    "vis": 0.25,
    "group": "desert",
    "feature": "Sonoran desert",
    "effort": 2,
    "days": 2,
    "seasons": [
      "winter",
      "spring"
    ],
    "permit": false,
    "status": "new",
    "blurb": "The only place in the country where organ pipe cactus grows wild, on the Mexican border."
  },
  {
    "id": "sucr",
    "name": "Sunset Crater Volcano",
    "kind": "National Monument",
    "state": "AZ",
    "lat": 35.36,
    "lon": -111.5,
    "vis": 0.8,
    "group": "desert",
    "feature": "Cinder cone",
    "effort": 1,
    "days": 1,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "A thousand-year-old cinder cone with a lava flow trail, shared with Wupatki up the road."
  },
  {
    "id": "cach",
    "name": "Canyon de Chelly",
    "kind": "National Monument",
    "state": "AZ",
    "lat": 36.13,
    "lon": -109.47,
    "vis": 0.4,
    "group": "canyon",
    "feature": "Navajo canyon",
    "effort": 2,
    "days": 1,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": true,
    "status": "new",
    "blurb": "Managed with the Navajo Nation; all but one trail requires an authorized guide."
  },
  {
    "id": "hove",
    "name": "Hovenweep",
    "kind": "National Monument",
    "state": "UT / CO",
    "lat": 37.38,
    "lon": -109.07,
    "vis": 0.03,
    "group": "canyon",
    "feature": "Ancestral towers",
    "effort": 2,
    "days": 1,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Six clusters of stone towers on canyon rims, with dark skies and no crowds at all."
  },
  {
    "id": "depo",
    "name": "Devils Postpile",
    "kind": "National Monument",
    "state": "CA",
    "lat": 37.63,
    "lon": -119.08,
    "vis": 0.14,
    "group": "mountain",
    "feature": "Basalt columns",
    "effort": 2,
    "days": 1,
    "seasons": [
      "summer"
    ],
    "permit": true,
    "status": "new",
    "blurb": "A columnar basalt wall near Mammoth, reached by mandatory shuttle in summer."
  },
  {
    "id": "labe",
    "name": "Lava Beds",
    "kind": "National Monument",
    "state": "CA",
    "lat": 41.71,
    "lon": -121.51,
    "vis": 0.1,
    "group": "caves",
    "feature": "Lava tube caves",
    "effort": 2,
    "days": 1,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Over eight hundred lava tubes you can enter with a headlamp, on a high volcanic plateau."
  },
  {
    "id": "orca",
    "name": "Oregon Caves",
    "kind": "National Monument",
    "state": "OR",
    "lat": 42.1,
    "lon": -123.41,
    "vis": 0.07,
    "group": "caves",
    "feature": "Marble cave",
    "effort": 2,
    "days": 1,
    "seasons": [
      "summer"
    ],
    "permit": true,
    "status": "new",
    "blurb": "A marble cave under old-growth forest, seen only on a ranger-led tour with a lot of stairs."
  },
  {
    "id": "tica",
    "name": "Timpanogos Cave",
    "kind": "National Monument",
    "state": "UT",
    "lat": 40.44,
    "lon": -111.71,
    "vis": 0.08,
    "group": "caves",
    "feature": "Cave and canyon",
    "effort": 3,
    "days": 1,
    "seasons": [
      "summer"
    ],
    "permit": true,
    "status": "new",
    "blurb": "A steep mile and a half of switchbacks before the cave door. Tickets sell out weeks out."
  },
  {
    "id": "jeca",
    "name": "Jewel Cave",
    "kind": "National Monument",
    "state": "SD",
    "lat": 43.73,
    "lon": -103.83,
    "vis": 0.09,
    "group": "caves",
    "feature": "Calcite cave",
    "effort": 2,
    "days": 1,
    "seasons": [
      "summer"
    ],
    "permit": true,
    "status": "new",
    "blurb": "The third longest cave in the world, half an hour from Wind Cave and far quieter."
  },
  {
    "id": "flfo",
    "name": "Florissant Fossil Beds",
    "kind": "National Monument",
    "state": "CO",
    "lat": 38.91,
    "lon": -105.28,
    "vis": 0.08,
    "group": "forest",
    "feature": "Fossil beds",
    "effort": 1,
    "days": 1,
    "seasons": [
      "summer",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Petrified redwood stumps and shale full of fossil insects, an hour west of Colorado Springs."
  },
  {
    "id": "joda",
    "name": "John Day Fossil Beds",
    "kind": "National Monument",
    "state": "OR",
    "lat": 44.6,
    "lon": -119.65,
    "vis": 0.2,
    "group": "badlands",
    "feature": "Painted hills",
    "effort": 1,
    "days": 2,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Three units of banded badlands recording forty million years, with a paleontology lab on site."
  },
  {
    "id": "scbl",
    "name": "Scotts Bluff",
    "kind": "National Monument",
    "state": "NE",
    "lat": 41.83,
    "lon": -103.71,
    "vis": 0.13,
    "group": "badlands",
    "feature": "Trail landmark bluff",
    "effort": 1,
    "days": 1,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "The landmark that told Oregon Trail wagons how far they had come. A road and a trail go up it."
  },
  {
    "id": "efmo",
    "name": "Effigy Mounds",
    "kind": "National Monument",
    "state": "IA",
    "lat": 43.09,
    "lon": -91.19,
    "vis": 0.07,
    "group": "forest",
    "feature": "Animal-shaped mounds",
    "effort": 1,
    "days": 1,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Two hundred mounds, some shaped as bears and birds, on bluffs above the Mississippi."
  },
  {
    "id": "pipe",
    "name": "Pipestone",
    "kind": "National Monument",
    "state": "MN",
    "lat": 44.01,
    "lon": -96.32,
    "vis": 0.07,
    "group": "badlands",
    "feature": "Quarry and prairie",
    "effort": 1,
    "days": 1,
    "seasons": [
      "spring",
      "summer"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Quartzite quarries still worked by tribal members for ceremonial pipestone, with a prairie loop trail."
  },
  {
    "id": "cabr",
    "name": "Cabrillo",
    "kind": "National Monument",
    "state": "CA",
    "lat": 32.67,
    "lon": -117.24,
    "vis": 0.9,
    "group": "coast",
    "feature": "Headland tidepools",
    "effort": 1,
    "days": 1,
    "seasons": [
      "winter",
      "spring"
    ],
    "permit": false,
    "status": "new",
    "blurb": "A headland over San Diego harbor, with tidepools below and gray whales offshore in winter."
  },
  {
    "id": "inde",
    "name": "Independence",
    "kind": "National Historical Park",
    "state": "PA",
    "lat": 39.95,
    "lon": -75.15,
    "vis": 3.6,
    "group": "forest",
    "feature": "Founding-era city blocks",
    "effort": 1,
    "days": 1,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": true,
    "status": "new",
    "blurb": "Independence Hall and the surrounding blocks. Hall tours are timed tickets most of the year."
  },
  {
    "id": "safe",
    "name": "San Antonio Missions",
    "kind": "National Historical Park",
    "state": "TX",
    "lat": 29.35,
    "lon": -98.47,
    "vis": 1.9,
    "group": "desert",
    "feature": "Spanish colonial missions",
    "effort": 1,
    "days": 1,
    "seasons": [
      "winter",
      "spring"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Four working mission churches strung along a river trail you can ride between in an afternoon."
  },
  {
    "id": "chcu",
    "name": "Chaco Culture",
    "kind": "National Historical Park",
    "state": "NM",
    "lat": 36.06,
    "lon": -107.96,
    "vis": 0.06,
    "group": "canyon",
    "feature": "Great houses",
    "effort": 2,
    "days": 2,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Monumental great houses aligned to the sun and moon, at the end of a rough dirt road."
  },
  {
    "id": "hafe",
    "name": "Harpers Ferry",
    "kind": "National Historical Park",
    "state": "WV",
    "lat": 39.32,
    "lon": -77.73,
    "vis": 0.4,
    "group": "forest",
    "feature": "River confluence town",
    "effort": 2,
    "days": 1,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "A town at the meeting of two rivers and three states, with the AT running through the middle."
  },
  {
    "id": "klgo",
    "name": "Klondike Gold Rush",
    "kind": "National Historical Park",
    "state": "AK",
    "lat": 59.45,
    "lon": -135.31,
    "vis": 0.7,
    "group": "mountain",
    "feature": "Gold rush trail",
    "effort": 3,
    "days": 3,
    "seasons": [
      "summer"
    ],
    "permit": true,
    "status": "new",
    "blurb": "Skagway plus the Chilkoot Trail, a hard multi-day walk over the pass into Canada."
  },
  {
    "id": "vafo",
    "name": "Valley Forge",
    "kind": "National Historical Park",
    "state": "PA",
    "lat": 40.1,
    "lon": -75.45,
    "vis": 2,
    "group": "forest",
    "feature": "Encampment grounds",
    "effort": 1,
    "days": 1,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "The winter encampment, now rolling ground with a paved loop that locals run and ride daily."
  },
  {
    "id": "blri",
    "name": "Blue Ridge Parkway",
    "kind": "National Parkway",
    "state": "NC / VA",
    "lat": 36.5,
    "lon": -80.9,
    "vis": 16.7,
    "group": "mountain",
    "feature": "Ridge-top drive",
    "effort": 1,
    "days": 3,
    "seasons": [
      "fall",
      "spring"
    ],
    "permit": false,
    "status": "new",
    "blurb": "The most visited unit in the whole system: 469 miles of ridge driving with trailheads all along it."
  },
  {
    "id": "natr",
    "name": "Natchez Trace Parkway",
    "kind": "National Parkway",
    "state": "MS / AL / TN",
    "lat": 34.5,
    "lon": -88.2,
    "vis": 6.4,
    "group": "forest",
    "feature": "Historic trace drive",
    "effort": 1,
    "days": 3,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Four hundred and forty miles with no commercial traffic, following a route walked for centuries."
  },
  {
    "id": "gett",
    "name": "Gettysburg",
    "kind": "National Military Park",
    "state": "PA",
    "lat": 39.81,
    "lon": -77.23,
    "vis": 0.9,
    "group": "forest",
    "feature": "Battlefield",
    "effort": 1,
    "days": 1,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "Six thousand acres of battlefield with an auto tour, best walked early before the buses."
  },
  {
    "id": "anti",
    "name": "Antietam",
    "kind": "National Battlefield",
    "state": "MD",
    "lat": 39.47,
    "lon": -77.74,
    "vis": 0.4,
    "group": "forest",
    "feature": "Battlefield",
    "effort": 1,
    "days": 1,
    "seasons": [
      "spring",
      "fall"
    ],
    "permit": false,
    "status": "new",
    "blurb": "The single bloodiest day in American history, on farmland kept close to how it looked in 1862."
  }
];

/** The 63 named national parks, as opposed to the other unit types. */
export const NAMED_PARKS: Site[] = SITES.filter((s) => s.kind === 'National Park');

export const siteById = (id: string): Site | undefined =>
  SITES.find((s) => s.id === id);
