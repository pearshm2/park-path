"""
Quiz and snooze tests: saving and reading back quiz answers, and setting
parks aside with "Not for now". Like the other API tests these need a real
Postgres (DATABASE_URL); snoozing relies on Postgres's ON CONFLICT.

Each test gets fresh users and its own sites with unique park codes, and
deletes them afterwards; quiz answers and snoozes go with them.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, update

from app.database import SessionLocal
from app.main import app
from app.models import Site, Snooze, User
from tests.helpers import new_names

client = TestClient(app)

ANSWERS = {
    "terrains": ["mountain", "coast"],
    "seasons": ["fall"],
    "crowds": "quiet",
    "zip": "80302",
}


class Person:
    def __init__(self):
        email = f"quiz-{uuid.uuid4().hex[:10]}@example.com"
        resp = client.post(
            "/auth/signup",
            json={"email": email, "password": "correct-horse", **new_names()},
        )
        self.headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
        self.id = client.get("/auth/me", headers=self.headers).json()["id"]

    def get(self, path: str):
        return client.get(path, headers=self.headers)

    def put(self, path: str, body=None):
        return client.put(path, json=body, headers=self.headers)

    def delete(self, path: str):
        return client.delete(path, headers=self.headers)

    def snoozed(self) -> list[str]:
        resp = self.get("/snoozes")
        assert resp.status_code == 200
        return [item["park_code"] for item in resp.json()]


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
def codes():
    """Two test sites; returns their park codes."""
    made = [f"t{uuid.uuid4().hex[:8]}" for _ in range(2)]
    with SessionLocal() as db:
        db.add_all(Site(park_code=code, name=f"Test Site {code}") for code in made)
        db.commit()

    yield made

    with SessionLocal() as db:
        db.execute(delete(Site).where(Site.park_code.in_(made)))
        db.commit()


def test_requires_login():
    assert client.get("/quiz").status_code == 401
    assert client.put("/quiz", json=ANSWERS).status_code == 401
    assert client.delete("/quiz").status_code == 401
    assert client.get("/snoozes").status_code == 401
    assert client.put("/snoozes/zion").status_code == 401
    assert client.delete("/snoozes/zion").status_code == 401


# --- Quiz ---------------------------------------------------------------------


def test_no_quiz_to_start(people):
    resp = people().get("/quiz")
    assert resp.status_code == 200
    assert resp.json() is None


def test_save_and_read_back(people):
    ann = people()
    assert ann.put("/quiz", ANSWERS).json() == ANSWERS
    assert ann.get("/quiz").json() == ANSWERS


def test_saving_again_replaces(people):
    ann = people()
    ann.put("/quiz", ANSWERS)
    changed = {**ANSWERS, "crowds": "icons", "zip": None}
    ann.put("/quiz", changed)
    assert ann.get("/quiz").json() == changed


def test_zip_can_be_left_out(people):
    ann = people()
    without = {k: v for k, v in ANSWERS.items() if k != "zip"}
    assert ann.put("/quiz", without).json()["zip"] is None


@pytest.mark.parametrize(
    "bad",
    [
        {**ANSWERS, "terrains": []},
        {**ANSWERS, "terrains": ["mountain", "mountain"]},
        {**ANSWERS, "crowds": "sometimes"},
        {**ANSWERS, "zip": "8030"},
    ],
)
def test_bad_answers_are_422(people, bad):
    assert people().put("/quiz", bad).status_code == 422


def test_forget(people):
    ann = people()
    ann.put("/quiz", ANSWERS)
    assert ann.delete("/quiz").status_code == 204
    assert ann.get("/quiz").json() is None


def test_answers_in_an_old_shape_read_as_none(people):
    ann = people()
    with SessionLocal() as db:
        db.execute(update(User).where(User.id == ann.id).values(quiz_answers={"season": "fall"}))
        db.commit()
    assert ann.get("/quiz").json() is None


def test_each_person_has_their_own_quiz(people):
    ann, bob = people(), people()
    ann.put("/quiz", ANSWERS)
    assert bob.get("/quiz").json() is None


# --- Snoozes ------------------------------------------------------------------


def test_nothing_snoozed_to_start(people):
    assert people().snoozed() == []


def test_snooze_for_30_days(people, codes):
    ann = people()
    resp = ann.put(f"/snoozes/{codes[0]}")
    assert resp.status_code == 200
    assert resp.json()["park_code"] == codes[0]
    until = datetime.fromisoformat(resp.json()["until"])
    assert abs(until - (datetime.now(UTC) + timedelta(days=30))) < timedelta(minutes=1)
    assert ann.snoozed() == [codes[0]]


def test_carried_over_until_is_kept_but_capped(people, codes):
    ann = people()
    soon = datetime.now(UTC) + timedelta(days=3)
    kept = ann.put(f"/snoozes/{codes[0]}", {"until": soon.isoformat()}).json()
    assert datetime.fromisoformat(kept["until"]) == soon

    far = datetime.now(UTC) + timedelta(days=400)
    capped = ann.put(f"/snoozes/{codes[1]}", {"until": far.isoformat()}).json()
    assert datetime.fromisoformat(capped["until"]) < datetime.now(UTC) + timedelta(days=31)


def test_snoozing_again_keeps_one_row(people, codes):
    ann = people()
    ann.put(f"/snoozes/{codes[0]}", {"until": (datetime.now(UTC) + timedelta(days=1)).isoformat()})
    later = ann.put(f"/snoozes/{codes[0]}").json()["until"]
    assert [item["until"] for item in ann.get("/snoozes").json()] == [later]


def test_expired_snoozes_are_not_listed(people, codes):
    ann = people()
    ann.put(f"/snoozes/{codes[0]}")
    ann.put(f"/snoozes/{codes[1]}")
    with SessionLocal() as db:
        db.execute(
            update(Snooze)
            .where(Snooze.user_id == ann.id)
            .where(Snooze.site_id == Site.id, Site.park_code == codes[0])
            .values(until=datetime.now(UTC) - timedelta(minutes=1))
        )
        db.commit()
    assert ann.snoozed() == [codes[1]]


def test_unsnooze(people, codes):
    ann = people()
    ann.put(f"/snoozes/{codes[0]}")
    assert ann.delete(f"/snoozes/{codes[0]}").status_code == 204
    assert ann.snoozed() == []
    # Bringing back a park that wasn't set aside is fine too.
    assert ann.delete(f"/snoozes/{codes[1]}").status_code == 204


def test_unknown_site_is_404(people):
    ann = people()
    assert ann.put("/snoozes/nope-not-a-park").status_code == 404
    assert ann.delete("/snoozes/nope-not-a-park").status_code == 404


def test_each_person_sees_only_their_own_snoozes(people, codes):
    ann, bob = people(), people()
    ann.put(f"/snoozes/{codes[0]}")
    bob.put(f"/snoozes/{codes[1]}")
    assert ann.snoozed() == [codes[0]]
    bob.delete(f"/snoozes/{codes[0]}")
    assert ann.snoozed() == [codes[0]]
