"""
Sign in with Google (POST /auth/google). Google itself isn't called: the
token check is replaced with a stand-in that returns whoever the test
says the token is for. Needs a real Postgres like the other API tests.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.config import settings
from app.database import SessionLocal
from app.google_auth import GoogleIdentity, GoogleNotConfigured, InvalidGoogleToken
from app.main import app
from app.models import User
from app.routers import auth as auth_router
from tests.helpers import new_names

client = TestClient(app)
TOKEN = "x" * 40


@pytest.fixture
def google(monkeypatch):
    """Set who the next Google token is for (or an error to raise)."""
    state: dict = {}

    def verify(token: str) -> GoogleIdentity:
        if isinstance(state.get("result"), Exception):
            raise state["result"]
        return state["result"]

    monkeypatch.setattr(auth_router, "verify_google_id_token", verify)
    return state


@pytest.fixture
def cleanup():
    emails: list[str] = []
    yield emails
    with SessionLocal() as db:
        db.execute(delete(User).where(User.email.in_(emails)))
        db.commit()


def identity(email: str, **extra) -> GoogleIdentity:
    fields = {
        "subject": f"g-{uuid.uuid4().hex}",
        "email": email,
        "email_verified": True,
        "first_name": "Gina",
        "last_name": "Hiker",
    }
    fields.update(extra)
    return GoogleIdentity(**fields)


def me(token: str) -> dict:
    return client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()


def sign_in():
    return client.post("/auth/google", json={"id_token": TOKEN})


def test_new_google_account_is_created(google, cleanup):
    email = f"Gina.Hiker{uuid.uuid4().hex[:6]}@example.com"
    cleanup.append(email)
    google["result"] = identity(email)

    first = sign_in()
    assert first.status_code == 200
    assert first.json()["created"] is True
    profile = me(first.json()["access_token"])
    assert (profile["first_name"], profile["last_name"]) == ("Gina", "Hiker")
    assert profile["username"].startswith("gina.hiker")

    # The same Google account again: the same ParkPath account.
    again = sign_in()
    assert again.json()["created"] is False
    assert me(again.json()["access_token"])["id"] == profile["id"]


def test_existing_email_is_linked(google, cleanup):
    email = f"linked-{uuid.uuid4().hex[:8]}@example.com"
    cleanup.append(email)
    signup = client.post(
        "/auth/signup", json={"email": email, "password": "correct-horse", **new_names()}
    )
    existing = me(signup.json()["access_token"])
    google["result"] = identity(email.upper())

    resp = sign_in()
    assert resp.status_code == 200
    assert resp.json()["created"] is False
    assert me(resp.json()["access_token"])["id"] == existing["id"]
    # Their password still works too.
    login = client.post("/auth/login", json={"email": email, "password": "correct-horse"})
    assert login.status_code == 200


def test_username_clash_gets_a_number(google, cleanup):
    base = f"sam{uuid.uuid4().hex[:6]}"
    taken = f"{base}@example.com"
    cleanup.append(taken)
    client.post(
        "/auth/signup",
        json={"email": taken, "password": "correct-horse", **new_names(), "username": base},
    )
    email = f"{base}@elsewhere.example.com"
    cleanup.append(email)
    google["result"] = identity(email)
    resp = sign_in()
    assert me(resp.json()["access_token"])["username"] == f"{base}2"


def test_unverified_email_refused(google, cleanup):
    email = f"unverified-{uuid.uuid4().hex[:8]}@example.com"
    cleanup.append(email)
    google["result"] = identity(email, email_verified=False)
    assert sign_in().status_code == 400


def test_bad_token_and_not_configured(google):
    google["result"] = InvalidGoogleToken("nope")
    assert sign_in().status_code == 401
    google["result"] = GoogleNotConfigured()
    resp = sign_in()
    assert resp.status_code == 503
    assert resp.json()["detail"] == "Google sign-in isn't set up yet"


def test_not_configured_without_client_ids(monkeypatch):
    # The real check, with no client ids set (whatever this machine's .env
    # says): off, not crashing.
    monkeypatch.setattr(settings, "google_client_ids", "")
    resp = sign_in()
    assert resp.status_code == 503
