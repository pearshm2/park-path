"""
Park map sync job: copies each national park's boundary, roads, trails and
visitor centers from the NPS's public GIS datasets into our `park_maps`
table, and its official brochure map into `brochure_maps`, so the app can
show a park's maps without calling the NPS from the phone.

Run from the api/ folder:

    python -m app.park_map_sync                    # every national park (several minutes)
    python -m app.park_map_sync --park zion        # just one
    python -m app.park_map_sync --skip-brochures   # GIS data only, no image downloads

Sources (public domain):

  - Trails:   NPS_Public_Trails_Geographic   on mapservices.nps.gov
  - Roads:    NPS_Public_Roads_Geographic    on mapservices.nps.gov
  - Visitor centers: NPS_Public_POIs_Geographic on mapservices.nps.gov, plus
    the NPS Data API's /visitorcenters when NPS_API_KEY is set (the GIS
    data misses some, e.g. Yosemite Valley's)
  - Boundary: NPS Land Resources Division Boundary (layer 2) on ArcGIS Online
  - Brochure maps: the Harpers Ferry Center collection on NPGallery
    (see app/brochure_maps.py)

Safe to run any number of times: each park's row is replaced whole.

Lines are simplified by the NPS server (maxAllowableOffset, in degrees) to
about the detail a phone screen can show, which takes a park like Zion from
~540 KB of trail geometry to ~35 KB. Known gaps in the NPS data: Gates of
the Arctic has no maintained trails, and Sequoia & Kings Canyon's trails
aren't in the dataset at all; both still get a boundary (and roads).
"""

import argparse
import math
from collections import defaultdict
from datetime import UTC, datetime

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.brochure_maps import sync_brochures
from app.config import settings
from app.database import SessionLocal
from app.models import ParkMap, Site

NPS_GIS = "https://mapservices.nps.gov/arcgis/rest/services/NationalDatasets"
TRAILS_URL = f"{NPS_GIS}/NPS_Public_Trails_Geographic/FeatureServer/0/query"
ROADS_URL = f"{NPS_GIS}/NPS_Public_Roads_Geographic/FeatureServer/0/query"
POIS_URL = f"{NPS_GIS}/NPS_Public_POIs_Geographic/FeatureServer/0/query"
NPS_VISITOR_CENTERS_URL = "https://developer.nps.gov/api/v1/visitorcenters"
BOUNDARY_URL = (
    "https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/"
    "NPS_Land_Resources_Division_Boundary_and_Tract_Data_Service/FeatureServer/2/query"
)

PAGE_SIZE = 1000

# Simplification tolerance per layer, in degrees (0.0001° ≈ 10 m).
TRAIL_DETAIL = 0.0001
ROAD_DETAIL = 0.0002
BOUNDARY_DETAIL = 0.0005

# Our park_code -> the unit codes the GIS datasets file it under, where
# they differ. Sequoia & Kings Canyon is one NPS unit ("seki") but two
# parks in the GIS data.
UNIT_CODES = {"seki": ["SEQU", "KICA"]}

# Statuses and road classes that don't belong on a visitor's map.
GONE = ("Decommissioned", "Proposed", "Planned", "Abandoned")
HIDDEN_ROADS = ("Service", "Service 4x4", "Private", "Parking Lot Road")


def unit_codes(park_code: str) -> list[str]:
    return UNIT_CODES.get(park_code, [park_code.upper()])


def _in_list(values: list[str] | tuple[str, ...]) -> str:
    return ", ".join(f"'{value}'" for value in values)


# ---------------------------------------------------------------------------
# 1. FETCH: page through an ArcGIS layer as GeoJSON
# ---------------------------------------------------------------------------
def fetch_features(
    client: httpx.Client, url: str, where: str, out_fields: str, detail: float
) -> list[dict]:
    """`detail` is the simplification tolerance; 0 for points, which have none."""
    features: list[dict] = []
    offset = 0
    while True:
        params = {
            "where": where,
            "outFields": out_fields,
            "outSR": 4326,
            "geometryPrecision": 5,
            "resultOffset": offset,
            "resultRecordCount": PAGE_SIZE,
            "f": "geojson",
        }
        if detail:
            params["maxAllowableOffset"] = detail
        response = client.get(url, params=params)
        response.raise_for_status()
        body = response.json()
        if "error" in body:  # ArcGIS reports errors with a 200
            raise RuntimeError(f"{url}: {body['error']}")
        page = body.get("features", [])
        features.extend(page)
        more = body.get("exceededTransferLimit") or body.get("properties", {}).get(
            "exceededTransferLimit"
        )
        if not page or not (more or len(page) == PAGE_SIZE):
            return features
        offset += len(page)


