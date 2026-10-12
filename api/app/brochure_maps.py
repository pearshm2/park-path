"""
Official NPS brochure maps: the printed park maps from the Harpers Ferry
Center (HFC), copied into our `brochure_maps` table so the app can show
them full-screen and zoomable. Called from app/park_map_sync.py.

The maps live in the public-domain "HFC Cartography" collection on
NPGallery (npgallery.nps.gov), searchable by park code. There is no JSON
API: the search page embeds its results as a JSON object, which is parsed
out of the HTML.

Each map's original is a PDF (/GetAsset/{id}/original, 4-30 MB) whose
labels are real text. It's rendered here (pypdfium2) to a MAX_SIDE px JPEG,
~0.6 MB, which still reads clearly when zoomed in on a phone, and the
positions of its "Visitor Center" labels are read from the same page, so
the app can zoom straight to one. A map whose original isn't a PDF falls
back to its high-resolution JPEG (/proxyhires), without labels.

Which maps: titles starting "Park Map" first, then other whole-park or
area maps (Acadia's "Mount Desert Island Map", Olympic's "Park and Area
Maps"), at most MAX_PER_PARK, so parks in separate units (Saguaro East and
West, Theodore Roosevelt North and South) get each one. 58 of the 62
national park records have a "Park Map".

Re-running is cheap: a map already stored under the same NPGallery asset
id isn't downloaded again (unless it was stored before labels were read).
"""

import io
import json
import re
from datetime import UTC, datetime

import httpx
import pypdfium2 as pdfium
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

# A visitor center's label on the map. Capitalised, which tells a label
# apart from a sentence that mentions one ("Buy maps at visitor centers").
LABEL = re.compile(r"Visitor (Center|Contact Station)\b")

# A line of text on a PDF page: its text and (left, bottom, right, top) in
# PDF points, origin at the bottom left.
TextLine = tuple[str, tuple[float, float, float, float]]


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
    return _jpeg(image), image.width, image.height


def _jpeg(image: Image.Image) -> bytes:
    out = io.BytesIO()
    image.save(out, "JPEG", quality=78, optimize=True, progressive=True)
    return out.getvalue()


# Small words a place name can have in lower case ("Gates of the Arctic").
NAME_JOINERS = {"of", "the", "and", "at", "de", "la", "del", "on", "in", "to", "by"}


def _clean_words(text: str) -> list[str]:
    """
    Words without the stray glyphs picked up beside them (map icons read as
    "ii"), keeping short words that belong in names ("Island in the Sky").
    """
    return [w for w in text.split() if not (len(w) <= 2 and w.islower() and w not in NAME_JOINERS)]


def looks_like_name(text: str) -> bool:
    """
    "Persimmon Gap" or "Kolob Canyons", not an elevation ("150 m"), an
    all-caps area name ("TOWERS"), a note ("(closed in summer)") or the
    end of a sentence ("stations").
    """
    words = _clean_words(text)
    if not words or len(words) > 5 or text.isupper() or any(c.isdigit() for c in text):
        return False
    return all(
        w.lower() in NAME_JOINERS or (w[0].isupper() and any(c.islower() for c in w)) for w in words
    ) and any(len(w) >= 3 for w in words)


def visitor_center_labels(lines: list[TextLine], page_height: float, scale: float) -> list[dict]:
    """
    The page's visitor center labels as {"name", "x", "y", "width", "height"},
    in pixels of the image rendered at `scale` (origin at the top left).

    A label is often two lines, "Zion Canyon" above "Visitor Center": a line
    just above it that lines up with it and reads like a place name is
    joined on. Some maps print only "Visitor Center", which is kept as is.
    """

    def lined_up(a, b, height) -> bool:
        # Left edges together (left-aligned labels), or centred on each other.
        same_left = abs(a[0] - b[0]) <= height * 2
        same_middle = abs((a[0] + a[2]) / 2 - (b[0] + b[2]) / 2) <= height * 2
        return same_left or same_middle

    labels = []
    for text, box in lines:
        match = LABEL.search(text)
        if not match:
            continue
        head = text[: match.start()].strip()
        tail = text[match.end() :].strip()
        if tail and not tail.startswith("("):  # "...Visitor Center in the park": a sentence
            continue
        parts = [text[match.start() :]]
        union = list(box)
        height = box[3] - box[1]
        if looks_like_name(head):  # "Hulls Cove Visitor Center" on one line
            parts.insert(0, head)
        else:
            above = [
                (t, b)
                for t, b in lines
                if b is not box
                and -height * 0.6 <= b[1] - box[3] < height * 1.6
                and lined_up(b, box, height)
                and looks_like_name(t)
                and not LABEL.search(t)
            ]
            if above:
                t, b = min(above, key=lambda line: abs(line[1][1] - box[3]))
                parts.insert(0, t)
                union = [
                    min(union[0], b[0]),
                    min(union[1], b[1]),
                    max(union[2], b[2]),
                    max(union[3], b[3]),
                ]
        words = _clean_words(" ".join(parts))
        if not 2 <= len(words) <= 7:  # a sentence, not a label
            continue
        left, bottom, right, top = union
        labels.append(
            {
                "name": " ".join(words),
                "x": round(left * scale),
                "y": round((page_height - top) * scale),
                "width": round((right - left) * scale),
                "height": round((top - bottom) * scale),
            }
        )
    return labels


def render_pdf(pdf: bytes) -> tuple[bytes, int, int, list[dict]]:
    """The PDF's first page as a JPEG (long side MAX_SIDE), plus its visitor center labels."""
    page = pdfium.PdfDocument(pdf)[0]
    width, height = page.get_size()
    scale = MAX_SIDE / max(width, height)
    textpage = page.get_textpage()
    lines: list[TextLine] = []
    for i in range(textpage.count_rects()):
        box = textpage.get_rect(i)
        text = " ".join(textpage.get_text_bounded(*box).split())
        if text:
            lines.append((text, box))
    image = page.render(scale=scale).to_pil().convert("RGB")
    return _jpeg(image), image.width, image.height, visitor_center_labels(lines, height, scale)


def fetch_map(client: httpx.Client, asset_id: str) -> tuple[bytes, int, int, list[dict]] | None:
    """A map's image, size and labels: from its PDF if it has one, else its JPEG."""
    response = client.get(f"{NPGALLERY}/GetAsset/{asset_id}/original")
    response.raise_for_status()
    if response.headers.get("content-type", "").startswith("application/pdf"):
        return render_pdf(response.content)
    response = client.get(f"{NPGALLERY}/GetAsset/{asset_id}/proxyhires")
    response.raise_for_status()
    if not response.headers.get("content-type", "").startswith("image/"):
        return None
    image, width, height = shrink(response.content)
    return image, width, height, []


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
        # New, or stored before labels were read: (re)made from the original.
        if row is None or row.labels is None:
            fetched = fetch_map(client, picked["id"])
            if fetched is None:
                continue
            if row is None:
                row = BrochureMap(site_id=site_id, asset_id=picked["id"])
            row.image, row.width, row.height, row.labels = fetched
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
    centers = sum(len(row.labels or []) for row in kept)
    return (
        f", {len(kept)} brochure map{'s' if len(kept) != 1 else ''}"
        f" ({centers} visitor center label{'s' if centers != 1 else ''})"
    )
