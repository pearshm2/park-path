"""
Tests for the park map sync's transform step (pure, no network) and for
GET /sites/{park_code}/map (needs a real Postgres, like the other API
tests; each test adds its own site and deletes it afterwards).
"""

import io
import uuid

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import delete

from app.brochure_maps import (
    looks_like_name,
    parse_search_page,
    pick_maps,
    render_pdf,
    shrink,
    visitor_center_labels,
)
from app.database import SessionLocal
from app.main import app
from app.models import BrochureMap, Site
from app.park_map_sync import (
    save_park_map,
    trail_uses,
    transform_park,
    transform_places,
    transform_roads,
    transform_trails,
    unit_codes,
)

client = TestClient(app)


def line(coords, **props):
    return {
        "type": "Feature",
        "properties": props,
        "geometry": {"type": "LineString", "coordinates": coords},
    }


# --- transform ---------------------------------------------------------------


def test_unit_codes():
    assert unit_codes("zion") == ["ZION"]
    assert unit_codes("seki") == ["SEQU", "KICA"]


@pytest.mark.parametrize(
    ("raw", "uses"),
    [
        ("Hiker/Pedestrian", ["hike"]),
        ("Hike | PackOrSaddle", ["hike", "horse"]),
        ("Hiker / Pedestrian | Bicycle", ["hike", "bike"]),
        ("Hiker/Pedestrian|All-Terrain Vehicle", ["hike", "motorized"]),
        ("Unknown", []),
        (None, []),
    ],
)
def test_trail_uses_normalised(raw, uses):
    assert trail_uses(raw) == uses


def test_trail_segments_merge_and_named_trails_sort_first():
    trails = transform_trails(
        [
            line([[-113.0, 37.2], [-113.0, 37.21]], TRLNAME="Watchman Trail", TRLUSE="Hike"),
            line([[-113.1, 37.3], [-113.1, 37.31]], TRLNAME=" ", TRLUSE="Hike"),
            line([[-113.0, 37.21], [-113.0, 37.22]], TRLNAME="Watchman Trail", TRLUSE="Hike"),
            line([[-113.2, 37.4], [-113.2, 37.41]], TRLNAME="Angels Landing", TRLUSE="Hike"),
        ]
    )
    assert [t["name"] for t in trails] == ["Angels Landing", "Watchman Trail", None]
    watchman = trails[1]
    assert len(watchman["paths"]) == 2
    # Two 0.01° segments of latitude, ~0.69 miles each.
    assert watchman["length_miles"] == pytest.approx(1.4, abs=0.05)


def test_name_falls_back_to_map_label():
    trails = transform_trails(
        [
            line([[0, 0], [0, 1]], TRLNAME=None, MAPLABEL="Jordan Pond Path"),
            line([[0, 0], [1, 0]], TRLNAME="Unknown", MAPLABEL=" ", TRLALTNAME="Ocean Path"),
        ]
    )
    assert [t["name"] for t in trails] == ["Jordan Pond Path", "Ocean Path"]


def test_trail_fields_cleaned():
    (trail,) = transform_trails(
        [
            line(
                [[-113.123456, 37.654321], [-113.0, 37.6]],
                TRLNAME="Pa'rus Trail",
                TRLUSE="Hiker/Pedestrian | Bicycle",
                TRLSURFACE="Unknown",
                TRLSTATUS="Temporarily Closed",
            )
        ]
    )
    assert trail["uses"] == ["hike", "bike"]
    assert trail["surface"] is None
    assert trail["closed"] is True
    assert trail["paths"][0][0] == [-113.12346, 37.65432]  # rounded to 5 places


def test_multilinestring_and_degenerate_lines():
    (trail,) = transform_trails(
        [
            {
                "properties": {"TRLNAME": "Loop"},
                "geometry": {
                    "type": "MultiLineString",
                    "coordinates": [[[0, 0], [0, 1]], [[1, 1]], [[1, 1], [2, 2]]],
                },
            },
            {"properties": {"TRLNAME": "Loop"}, "geometry": None},
        ]
    )
    assert len(trail["paths"]) == 2  # the one-point line is dropped


def test_road_kinds():
    roads = transform_roads(
        [
            line([[0, 0], [0, 1]], RDNAME="Zion-Mt. Carmel Hwy", RDCLASS="Primary"),
            line([[0, 0], [1, 0]], RDNAME="Kolob Terrace Rd", RDCLASS="Local"),
            line([[0, 0], [1, 1]], RDNAME=None, RDCLASS="Unknown"),
        ]
    )
    assert {(r["name"], r["kind"]) for r in roads} == {
        ("Zion-Mt. Carmel Hwy", "primary"),
        ("Kolob Terrace Rd", "local"),
        (None, "local"),
    }


def test_boundary_rings_and_empty_park():
    square = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]
    park = transform_park(
        {
            "boundary": [
                {"geometry": {"type": "MultiPolygon", "coordinates": [[square], [square]]}}
            ],
            "roads": [],
            "trails": [],
        }
    )
    assert len(park["boundary"]) == 2
    assert park["trails"] == []
    assert transform_park({"boundary": [], "roads": [], "trails": []}) is None


