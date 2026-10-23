"""
Comments on trips, profile pictures, and changing your email or password.
Like the other API tests these need a real Postgres (DATABASE_URL).

Each test gets fresh users and a test site and deletes them afterwards;
trips and comments go with them (ON DELETE CASCADE).
"""

import base64
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.database import SessionLocal
from app.main import app
from app.models import Site, User
from tests.helpers import new_names

client = TestClient(app)

# The smallest valid-looking JPEG and PNG starts (the API checks the magic bytes).
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


class Person:
    def __init__(self):
        self.email = f"social-{uuid.uuid4().hex[:10]}@example.com"
        self.password = "correct-horse"
        resp = client.post(
            "/auth/signup",
            json={"email": self.email, "password": self.password, **new_names()},
        )
        self.headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
        self.id = client.get("/auth/me", headers=self.headers).json()["id"]

    def befriend(self, other: "Person") -> None:
        friendship_id = client.post(
            "/friends/requests", json={"email": other.email}, headers=self.headers
        ).json()["id"]
        client.post(f"/friends/requests/{friendship_id}/accept", headers=other.headers)

    def log(self, code: str, visibility: str = "friends") -> int:
        resp = client.post(
            "/trips",
            json={"park_code": code, "visited_on": "2024-06-12", "visibility": visibility},
            headers=self.headers,
        )
        assert resp.status_code == 201, resp.text
        return resp.json()["id"]

    def comment(self, trip_id: int, body: str):
        return client.post(f"/trips/{trip_id}/comments", json={"body": body}, headers=self.headers)


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
def code():
    made = f"t{uuid.uuid4().hex[:8]}"
    with SessionLocal() as db:
        db.add(Site(park_code=made, name=f"Test Site {made}", states="UT"))
        db.commit()
    yield made
    with SessionLocal() as db:
        db.execute(delete(Site).where(Site.park_code == made))
        db.commit()


# --- comments ------------------------------------------------------------------


def test_friends_comment_and_see_comments(people, code):
    ann, bob = people(), people()
    ann.befriend(bob)
    trip = ann.log(code)

    resp = bob.comment(trip, "  Looks amazing!  ")
    assert resp.status_code == 201
    body = resp.json()
    assert body["body"] == "Looks amazing!"
    assert body["author"]["id"] == bob.id
    assert "email" in body["author"]
    ann.comment(trip, "It was!")

    comments = client.get(f"/trips/{trip}/comments", headers=ann.headers).json()
    assert [c["body"] for c in comments] == ["Looks amazing!", "It was!"]

    # The count rides along with the trip, in the feed and on its own.
    feed = client.get("/trips/feed", headers=bob.headers).json()
    assert [t["comment_count"] for t in feed if t["id"] == trip] == [2]
    assert client.get(f"/trips/{trip}", headers=ann.headers).json()["comment_count"] == 2


def test_strangers_and_private_trips_are_404(people, code):
    ann, bob, cat = people(), people(), people()
    ann.befriend(bob)
    shared = ann.log(code)
    private = ann.log(code, visibility="private")

    assert cat.comment(shared, "hi").status_code == 404
    assert client.get(f"/trips/{shared}/comments", headers=cat.headers).status_code == 404
    assert bob.comment(private, "hi").status_code == 404
    # The owner can still note things on their own private trip.
    assert ann.comment(private, "note to self").status_code == 201


def test_blank_comment_rejected(people, code):
    ann = people()
    trip = ann.log(code)
    assert ann.comment(trip, "   ").status_code == 422
    assert ann.comment(trip, "x" * 1001).status_code == 422


