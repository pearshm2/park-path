"""
Tests for the NPS sync job. None of these call the real NPS API: they use
fake NPS-shaped data, so they run in CI with no API key or internet.
The upsert tests need Postgres, like the auth tests.
"""

import uuid

import httpx
import pytest
from sqlalchemy import delete, select

from app.database import SessionLocal
from app.models import Site
from app.nps_sync import fetch_all_parks, transform_all, transform_park, upsert_sites


def fake_nps_park(park_code: str, name: str = "Test Park") -> dict:
    """A trimmed-down record in the same shape the NPS API returns."""
    return {
        "parkCode": park_code,
        "fullName": name,
        "designation": "National Park",
        "states": "UT",
        "latitude": "37.29839254",
        "longitude": "-113.0265138",
        "description": "A test park.",
        "url": f"https://www.nps.gov/{park_code}/index.htm",
        "images": [{"url": f"https://www.nps.gov/{park_code}/photo.jpg"}],
    }


# --- transform -------------------------------------------------------------


def test_transform_maps_nps_fields():
    row = transform_park(fake_nps_park("zion", "Zion National Park"))
    assert row == {
        "park_code": "zion",
        "name": "Zion National Park",
        "designation": "National Park",
        "states": "UT",
        "latitude": 37.29839254,
        "longitude": -113.0265138,
        "description": "A test park.",
        "nps_url": "https://www.nps.gov/zion/index.htm",
        "image_url": "https://www.nps.gov/zion/photo.jpg",
    }


def test_transform_handles_blank_coordinates_and_no_images():
    raw = fake_nps_park("abcd") | {"latitude": "", "longitude": "", "images": []}
    row = transform_park(raw)
    assert row["latitude"] is None
    assert row["longitude"] is None
    assert row["image_url"] is None


def test_transform_skips_records_missing_code_or_name():
    assert transform_park(fake_nps_park("")) is None
    assert transform_park(fake_nps_park("abcd", name="")) is None


def test_transform_all_drops_duplicate_codes():
    rows = transform_all([fake_nps_park("abcd", "First"), fake_nps_park("abcd", "Second")])
    assert len(rows) == 1
    assert rows[0]["name"] == "Second"


# --- fetch (fake HTTP, no internet) ----------------------------------------


def test_fetch_reads_every_page():
    all_parks = [fake_nps_park(f"p{i:03d}") for i in range(120)]  # 3 pages of 50

    def fake_nps_api(request: httpx.Request) -> httpx.Response:
        assert request.headers["X-Api-Key"] == "fake-key"
        start = int(request.url.params["start"])
        limit = int(request.url.params["limit"])
        page = all_parks[start : start + limit]
        return httpx.Response(200, json={"total": "120", "data": page})

    client = httpx.Client(transport=httpx.MockTransport(fake_nps_api))
    parks = fetch_all_parks("fake-key", client=client)
    assert len(parks) == 120


# --- upsert (real Postgres) ------------------------------------------------


@pytest.fixture
def test_codes():
    """Unique park codes for one test, deleted afterwards."""
    codes = [f"t{uuid.uuid4().hex[:8]}" for _ in range(2)]
    yield codes
    with SessionLocal() as db:
        db.execute(delete(Site).where(Site.park_code.in_(codes)))
        db.commit()


def _rows_for(db, codes):
    return db.scalars(select(Site).where(Site.park_code.in_(codes))).all()


def test_upsert_is_idempotent(test_codes):
    rows = transform_all([fake_nps_park(code) for code in test_codes])
    with SessionLocal() as db:
        upsert_sites(db, rows)
        upsert_sites(db, rows)  # running the sync twice...
        assert len(_rows_for(db, test_codes)) == 2  # ...must not create duplicates


def test_upsert_updates_changed_nps_data(test_codes):
    code = test_codes[0]
    with SessionLocal() as db:
        upsert_sites(db, transform_all([fake_nps_park(code, "Old Name")]))
        upsert_sites(db, transform_all([fake_nps_park(code, "New Name")]))
        site = db.scalars(select(Site).where(Site.park_code == code)).one()
        db.refresh(site)
        assert site.name == "New Name"


def test_upsert_keeps_curated_fields(test_codes):
    code = test_codes[0]
    with SessionLocal() as db:
        upsert_sites(db, transform_all([fake_nps_park(code)]))

        # A teammate hand-enters curated data...
        site = db.scalars(select(Site).where(Site.park_code == code)).one()
        site.terrain_group = "canyon"
        site.effort = 3
        site.seasons = ["spring", "fall"]
        db.commit()

        # ...then the sync runs again.
        upsert_sites(db, transform_all([fake_nps_park(code)]))
        db.refresh(site)
        assert site.terrain_group == "canyon"
        assert site.effort == 3
        assert site.seasons == ["spring", "fall"]
