"""
Wishlist tests: save, list, remove, idempotency, and that each user only
sees their own. Like the other API tests these need a real Postgres
(DATABASE_URL) — saving relies on Postgres's ON CONFLICT.

Each test gets fresh users and its own sites with unique park codes, and
deletes them afterwards; wishlist rows go with them (ON DELETE CASCADE).
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.database import SessionLocal
from app.main import app
from app.models import Site, User, WishlistItem
from tests.helpers import new_names

client = TestClient(app)


class Person:
    def __init__(self):
        email = f"wish-{uuid.uuid4().hex[:10]}@example.com"
        resp = client.post(
            "/auth/signup",
            json={"email": email, "password": "correct-horse", **new_names()},
        )
        self.headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
        self.id = client.get("/auth/me", headers=self.headers).json()["id"]

    def save(self, code: str):
        return client.put(f"/wishlist/{code}", headers=self.headers)

    def remove(self, code: str):
        return client.delete(f"/wishlist/{code}", headers=self.headers)

    def codes(self) -> list[str]:
        resp = client.get("/wishlist", headers=self.headers)
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
    assert client.get("/wishlist").status_code == 401
    assert client.put("/wishlist/zion").status_code == 401
    assert client.delete("/wishlist/zion").status_code == 401


def test_empty_to_start(people):
    assert people().codes() == []


def test_save_and_list_newest_first(people, codes):
    ann = people()
    first = ann.save(codes[0])
    assert first.status_code == 200
    assert first.json()["park_code"] == codes[0]
    assert "added_at" in first.json()

    ann.save(codes[1])
    assert ann.codes() == [codes[1], codes[0]]


def test_save_twice_keeps_one_row_and_the_original_date(people, codes):
    ann = people()
    added = ann.save(codes[0]).json()["added_at"]
    again = ann.save(codes[0])
    assert again.status_code == 200
    assert again.json()["added_at"] == added
    assert ann.codes() == [codes[0]]


def test_park_code_is_case_insensitive(people, codes):
    ann = people()
    assert ann.save(codes[0].upper()).json()["park_code"] == codes[0]
    assert ann.codes() == [codes[0]]


def test_remove(people, codes):
    ann = people()
    ann.save(codes[0])
    ann.save(codes[1])
    assert ann.remove(codes[0]).status_code == 204
    assert ann.codes() == [codes[1]]


def test_remove_unsaved_site_is_fine(people, codes):
    assert people().remove(codes[0]).status_code == 204


def test_unknown_site_is_404(people):
    ann = people()
    assert ann.save("nope-not-a-park").status_code == 404
    assert ann.remove("nope-not-a-park").status_code == 404


def test_each_person_sees_only_their_own(people, codes):
    ann, bob = people(), people()
    ann.save(codes[0])
    bob.save(codes[1])
    assert ann.codes() == [codes[0]]
    assert bob.codes() == [codes[1]]

    # Removing from one list leaves the other alone.
    bob.remove(codes[0])
    assert ann.codes() == [codes[0]]


def test_deleting_a_site_removes_it_from_wishlists(people, codes):
    ann = people()
    ann.save(codes[0])
    with SessionLocal() as db:
        db.execute(delete(Site).where(Site.park_code == codes[0]))
        db.commit()
        assert db.scalars(select(WishlistItem).where(WishlistItem.user_id == ann.id)).all() == []
