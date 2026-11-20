"""
Tests for three safety rules:

- Other people's emails never appear in any response about them (friend
  requests, the friends list, profiles, the feed, tagged companions,
  comments, Activity, a friend's passport). Only /auth/me shows your own.
- Passwords must be 8 characters to 72 bytes (bcrypt ignores anything
  past 72 bytes, so longer ones are refused rather than silently cut).
- Repeated failed sign-ins get 429 Too Many Requests.

Like the other API tests these need a real Postgres (DATABASE_URL).
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.database import SessionLocal
from app.main import app
from app.models import Site, User
from app.rate_limit import FailureLimiter, login_failures_by_email, login_failures_by_ip
from tests.helpers import new_names

client = TestClient(app)


class Person:
    def __init__(self):
        self.email = f"privacy-{uuid.uuid4().hex[:10]}@example.com"
        self.password = "correct-horse"
        resp = client.post(
            "/auth/signup",
            json={"email": self.email, "password": self.password, **new_names()},
        )
        assert resp.status_code == 201, resp.text
        self.headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
        self.id = client.get("/auth/me", headers=self.headers).json()["id"]


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


@pytest.fixture(autouse=True)
def fresh_limits():
    """Every test starts with no failed sign-ins counted."""
    login_failures_by_email.clear()
    login_failures_by_ip.clear()
    yield
    login_failures_by_email.clear()
    login_failures_by_ip.clear()


# --- other people's emails --------------------------------------------------


def test_no_response_about_someone_else_includes_their_email(people, code):
    ann, bob = people(), people()

    # A friend request, from both sides, before it's accepted.
    sent = client.post("/friends/requests", json={"email": bob.email}, headers=ann.headers)
    assert sent.status_code == 201
    incoming = client.get("/friends/requests?direction=incoming", headers=bob.headers)
    outgoing = client.get("/friends/requests?direction=outgoing", headers=ann.headers)
    accepted = client.post(f"/friends/requests/{sent.json()['id']}/accept", headers=bob.headers)

    # Ann logs a trip with Bob tagged; Bob comments on it.
    trip = client.post(
        "/trips",
        json={"park_code": code, "visited_on": "2024-06-12", "companion_ids": [bob.id]},
        headers=ann.headers,
    )
    assert trip.status_code == 201, trip.text
    trip_id = trip.json()["id"]
    comment = client.post(
        f"/trips/{trip_id}/comments", json={"body": "Great day"}, headers=bob.headers
    )
    assert comment.status_code == 201

    # What each sees of the other: none of it may carry the other's email.
    about_bob = [
        sent,
        outgoing,
        client.get("/friends", headers=ann.headers),
        client.get(f"/friends/{bob.id}", headers=ann.headers),
        client.get(f"/trips/{trip_id}", headers=ann.headers),  # Bob as companion
        client.get(f"/trips/{trip_id}/comments", headers=ann.headers),  # Bob as author
        client.get("/trips/activity", headers=ann.headers),  # Bob's comment
    ]
    about_ann = [
        incoming,
        accepted,
        client.get("/friends", headers=bob.headers),
        client.get(f"/friends/{ann.id}", headers=bob.headers),
        client.get("/trips/feed", headers=bob.headers),  # Ann as owner
        client.get(f"/passport/{ann.id}", headers=bob.headers),
    ]
    for resp in about_bob:
        assert resp.status_code in (200, 201), (resp.request.url, resp.text)
        assert bob.email.lower() not in resp.text.lower(), resp.request.url
    for resp in about_ann:
        assert resp.status_code in (200, 201), (resp.request.url, resp.text)
        assert ann.email.lower() not in resp.text.lower(), resp.request.url

    # The names people are shown by are still there.
    friend = client.get("/friends", headers=ann.headers).json()[0]["user"]
    assert friend["id"] == bob.id and friend["username"] and friend["first_name"]

    # Your own account still shows your own email.
    assert client.get("/auth/me", headers=ann.headers).json()["email"] == ann.email


# --- password length ---------------------------------------------------------


def _signup(password: str):
    return client.post(
        "/auth/signup",
        json={
            "email": f"pw-{uuid.uuid4().hex[:10]}@example.com",
            "password": password,
            **new_names(),
        },
    )


def test_signup_password_must_be_8_characters_to_72_bytes():
    assert _signup("short").status_code == 422
    assert _signup("x" * 72).status_code == 201
    assert _signup("x" * 73).status_code == 422
    # 19 emoji are only 19 characters but 76 bytes: past what bcrypt reads.
    assert _signup("\U0001f332" * 19).status_code == 422
    assert _signup("\U0001f332" * 18).status_code == 201  # 72 bytes exactly

    with SessionLocal() as db:
        db.execute(delete(User).where(User.email.like("pw-%@example.com")))
        db.commit()


def test_new_password_has_the_same_limits(people):
    ann = people()
    too_long = client.post(
        "/auth/me/password",
        json={"current_password": ann.password, "new_password": "y" * 73},
        headers=ann.headers,
    )
    assert too_long.status_code == 422
    ok = client.post(
        "/auth/me/password",
        json={"current_password": ann.password, "new_password": "y" * 72},
        headers=ann.headers,
    )
    assert ok.status_code == 204


# --- failed sign-in limits ---------------------------------------------------


def _login(email: str, password: str, ip: str = "203.0.113.7"):
    return client.post(
        "/auth/login",
        json={"email": email, "password": password},
        headers={"X-Forwarded-For": ip},
    )


def test_too_many_wrong_passwords_locks_the_account_for_a_while(people):
    ann = people()
    for _ in range(5):
        assert _login(ann.email, "wrong-password").status_code == 401

    # Sixth try: refused without checking, even with the right password.
    blocked = _login(ann.email, ann.password)
    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) > 0
    assert "Try again" in blocked.json()["detail"]
    # The email is matched however it's capitalised.
    assert _login(ann.email.upper(), ann.password).status_code == 429


def test_a_successful_sign_in_clears_earlier_typos(people):
    ann = people()
    for _ in range(4):
        _login(ann.email, "wrong-password")
    assert _login(ann.email, ann.password).status_code == 200
    # The count started over, so four more typos are still allowed.
    for _ in range(4):
        assert _login(ann.email, "wrong-password").status_code == 401
    assert _login(ann.email, ann.password).status_code == 200


def test_one_address_trying_many_accounts_is_limited():
    # Unknown emails count too, so guessing at accounts gets cut off.
    for n in range(50):
        guess = _login(f"nobody-{n}@example.com", "guess-guess", ip="198.51.100.9")
        assert guess.status_code == 401
    assert _login("nobody-x@example.com", "guess-guess", ip="198.51.100.9").status_code == 429
    # Another address is unaffected.
    assert _login("nobody-y@example.com", "guess-guess", ip="198.51.100.10").status_code == 401


def test_failures_age_out_of_the_window():
    now = [1000.0]
    limiter = FailureLimiter(limit=2, window_seconds=60, clock=lambda: now[0])
    limiter.record_failure("k")
    limiter.record_failure("k")
    assert limiter.retry_after("k") == 61
    now[0] += 30
    assert limiter.retry_after("k") == 31
    now[0] += 31
    assert limiter.retry_after("k") is None
