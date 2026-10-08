"""
Tests for GET /sites and the curated-data job. Like the auth tests, these
need a real reachable Postgres (DATABASE_URL).

Each test creates its own sites with unique park codes and deletes them
afterwards, so they don't depend on (or disturb) synced NPS data.
"""

import json
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.curate_sites import CURATED_PATH, apply_curated
from app.database import SessionLocal
from app.main import app
from app.models import Site

client = TestClient(app)


@pytest.fixture
def sites():
    """A national park and a monument, deleted afterwards."""
    park = Site(
        park_code=f"t{uuid.uuid4().hex[:8]}",
        name="Test National Park",
        designation="National Park & Preserve",
        states="UT,AZ",
        latitude=37.3,
        longitude=-113.0,
        is_named_park=True,
        terrain_group="canyon",
        effort=3,
        seasons=["spring", "fall"],
    )
    monument = Site(
        park_code=f"t{uuid.uuid4().hex[:8]}",
        name="Test National Monument",
        designation="National Monument",
        states="NM",
        latitude=35.0,
        longitude=-106.0,
    )
    with SessionLocal() as db:
        db.add_all([park, monument])
        db.commit()
        codes = {"park": park.park_code, "monument": monument.park_code}
    yield codes
    with SessionLocal() as db:
        db.execute(delete(Site).where(Site.park_code.in_(codes.values())))
        db.commit()


def _codes(response) -> set[str]:
    return {site["park_code"] for site in response.json()}


def test_list_all_sites_includes_both(sites):
    response = client.get("/sites")
    assert response.status_code == 200
    assert {sites["park"], sites["monument"]} <= _codes(response)


def test_list_parks_scope_uses_curated_flag(sites):
    # The park's designation isn't exactly "National Park"; the flag decides.
    response = client.get("/sites", params={"scope": "parks"})
    assert response.status_code == 200
    codes = _codes(response)
    assert sites["park"] in codes
    assert sites["monument"] not in codes


def test_list_rejects_unknown_scope():
    assert client.get("/sites", params={"scope": "everything"}).status_code == 422


def test_uncurated_fields_come_back_null(sites):
    response = client.get(f"/sites/{sites['monument']}")
    assert response.status_code == 200
    body = response.json()
    assert body["is_named_park"] is False
    assert body["terrain_group"] is None
    assert body["seasons"] is None


def test_read_site(sites):
    response = client.get(f"/sites/{sites['park']}")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Test National Park"
    assert body["seasons"] == ["spring", "fall"]


def test_read_missing_site_is_404():
    assert client.get("/sites/nope-not-a-code").status_code == 404


# --- curated-data job ------------------------------------------------------


def test_apply_curated_writes_curated_columns_only(sites):
    code = sites["monument"]
    row = {
        "park_code": code,
        "is_named_park": False,
        "terrain_group": "desert",
        "feature": "Pueblo ruins",
        "effort": 1,
        "typical_days": 1,
        "seasons": ["spring"],
        "permit_required": False,
        "annual_visits_millions": 0.2,
    }
    with SessionLocal() as db:
        assert apply_curated(db, [row]) == []
        apply_curated(db, [row])  # running it twice is harmless
        site = db.scalars(select(Site).where(Site.park_code == code)).one()
        assert site.terrain_group == "desert"
        assert site.seasons == ["spring"]
        assert site.name == "Test National Monument"  # NPS data untouched


def test_apply_curated_reports_unknown_codes():
    with SessionLocal() as db:
        assert apply_curated(db, [{"park_code": "zzzz-missing"}]) == ["zzzz-missing"]


def test_curated_file_is_well_formed():
    rows = json.loads(CURATED_PATH.read_text(encoding="utf-8"))
    codes = [row["park_code"] for row in rows]
    assert len(codes) == len(set(codes)), "duplicate park codes"
    # 63 national parks, but Sequoia & Kings Canyon is one NPS unit.
    assert sum(row["is_named_park"] for row in rows) == 62
    # Every code must be a real NPS site, or the job silently skips it.
    snapshot = json.loads((CURATED_PATH.parent / "nps_snapshot.json").read_text(encoding="utf-8"))
    assert set(codes) <= {site["park_code"] for site in snapshot}
    for row in rows:
        assert row["effort"] in (1, 2, 3)
        assert set(row["seasons"]) <= {"winter", "spring", "summer", "fall"}