# --- GET /sites/{park_code}/map ---------------------------------------------


@pytest.fixture
def site():
    code = f"t{uuid.uuid4().hex[:8]}"
    with SessionLocal() as db:
        row = Site(park_code=code, name="Test Park", is_named_park=True)
        db.add(row)
        db.commit()
        site_id = row.id
    yield code, site_id
    with SessionLocal() as db:
        db.execute(delete(Site).where(Site.park_code == code))
        db.commit()


def test_map_404_until_synced(site):
    code, _ = site
    assert client.get(f"/sites/{code}/map").status_code == 404
    assert client.get("/sites/nope-not-a-park/map").status_code == 404


def test_map_served_after_sync(site):
    code, site_id = site
    park_map = transform_park(
        {
            "boundary": [
                {"geometry": {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]}}
            ],
            "roads": [line([[0, 0], [0, 1]], RDNAME="Scenic Dr", RDCLASS="Secondary")],
            "trails": [line([[0, 0], [0.01, 0]], TRLNAME="Rim Trail", TRLUSE="Hike")],
        }
    )
    with SessionLocal() as db:
        save_park_map(db, site_id, park_map)
        save_park_map(db, site_id, park_map)  # re-syncing replaces, never duplicates

    body = client.get(f"/sites/{code.upper()}/map").json()
    assert body["park_code"] == code
    assert body["official_map_url"] == f"https://www.nps.gov/{code}/planyourvisit/maps.htm"
    assert body["trails"][0]["name"] == "Rim Trail"
    assert body["trails"][0]["uses"] == ["hike"]
    assert body["roads"][0]["kind"] == "secondary"
    assert len(body["boundary"]) == 1


# --- visitor centers ---------------------------------------------------------


def point(lon, lat, **props):
    return {"properties": props, "geometry": {"type": "Point", "coordinates": [lon, lat]}}


def test_visitor_centers_from_gis_and_nps_api():
    places = transform_places(
        [
            point(-112.98657, 37.20005, POINAME="Zion Canyon"),
            point(-113.2, 37.45, POINAME=None, MAPLABEL="Kolob Canyons Visitor Center"),
            point(-113.3, 37.5),
        ],
        [
            # Within a quarter mile of the GIS point: the same place, skipped.
            {"name": "Zion Canyon Visitor Center", "latitude": "37.2003", "longitude": "-112.9868"},
            {"name": "Valley Visitor Center", "latitude": "37.7489", "longitude": "-119.5874"},
            {"name": "No coordinates", "latitude": "", "longitude": ""},
        ],
    )
    assert [p["name"] for p in places] == [
        "Zion Canyon",
        "Kolob Canyons Visitor Center",
        "Visitor Center",
        "Valley Visitor Center",
    ]
    assert places[0] == {
        "name": "Zion Canyon",
        "kind": "visitor_center",
        "point": [-112.98657, 37.20005],
    }


# --- brochure maps -------------------------------------------------------------


def test_parse_search_page():
    page = (
        '<script>var x = {"Fields": ["Title"], "UnfilteredCount": 1, "Results": '
        '[{"Asset": {"AssetID": "abc", "Title": "Park Map  - Zion National Park"}}]};</script>'
    )
    assert parse_search_page(page) == [{"id": "abc", "title": "Park Map  - Zion National Park"}]
    assert parse_search_page("<html>no results here</html>") == []


def test_pick_maps():
    def assets(*titles):
        return [{"id": str(i), "title": f"{t}  - Some Park"} for i, t in enumerate(titles)]

    assert pick_maps(assets("Locator Globe", "Area Map", "Park Map", "Park Map")) == [
        {"id": "2", "title": "Park Map"},
        {"id": "1", "title": "Area Map"},
    ]
    picked = pick_maps(assets("Park Map, East Unit", "Park Map, West Unit", "Campground Map"))
    assert [m["title"] for m in picked] == ["Park Map, East Unit", "Park Map, West Unit"]
    assert pick_maps(assets("Locator Globe", "Wayside Exhibit")) == []


def test_shrink_keeps_aspect_and_caps_long_side():
    big = io.BytesIO()
    Image.new("RGB", (5000, 4000), "white").save(big, "JPEG")
    jpeg, width, height = shrink(big.getvalue())
    assert (width, height) == (2400, 1920)
    assert Image.open(io.BytesIO(jpeg)).size == (2400, 1920)


