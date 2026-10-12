"""
Official NPS brochure maps: the printed park maps from the Harpers Ferry
Center (HFC), copied into our `brochure_maps` table so the app can show
them full-screen and zoomable. Called from app/park_map_sync.py.

The maps live in the public-domain "HFC Cartography" collection on
NPGallery (npgallery.nps.gov), searchable by park code. There is no JSON
API: the search page embeds its results as a JSON object, which is parsed
out of the HTML. Each map's high-resolution JPEG (/GetAsset/{id}/proxyhires,
~5000 px and ~4 MB) is shrunk here to MAX_SIDE px, ~0.6 MB, which still
reads clearly when zoomed in on a phone.

Which maps: titles starting "Park Map" first, then other whole-park or
area maps (Acadia's "Mount Desert Island Map", Olympic's "Park and Area
Maps"), at most MAX_PER_PARK, so parks in separate units (Saguaro East and
West, Theodore Roosevelt North and South) get each one. 58 of the 62
national park records have a "Park Map".

Re-running is cheap: a map already stored under the same NPGallery asset
id isn't downloaded again.
"""

import io
import json
import re
from datetime import UTC, datetime

import httpx
from PIL import Image
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import BrochureMap

NPGALLERY = "https://npgallery.nps.gov"
MAX_SIDE = 2400
# Smaller than this and the labels can't be read, however far you zoom.
MIN_SIDE = 1200
MAX_PER_PARK = 3

# Our park_code -> the unit codes HFC files its maps under, where they differ.
UNIT_CODES = {"seki": ["SEKI", "SEQU", "KICA"]}


def search(client: httpx.Client, unit_code: str) -> list[dict]:
    """The HFC Cartography assets for a unit: [{"id", "title"}]."""
    response = client.get(
        f"{NPGALLERY}/HFC/SearchResults",
        params={
            "allFieldsFormat": "AllWords",
            "collection": "HFC Cartography",
            "unitcode": unit_code,
            "view": "list",
            "PageSize": 100,
        },
        headers={"User-Agent": "ParkPath park map sync"},
    )
    response.raise_for_status()
    return parse_search_page(response.text)


def parse_search_page(html: str) -> list[dict]:
    """Pull the embedded results object (the one with "UnfilteredCount") out of the page."""
    match = re.search(r'"UnfilteredCount"', html)
    if not match:
        return []
    # Walk back to the brace that opens the object containing it.
    depth, start = 0, match.start()
    while start > 0:
        start -= 1
        if html[start] == "}":
            depth += 1
        elif html[start] == "{":
            if depth == 0:
                break
            depth -= 1
    try:
        results, _ = json.JSONDecoder().raw_decode(html[start:])
    except json.JSONDecodeError:
        return []
    return [
        {"id": item["Asset"]["AssetID"], "title": item["Asset"].get("Title") or ""}
        for item in results.get("Results") or []
        if item.get("Asset", {}).get("AssetID")
    ]


def _short_title(title: str) -> str:
    """'Park Map, East Unit  - Saguaro National Park' -> 'Park Map, East Unit'."""
    return re.split(r"\s+-\s+", title, maxsplit=1)[0].strip()


def pick_maps(assets: list[dict]) -> list[dict]:
    """The park's main maps, best first, one per title."""

    def rank(title: str) -> int | None:
        t = title.lower()
        if "locator" in t or " map" not in f" {t}":
            return None
        if t.startswith("park map"):
            return 0
        if "park and area" in t or "area map" in t or "island" in t:
            return 1
        return None

    seen: set[str] = set()
    picked = []
    for asset in sorted(assets, key=lambda a: rank(_short_title(a["title"])) or 0):
        short = _short_title(asset["title"])
        if rank(short) is None or short in seen:
            continue
        seen.add(short)
        picked.append({"id": asset["id"], "title": short})
    return picked[:MAX_PER_PARK]


def shrink(jpeg: bytes) -> tuple[bytes, int, int]:
    """Scale so the long side is at most MAX_SIDE; returns (jpeg, width, height)."""
    image = Image.open(io.BytesIO(jpeg)).convert("RGB")
    scale = min(1.0, MAX_SIDE / max(image.size))
    if scale < 1:
        image = image.resize(
            (round(image.width * scale), round(image.height * scale)), Image.LANCZOS
        )
    out = io.BytesIO()
    image.save(out, "JPEG", quality=78, optimize=True, progressive=True)
    return out.getvalue(), image.width, image.height


def sync_brochures(db: Session, client: httpx.Client, site_id: int, park_code: str) -> str:
    """Store the park's brochure maps; returns a short note for the sync's log line."""
    assets = [
        a for code in UNIT_CODES.get(park_code, [park_code.upper()]) for a in search(client, code)
    ]
    maps = pick_maps(assets)
    stored = {
        m.asset_id: m for m in db.scalars(select(BrochureMap).where(BrochureMap.site_id == site_id))
    }

    kept: list[BrochureMap] = []
    for picked in maps:
        row = stored.get(picked["id"])
        if row is None:
            response = client.get(f"{NPGALLERY}/GetAsset/{picked['id']}/proxyhires")
            response.raise_for_status()
            if not response.headers.get("content-type", "").startswith("image/"):
                continue
            image, width, height = shrink(response.content)
            row = BrochureMap(
                site_id=site_id, asset_id=picked["id"], image=image, width=width, height=height
            )
        if max(row.width, row.height) < MIN_SIDE:
            continue
        # Numbered by what's kept, so a skipped map leaves no gap.
        row.position = len(kept)
        row.title = picked["title"]
        row.synced_at = datetime.now(UTC)
        kept.append(row)

    # Replace the park's set: drop maps no longer picked, then save the rest.
    db.execute(
        delete(BrochureMap).where(
            BrochureMap.site_id == site_id,
            BrochureMap.asset_id.notin_([row.asset_id for row in kept]),
        )
    )
    db.add_all(kept)
    db.commit()
    return f", {len(kept)} brochure map{'s' if len(kept) != 1 else ''}"
