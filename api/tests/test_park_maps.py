"""
Tests for the park map sync's transform step (pure, no network) and for
GET /sites/{park_code}/map (needs a real Postgres, like the other API
tests; each test adds its own site and deletes it afterwards).
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.database import SessionLocal
from app.main import app
from app.models import Site
from app.park_map_sync import (
    save_park_map,
    trail_uses,
    transform_park,
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