def test_brochure_served_and_listed(site):
    code, site_id = site
    with SessionLocal() as db:
        save_park_map(
            db,
            site_id,
            transform_park(
                {"boundary": [], "roads": [], "trails": [line([[0, 0], [0, 1]], TRLNAME="Rim")]}
            ),
        )
        db.add(
            BrochureMap(
                site_id=site_id,
                asset_id="abc",
                position=0,
                title="Park Map",
                width=10,
                height=8,
                image=b"\xff\xd8fake-jpeg",
                labels=[{"name": "Rim Visitor Center", "x": 1, "y": 2, "width": 3, "height": 1}],
            )
        )
        db.commit()

    listed = client.get(f"/sites/{code}/map").json()["brochures"]
    assert listed == [
        {
            "title": "Park Map",
            "url": f"/sites/{code}/brochures/0",
            "width": 10,
            "height": 8,
            "visitor_centers": [
                {"name": "Rim Visitor Center", "x": 1, "y": 2, "width": 3, "height": 1}
            ],
        }
    ]
    image = client.get(f"/sites/{code}/brochures/0")
    assert image.status_code == 200
    assert image.headers["content-type"] == "image/jpeg"
    assert image.content == b"\xff\xd8fake-jpeg"
    assert client.get(f"/sites/{code}/brochures/1").status_code == 404


# --- visitor center labels on the brochure ----------------------------------------


def test_labels_join_the_line_above_and_skip_sentences():
    # PDF points, origin bottom-left, on a 1000 pt tall page; drawn at 2x.
    lines = [
        ("Zion Canyon", (690, 207, 790, 217)),
        ("Visitor Center", (693, 197, 760, 206)),
        ("Hulls Cove Visitor Center", (100, 500, 200, 508)),
        ("Island in the Sky Visitor Center", (100, 400, 260, 408)),
        ("y Visitor Center", (98, 813, 157, 820)),  # stray letter from the line above
        ("Kolob Canyons ii", (95, 819, 160, 828)),  # "ii": a map icon read as text
        ("road navigation. Buy maps at visitor center.", (300, 80, 500, 90)),
        ("Maps are free at every Visitor Center in the park, ask a ranger", (300, 60, 600, 70)),
    ]
    labels = visitor_center_labels(lines, page_height=1000, scale=2)
    assert [label["name"] for label in labels] == [
        "Zion Canyon Visitor Center",
        "Hulls Cove Visitor Center",
        "Island in the Sky Visitor Center",
        "Kolob Canyons Visitor Center",
    ]
    # Both lines' box, flipped to top-left pixels: x 690 * 2, y (1000 - 217) * 2.
    assert labels[0] == {
        "name": "Zion Canyon Visitor Center",
        "x": 1380,
        "y": 1566,
        "width": 200,
        "height": 40,
    }


def _pdf_with_text(lines: list[tuple[str, int, int]], width: int = 600, height: int = 400) -> bytes:
    """A minimal one-page PDF with Helvetica text at (x, y) points; pdfium fixes the xref."""
    text = " ".join(f"BT /F1 10 Tf {x} {y} Td ({s}) Tj ET" for s, x, y in lines)
    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {width} {height}] "
        "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        f"<< /Length {len(text)} >>\nstream\n{text}\nendstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    body = "".join(f"{i} 0 obj\n{o}\nendobj\n" for i, o in enumerate(objects, start=1))
    return f"%PDF-1.4\n{body}trailer\n<< /Root 1 0 R /Size 6 >>\n%%EOF\n".encode()


def test_render_pdf_finds_labels_where_they_are_drawn():
    pdf = _pdf_with_text([("Zion Canyon", 100, 212), ("Visitor Center", 100, 200)])
    jpeg, width, height, labels = render_pdf(pdf)
    # 600 x 400 pt page, long side drawn at 2400 px: 4 px per point.
    assert (width, height) == (2400, 1600)
    assert Image.open(io.BytesIO(jpeg)).size == (2400, 1600)
    assert [label["name"] for label in labels] == ["Zion Canyon Visitor Center"]
    assert abs(labels[0]["x"] - 100 * 4) < 12
    # The label's top is the upper line's cap height, ~222 pt up the page.
    assert abs(labels[0]["y"] - (400 - 222) * 4) < 40


@pytest.mark.parametrize(
    ("text", "is_name"),
    [
        ("Persimmon Gap", True),
        ("Kolob Canyons ii", True),  # a map icon read as "ii"
        ("Gates of the Arctic", True),
        ("Island in the Sky", True),
        ("150 m", False),
        ("5ft", False),
        ("TOWERS", False),
        ("(closed in summer)", False),
        ("stations", False),
        ("U", False),
    ],
)
def test_looks_like_name(text, is_name):
    assert looks_like_name(text) is is_name


def test_label_without_a_name_stays_plain():
    # Arches prints just "Visitor Center"; an elevation and an all-caps area
    # name sit nearby but aren't its name.
    lines = [
        ("Visitor Center", (259, 159, 324, 166)),
        ("124", (311, 169, 319, 173)),
        ("TOWERS", (319, 168, 351, 174)),
    ]
    (label,) = visitor_center_labels(lines, page_height=1000, scale=1)
    assert label["name"] == "Visitor Center"


def test_name_must_line_up_with_the_label():
    lines = [
        ("Visitor Center", (500, 100, 560, 107)),
        ("Far Away Place", (200, 108, 260, 116)),  # just above, but well to the left
        ("Rio Grande Village", (498, 108, 590, 116)),  # just above and left-aligned
    ]
    (label,) = visitor_center_labels(lines, page_height=1000, scale=1)
    assert label["name"] == "Rio Grande Village Visitor Center"
