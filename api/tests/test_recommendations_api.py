"""
Tests for POST /recommendations. Like the other API tests these need a real
Postgres. Each test adds its own sites with unique codes and deletes them
afterwards; any other sites in the database are simply ignored.
"""

import uuid
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.database import SessionLocal
from app.main import app
from app.models import Site, TripEntry, User
from tests.helpers import new_names

client = TestClient(app)

ANSWERS = {"terrains": ["canyon"], "seasons": ["spring", "fall"], "crowds": "either"}


@pytest.fixture
def sites():
    """A matching canyon park, a non-matching coast park, and an uncurated monument."""
    rows = {
        "match": Site(
            park_code=f"t{uuid.uuid4().hex[:8]}",
            name="Test Canyon Park",
            latitude=37.3,
            longitude=-113.0,
            terrain_group="canyon",
            feature="Slot canyon",
            seasons=["spring"],
            annual_visits_millions=2.0,
        ),
        "miss": Site(
            park_code=f"t{uuid.uuid4().hex[:8]}",
            name="Test Coast Park",
            latitude=44.3,
            longitude=-68.2,
            terrain_group="coast",
            seasons=["summer"],
            annual_visits_millions=1.0,
        ),
        "bare": Site(
            park_code=f"t{uuid.uuid4().hex[:8]}",
            name="Test Monument",
            latitude=35.0,
            longitude=-106.0,
        ),
    }
    with SessionLocal() as db:
        db.add_all(rows.values())
        db.commit()
        codes = {key: site.park_code for key, site in rows.items()}
    yield codes
    with SessionLocal() as db:
        db.execute(delete(Site).where(Site.park_code.in_(codes.values())))
        db.commit()


def _by_code(response) -> dict:
    return {row["park_code"]: row for row in response.json()}


def test_scores_every_site(sites):
    response = client.post("/recommendations", json={"answers": ANSWERS})
    assert response.status_code == 200
    rows = _by_code(response)
    assert set(sites.values()) <= set(rows)

    match = rows[sites["match"]]
    assert match["score"] == 1.0
    assert match["reason"] == "Canyon terrain, great in spring"
    assert match["signals"] == {
        "terrain": 1.0,
        "distance": None,
        "season": 1.0,
        "crowds": None,
    }
    assert match["visited"] is False
    assert rows[sites["miss"]]["score"] == 0.0
    assert rows[sites["bare"]]["score"] is None


def test_best_first_and_unscored_last(sites):
    codes = [
        row["park_code"]
        for row in client.post("/recommendations", json={"answers": ANSWERS}).json()
    ]
    assert codes.index(sites["match"]) < codes.index(sites["miss"]) < codes.index(sites["bare"])


def test_location_turns_on_distance(sites):
    body = {"answers": ANSWERS, "location": {"lat": 37.0, "lon": -113.5}}
    rows = _by_code(client.post("/recommendations", json=body))
    assert rows[sites["match"]]["signals"]["distance"] == 1.0  # close by
    assert rows[sites["miss"]]["signals"]["distance"] < 0.2  # across the country


@pytest.mark.parametrize(
    "bad_answers",
    [
        {"seasons": ["spring"], "crowds": "either"},  # terrain missing
        {"terrains": [], "seasons": ["spring"], "crowds": "either"},  # no terrain picked
        {"terrains": ["volcano"], "seasons": [], "crowds": "either"},  # not a quiz answer
        {"terrains": ["canyon"], "seasons": ["fall", "fall"], "crowds": "either"},  # repeat
        {"terrains": ["canyon"], "crowds": "either"},  # season missing
        {"terrains": ["canyon"], "seasons": [], "crowds": "sometimes"},  # bad crowds
    ],
)
def test_rejects_incomplete_or_invalid_answers(bad_answers):
    response = client.post("/recommendations", json={"answers": bad_answers})
    assert response.status_code == 422


def test_rejects_impossible_location():
    body = {"answers": ANSWERS, "location": {"lat": 120, "lon": 0}}
    assert client.post("/recommendations", json=body).status_code == 422


# --- signed in: trip history -------------------------------------------------


@pytest.fixture
def signed_in():
    """A new account's token and id, deleted afterwards (its trips go with it)."""
    email = f"rec-{uuid.uuid4().hex[:10]}@example.com"
    body = {"email": email, "password": "correct-horse", **new_names()}
    token = client.post("/auth/signup", json=body).json()["access_token"]
    with SessionLocal() as db:
        user_id = db.scalars(select(User.id).where(User.email == email)).one()
    yield token, user_id
    with SessionLocal() as db:
        db.execute(delete(User).where(User.id == user_id))
        db.commit()


def test_signed_in_history_marks_visited_and_moves_it_down(sites, signed_in):
    token, user_id = signed_in
    with SessionLocal() as db:
        site_id = db.scalars(select(Site.id).where(Site.park_code == sites["match"])).one()
        db.add(TripEntry(user_id=user_id, site_id=site_id, visited_on=date(2026, 5, 1), rating=5))
        db.commit()

    auth = {"Authorization": f"Bearer {token}"}
    rows = _by_code(client.post("/recommendations", json={"answers": ANSWERS}, headers=auth))
    match = rows[sites["match"]]
    assert match["visited"] is True
    assert match["score"] < 1.0  # was 1.0 unvisited

    anonymous = _by_code(client.post("/recommendations", json={"answers": ANSWERS}))
    assert anonymous[sites["match"]]["visited"] is False


def test_bad_token_still_gets_recommendations(sites):
    auth = {"Authorization": "Bearer not-a-real-token"}
    response = client.post("/recommendations", json={"answers": ANSWERS}, headers=auth)
    assert response.status_code == 200