def fetch_park(client: httpx.Client, park_code: str) -> dict[str, list[dict]]:
    codes = _in_list(unit_codes(park_code))
    return {
        "boundary": fetch_features(
            client, BOUNDARY_URL, f"UNIT_CODE IN ({codes})", "UNIT_CODE", BOUNDARY_DETAIL
        ),
        "roads": fetch_features(
            client,
            ROADS_URL,
            f"UNITCODE IN ({codes})"
            f" AND (RDSTATUS IS NULL OR RDSTATUS NOT IN ({_in_list(GONE)}))"
            f" AND (RDCLASS IS NULL OR RDCLASS NOT IN ({_in_list(HIDDEN_ROADS)}))",
            "RDNAME,MAPLABEL,RDALTNAME,RDCLASS",
            ROAD_DETAIL,
        ),
        "trails": fetch_features(
            client,
            TRAILS_URL,
            f"UNITCODE IN ({codes})"
            f" AND (TRLSTATUS IS NULL OR TRLSTATUS NOT IN ({_in_list(GONE)}))",
            "TRLNAME,MAPLABEL,TRLALTNAME,TRLUSE,TRLSURFACE,TRLSTATUS",
            TRAIL_DETAIL,
        ),
        "visitor_centers": fetch_features(
            client,
            POIS_URL,
            f"UNITCODE IN ({codes}) AND POITYPE = 'Visitor Center'",
            "POINAME,MAPLABEL,POIALTNAME",
            0,
        ),
        "nps_visitor_centers": fetch_nps_visitor_centers(client, park_code),
    }


def fetch_nps_visitor_centers(client: httpx.Client, park_code: str) -> list[dict]:
    """The NPS Data API's visitor centers for the park; empty without an API key."""
    if not settings.nps_api_key:
        return []
    response = client.get(
        NPS_VISITOR_CENTERS_URL,
        params={"parkCode": park_code, "limit": 50, "api_key": settings.nps_api_key},
    )
    response.raise_for_status()
    return response.json().get("data", [])


# ---------------------------------------------------------------------------
# 2. TRANSFORM: GeoJSON features -> the JSON GET /sites/{code}/map serves
# ---------------------------------------------------------------------------
def _point(coord: list[float]) -> list[float]:
    return [round(coord[0], 5), round(coord[1], 5)]


def line_paths(geometry: dict | None) -> list[list[list[float]]]:
    """A LineString or MultiLineString as a list of paths."""
    if not geometry:
        return []
    if geometry["type"] == "LineString":
        lines = [geometry["coordinates"]]
    elif geometry["type"] == "MultiLineString":
        lines = geometry["coordinates"]
    else:
        return []
    return [[_point(c) for c in line] for line in lines if len(line) >= 2]


def polygon_rings(geometry: dict | None) -> list[list[list[float]]]:
    """A Polygon or MultiPolygon as a flat list of rings (draw with even-odd fill)."""
    if not geometry:
        return []
    if geometry["type"] == "Polygon":
        polygons = [geometry["coordinates"]]
    elif geometry["type"] == "MultiPolygon":
        polygons = geometry["coordinates"]
    else:
        return []
    return [[_point(c) for c in ring] for polygon in polygons for ring in polygon if len(ring) >= 4]


def _clean(value: str | None) -> str | None:
    value = (value or "").strip()
    return None if value.lower() in ("", "unknown", "not applicable") else value


def _name(props: dict, *fields: str) -> str | None:
    """The first usable name. Parks fill different fields: Acadia leaves
    TRLNAME empty and names every trail in MAPLABEL."""
    return next((name for field in fields if (name := _clean(props.get(field)))), None)


# The NPS writes trail use many ways ("Hike", "Hiker / Pedestrian",
# "Hike | PackOrSaddle", ...). Each kind below is matched by keyword.
USE_KEYWORDS = {
    "hike": ("hike", "hiker", "pedestrian", "foot", "walk"),
    "horse": ("pack", "saddle", "horse", "stock", "equestrian"),
    "bike": ("bicycle", "bike"),
    "motorized": ("all-terrain", "atv", "motor", "vehicle", "snowmobile", "ohv"),
}


def trail_uses(value: str | None) -> list[str]:
    text = (value or "").lower()
    return [use for use, words in USE_KEYWORDS.items() if any(w in text for w in words)]


def road_kind(value: str | None) -> str:
    return {"Primary": "primary", "Secondary": "secondary", "4WD": "4wd"}.get(
        (value or "").strip(), "local"
    )


def path_miles(paths: list[list[list[float]]]) -> float:
    total = 0.0
    for path in paths:
        for (lon1, lat1), (lon2, lat2) in zip(path, path[1:]):
            p1, p2 = math.radians(lat1), math.radians(lat2)
            dl = math.radians(lon2 - lon1)
            a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
            total += 2 * 3958.8 * math.asin(math.sqrt(a))
    return total