def test_who_can_delete_a_comment(people, code):
    ann, bob, cat = people(), people(), people()
    ann.befriend(bob)
    ann.befriend(cat)
    trip = ann.log(code)
    by_bob = bob.comment(trip, "first").json()["id"]
    by_cat = cat.comment(trip, "second").json()["id"]

    # Another commenter can't delete it; its author and the trip's owner can.
    url = f"/trips/{trip}/comments/{by_bob}"
    assert client.delete(url, headers=cat.headers).status_code == 403
    assert client.delete(url, headers=bob.headers).status_code == 204
    url = f"/trips/{trip}/comments/{by_cat}"
    assert client.delete(url, headers=ann.headers).status_code == 204
    assert client.get(f"/trips/{trip}/comments", headers=ann.headers).json() == []
    assert client.delete(url, headers=ann.headers).status_code == 404


# --- profile pictures --------------------------------------------------------


def _upload(person: Person, data: bytes, content_type="image/jpeg"):
    return client.put(
        "/auth/me/avatar",
        json={"content_type": content_type, "data": base64.b64encode(data).decode()},
        headers=person.headers,
    )


def test_avatar_set_served_and_removed(people):
    ann, bob = people(), people()
    assert client.get("/auth/me", headers=ann.headers).json()["avatar_url"] is None

    resp = _upload(ann, JPEG)
    assert resp.status_code == 200
    url = resp.json()["avatar_url"]
    assert url.startswith(f"/users/{ann.id}/avatar?v=")

    # Anyone signed in can fetch it (it shows on requests and posts).
    served = client.get(url, headers=bob.headers)
    assert served.status_code == 200
    assert served.content == JPEG
    assert served.headers["content-type"] == "image/jpeg"
    assert client.get(url).status_code == 401

    assert _upload(ann, PNG, "image/png").status_code == 200
    assert client.get(f"/users/{ann.id}/avatar", headers=bob.headers).content == PNG

    gone = client.delete("/auth/me/avatar", headers=ann.headers)
    assert gone.json()["avatar_url"] is None
    assert client.get(f"/users/{ann.id}/avatar", headers=bob.headers).status_code == 404


def test_avatar_must_be_a_picture(people):
    ann = people()
    assert _upload(ann, b"not a picture at all").status_code == 422
    assert _upload(ann, PNG, "image/jpeg").status_code == 422
    bad = client.put(
        "/auth/me/avatar",
        json={"content_type": "image/jpeg", "data": "%%%not base64%%%"},
        headers=ann.headers,
    )
    assert bad.status_code == 422
    assert _upload(ann, b"\xff\xd8\xff" + b"\x00" * 300_001).status_code in (413, 422)


# --- email and password ------------------------------------------------------


def test_change_email_needs_password(people):
    ann, bob = people(), people()
    new = f"moved-{uuid.uuid4().hex[:8]}@example.com"

    no_password = client.patch("/auth/me", json={"email": new}, headers=ann.headers)
    assert no_password.status_code == 400
    wrong = client.patch(
        "/auth/me", json={"email": new, "current_password": "nope"}, headers=ann.headers
    )
    assert wrong.status_code == 400
    taken = client.patch(
        "/auth/me",
        json={"email": bob.email, "current_password": ann.password},
        headers=ann.headers,
    )
    assert taken.status_code == 409

    ok = client.patch(
        "/auth/me", json={"email": new, "current_password": ann.password}, headers=ann.headers
    )
    assert ok.status_code == 200 and ok.json()["email"] == new
    login = client.post("/auth/login", json={"email": new, "password": ann.password})
    assert login.status_code == 200


def test_change_password(people):
    ann = people()
    wrong = client.post(
        "/auth/me/password",
        json={"current_password": "nope", "new_password": "a-new-password"},
        headers=ann.headers,
    )
    assert wrong.status_code == 400
    short = client.post(
        "/auth/me/password",
        json={"current_password": ann.password, "new_password": "short"},
        headers=ann.headers,
    )
    assert short.status_code == 422

    ok = client.post(
        "/auth/me/password",
        json={"current_password": ann.password, "new_password": "a-new-password"},
        headers=ann.headers,
    )
    assert ok.status_code == 204
    old = client.post("/auth/login", json={"email": ann.email, "password": ann.password})
    assert old.status_code == 401
    new = client.post("/auth/login", json={"email": ann.email, "password": "a-new-password"})
    assert new.status_code == 200
