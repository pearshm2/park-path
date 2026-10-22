"""
Passport tests: stamps from trips, regions, achievements and what a friend
can see. Needs a real Postgres (DATABASE_URL), like the other API tests.

The passport lists every national park in the database, so the tests make
their own parks (unique codes) and look stamps up by code instead of
assuming the list holds only theirs.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.database import SessionLocal
from app.main import app
from app.models import Site, User
from app.regions import REGION_LABELS, region_for_states

client = TestClient(app)


class Person:
    def __init__(self):
        self.email = f"pass-{uuid.uuid4().hex[:10]}@example.com"
        resp = client.post("/auth/signup", json={"email": self.email, "password": "correct-horse"})
        self.headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
        self.id = client.get("/auth/me", headers=self.headers).json()["id"]

    def befriend(self, other: "Person") -> None:
        friendship_id = client.post(
            "/friends/requests", json={"email": other.email}, headers=self.headers
        ).json()["id"]
        client.post(f"/friends/requests/{friendship_id}/accept", headers=other.headers)

    def log(self, code: str, visited_on="2024-06-12", **extra):
        body = {"park_code": code, "visited_on": visited_on, **extra}
        resp = client.post("/trips", json=body, headers=self.headers)
        assert resp.status_code == 201, resp.text
        return resp.json()

    def passport(self, user_id: int | None = None):
        path = "/passport" if user_id is None else f"/passport/{user_id}"
        return client.get(path, headers=self.headers)


def stamp(passport: dict, code: str) -> dict:
    return next(s for s in passport["stamps"] if s["park_code"] == code)


def achievement(passport: dict, id: str) -> dict:
    return next(a for a in passport["achievements"] if a["id"] == id)


@pytest.fixture
def people():
    created: list[Person] = []

    def make() -> Person:
        person = Person()
        created.append(person)
        return person

    yield make

    with SessionLocal() as db:
        db.execute(delete(User).where(User.id.in_([p.id for p in created])))
        db.commit()


@pytest.fixture
def parks():
    """Two named parks in Utah (Southwest), one in Washington (PNW), one non-park site
    (index 3), then three more named parks so the five-park milestone exists."""
    rows = [
        ("UT", True),
        ("UT", True),
        ("WA", True),
        ("UT", False),
        ("CO", True),
        ("CO", True),
        ("CO", True),
    ]
    made = [f"p{uuid.uuid4().hex[:8]}" for _ in rows]
    with SessionLocal() as db:
        db.add_all(
            Site(park_code=code, name=f"Passport Test {code}", states=states, is_named_park=named)
            for code, (states, named) in zip(made, rows, strict=True)
        )
        db.commit()

    yield made

    with SessionLocal() as db:
        db.execute(delete(Site).where(Site.park_code.in_(made)))
        db.commit()


def test_requires_login():
    assert client.get("/passport").status_code == 401
    assert client.get("/passport/1").status_code == 401


def test_a_new_passport_is_blank(people, parks):
    ann = people()
    body = ann.passport().json()
    assert body["owner"]["id"] == ann.id
    assert body["parks_visited"] == 0
    assert body["parks_total"] == len(body["stamps"]) >= 3
    for code in parks[:3]:
        assert stamp(body, code)["earned"] is False
        assert stamp(body, code)["latest_trip_id"] is None
    assert not any(a["earned"] for a in body["achievements"])


def test_only_national_parks_get_stamps(people, parks):
    ann = people()
    body = ann.passport().json()
    codes = {s["park_code"] for s in body["stamps"]}
    assert set(parks[:3]) <= codes
    assert parks[3] not in codes  # the non-park site


def test_logging_a_trip_earns_the_stamp(people, parks):
    ann = people()
    first = ann.log(parks[0], visited_on="2023-05-01")
    latest = ann.log(parks[0], visited_on="2024-08-09")
    ann.log(parks[0], visited_on="2022-01-01")

    body = ann.passport().json()
    s = stamp(body, parks[0])
    assert s["earned"] is True
    assert s["visit_count"] == 3
    assert s["first_visited_on"] == "2022-01-01"
    assert s["last_visited_on"] == "2024-08-09"
    assert s["latest_trip_id"] == latest["id"]  # tapping the stamp reopens the latest visit
    assert first["id"] != latest["id"]
    assert body["parks_visited"] == 1
    assert stamp(body, parks[1])["earned"] is False


def test_a_visit_to_a_non_park_site_does_not_stamp(people, parks):
    ann = people()
    ann.log(parks[3])
    assert ann.passport().json()["parks_visited"] == 0


def test_deleting_the_trip_takes_the_stamp_back(people, parks):
    ann = people()
    trip = ann.log(parks[0])
    assert stamp(ann.passport().json(), parks[0])["earned"] is True
    client.delete(f"/trips/{trip['id']}", headers=ann.headers)
    assert stamp(ann.passport().json(), parks[0])["earned"] is False


def test_same_day_visits_reopen_the_newest_entry(people, parks):
    ann = people()
    ann.log(parks[0], visited_on="2024-06-12")
    second = ann.log(parks[0], visited_on="2024-06-12")
    assert stamp(ann.passport().json(), parks[0])["latest_trip_id"] == second["id"]


def test_each_users_passport_is_their_own(people, parks):
    ann, bob = people(), people()
    ann.log(parks[0])
    assert stamp(bob.passport().json(), parks[0])["earned"] is False


def test_regions(people, parks):
    ann = people()
    ann.log(parks[2])  # Washington
    regions = {r["id"]: r for r in ann.passport().json()["regions"]}
    assert set(regions) == set(REGION_LABELS)
    assert regions["pnw"]["visited"] >= 1
    assert regions["pnw"]["label"] == "Pacific Northwest"
    assert regions["southwest"]["total"] >= 2
    assert regions["southwest"]["visited"] == 0 and regions["southwest"]["complete"] is False


def test_region_states():
    assert region_for_states("UT") == "southwest"
    assert region_for_states("WY,MT,ID") == "rockies"  # first state counts
    assert region_for_states("TN,NC") == "appalachia"
    assert region_for_states("AK") == "akhi"
    assert region_for_states("AS") is None  # territories have no region
    assert region_for_states(None) is None and region_for_states("") is None


def test_achievements(people, parks):
    ann, bob = people(), people()
    ann.befriend(bob)
    body = ann.passport().json()
    assert achievement(body, "first_stamp")["earned"] is False

    ann.log(parks[0], rating=5, companion_ids=[bob.id])
    ann.log(parks[0])
    body = ann.passport().json()
    assert achievement(body, "first_stamp")["earned"] is True
    assert achievement(body, "return_visitor")["earned"] is True
    assert achievement(body, "five_star")["earned"] is True
    assert achievement(body, "with_friends")["earned"] is True
    five = achievement(body, "five_parks")
    assert five["earned"] is False and five["progress"] == 1 and five["goal"] == 5
    assert achievement(body, "photographer")["progress"] == 0


# --- what a friend sees -----------------------------------------------------------


def test_a_friends_passport_counts_only_shared_trips(people, parks):
    ann, bob = people(), people()
    ann.befriend(bob)
    ann.log(parks[0], visibility="friends")
    ann.log(parks[1])  # private

    seen = bob.passport(ann.id).json()
    assert seen["owner"]["id"] == ann.id
    assert stamp(seen, parks[0])["earned"] is True
    assert stamp(seen, parks[1])["earned"] is False
    assert seen["parks_visited"] == 1
    # Her own view counts both.
    assert ann.passport().json()["parks_visited"] == 2


def test_a_friends_stamp_points_at_a_trip_you_can_open(people, parks):
    ann, bob = people(), people()
    ann.befriend(bob)
    ann.log(parks[0], visited_on="2024-01-01", visibility="friends")
    ann.log(parks[0], visited_on="2024-09-01")  # newer, but private
    shown = stamp(bob.passport(ann.id).json(), parks[0])
    assert shown["visit_count"] == 1 and shown["last_visited_on"] == "2024-01-01"
    assert client.get(f"/trips/{shown['latest_trip_id']}", headers=bob.headers).status_code == 200


def test_strangers_and_pending_requests_get_404(people, parks):
    ann, bob, stranger = people(), people(), people()
    ann.log(parks[0], visibility="friends")
    assert stranger.passport(ann.id).status_code == 404
    client.post("/friends/requests", json={"email": ann.email}, headers=bob.headers)
    assert bob.passport(ann.id).status_code == 404
    assert ann.passport(999_999_999).status_code == 404
    # Your own id is allowed and is the same as /passport.
    assert ann.passport(ann.id).json() == ann.passport().json()