def transform_trails(features: list[dict]) -> list[dict]:
    """
    One entry per trail. The NPS splits a trail into many segments; the
    segments that share a name, uses, surface and status are merged.
    Named trails come first, by name; unnamed ones are drawn but not listed.
    """
    groups: dict[tuple, list] = defaultdict(list)
    for feature in features:
        props = feature.get("properties") or {}
        key = (
            _name(props, "TRLNAME", "MAPLABEL", "TRLALTNAME"),
            tuple(trail_uses(props.get("TRLUSE"))),
            _clean(props.get("TRLSURFACE")),
            (props.get("TRLSTATUS") or "").strip() == "Temporarily Closed",
        )
        groups[key].extend(line_paths(feature.get("geometry")))
    trails = [
        {
            "name": name,
            "uses": list(uses),
            "surface": surface,
            "closed": closed,
            "length_miles": round(path_miles(paths), 1),
            "paths": paths,
        }
        for (name, uses, surface, closed), paths in groups.items()
        if paths
    ]
    return sorted(trails, key=lambda t: (t["name"] is None, (t["name"] or "").lower()))


def transform_roads(features: list[dict]) -> list[dict]:
    groups: dict[tuple, list] = defaultdict(list)
    for feature in features:
        props = feature.get("properties") or {}
        key = (_name(props, "RDNAME", "MAPLABEL", "RDALTNAME"), road_kind(props.get("RDCLASS")))
        groups[key].extend(line_paths(feature.get("geometry")))
    return [
        {"name": name, "kind": kind, "paths": paths}
        for (name, kind), paths in groups.items()
        if paths
    ]


def _miles_apart(a: list[float], b: list[float]) -> float:
    return path_miles([[a, b]])


def transform_places(gis: list[dict], nps_api: list[dict]) -> list[dict]:
    """
    Visitor centers, from the GIS points first, then any the NPS Data API
    has that aren't within a quarter mile of one already found.
    """
    places: list[dict] = []
    for feature in gis:
        geometry = feature.get("geometry") or {}
        if geometry.get("type") != "Point":
            continue
        name = _name(feature.get("properties") or {}, "POINAME", "MAPLABEL", "POIALTNAME")
        places.append(
            {
                "name": name or "Visitor Center",
                "kind": "visitor_center",
                "point": _point(geometry["coordinates"]),
            }
        )
    for center in nps_api:
        try:
            point = _point([float(center["longitude"]), float(center["latitude"])])
        except (KeyError, TypeError, ValueError):
            continue
        if any(_miles_apart(point, p["point"]) < 0.25 for p in places):
            continue
        places.append(
            {
                "name": center.get("name") or "Visitor Center",
                "kind": "visitor_center",
                "point": point,
            }
        )
    return places


def transform_park(raw: dict[str, list[dict]]) -> dict | None:
    """The stored map, or None if the NPS has nothing at all for the park."""
    boundary = [ring for f in raw["boundary"] for ring in polygon_rings(f.get("geometry"))]
    roads = transform_roads(raw["roads"])
    trails = transform_trails(raw["trails"])
    places = transform_places(raw.get("visitor_centers", []), raw.get("nps_visitor_centers", []))
    if not (boundary or roads or trails):
        return None
    return {"boundary": boundary, "roads": roads, "trails": trails, "places": places}


# ---------------------------------------------------------------------------
# 3. LOAD: replace the park's row
# ---------------------------------------------------------------------------
def save_park_map(db: Session, site_id: int, park_map: dict) -> None:
    values = {**park_map, "synced_at": datetime.now(UTC)}
    db.execute(
        insert(ParkMap)
        .values(site_id=site_id, **values)
        .on_conflict_do_update(index_elements=[ParkMap.site_id], set_=values)
    )
    db.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--park", help="sync just this park_code (e.g. zion)")
    parser.add_argument(
        "--skip-brochures", action="store_true", help="don't download the brochure maps"
    )
    args = parser.parse_args()

    with SessionLocal() as db, httpx.Client(timeout=90) as client:
        stmt = select(Site.id, Site.park_code).where(Site.is_named_park.is_(True))
        if args.park:
            stmt = select(Site.id, Site.park_code).where(Site.park_code == args.park.lower())
        parks = db.execute(stmt.order_by(Site.park_code)).all()
        if not parks:
            raise SystemExit("No matching parks. Run the NPS sync first (python -m app.nps_sync).")

        for site_id, code in parks:
            park_map = transform_park(fetch_park(client, code))
            if park_map is None:
                print(f"{code}: nothing in the NPS GIS data, skipped")
                continue
            save_park_map(db, site_id, park_map)
            named = sum(1 for t in park_map["trails"] if t["name"])
            brochures = "" if args.skip_brochures else sync_brochures(db, client, site_id, code)
            print(
                f"{code}: {named} named trails, {len(park_map['roads'])} roads,"
                f" {len(park_map['places'])} visitor centers{brochures}"
            )


if __name__ == "__main__":
    main()
