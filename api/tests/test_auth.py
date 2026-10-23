"""
Auth flow tests. Like test_health_db, these need a real reachable
Postgres (DATABASE_URL) — run `docker compose up db` first, or let CI's
Postgres service container handle it.

Each test uses a unique email so tests don't collide with leftover data
from a previous run against the same database.
"""

import uuid

from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import new_names

client = TestClient(app)


def unique_email() -> str:
    return f"test-{uuid.uuid4().hex[:10]}@example.com"


def test_signup_returns_token():
    response = client.post(
        "/auth/signup", json={"email": unique_email(), "password": "correct-horse", **new_names()}
    )
    assert response.status_code == 201
    body = response.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_signup_duplicate_email_rejected():
    email = unique_email()
    client.post(
        "/auth/signup", json={"email": email, "password": "correct-horse", **new_names()}
    )

    response = client.post(
        "/auth/signup",
        json={"email": email, "password": "different", **new_names()},
    )
    assert response.status_code == 409


def test_login_with_correct_password():
    email = unique_email()
    client.post(
        "/auth/signup", json={"email": email, "password": "correct-horse", **new_names()}
    )

    response = client.post("/auth/login", json={"email": email, "password": "correct-horse"})
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_with_wrong_password_rejected():
    email = unique_email()
    client.post(
        "/auth/signup", json={"email": email, "password": "correct-horse", **new_names()}
    )

    response = client.post("/auth/login", json={"email": email, "password": "wrong-password"})
    assert response.status_code == 401


def test_me_requires_token():
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_me_with_valid_token():
    email = unique_email()
    signup_resp = client.post(
        "/auth/signup", json={"email": email, "password": "correct-horse", **new_names()}
    )
    token = signup_resp.json()["access_token"]

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == email


def _signup(**overrides):
    body = {"email": unique_email(), "password": "correct-horse", **new_names(), **overrides}
    return client.post("/auth/signup", json=body)


def test_signup_stores_names_and_lowercases_username():
    username = f"Jane_{uuid.uuid4().hex[:8]}"
    resp = _signup(username=f"@{username}", first_name="  Jane ", last_name="Doe")
    assert resp.status_code == 201
    headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
    me = client.get("/auth/me", headers=headers).json()
    assert me["username"] == username.lower()
    assert (me["first_name"], me["last_name"]) == ("Jane", "Doe")


def test_signup_needs_names_and_username():
    for missing in ("username", "first_name", "last_name"):
        body = {"email": unique_email(), "password": "correct-horse", **new_names()}
        del body[missing]
        assert client.post("/auth/signup", json=body).status_code == 422
    assert _signup(first_name="   ").status_code == 422


def test_signup_duplicate_username_rejected_any_case():
    username = f"dup_{uuid.uuid4().hex[:8]}"
    assert _signup(username=username).status_code == 201
    resp = _signup(username=username.upper())
    assert resp.status_code == 409
    assert resp.json()["detail"] == "That username is taken"


def test_signup_rejects_bad_usernames():
    for bad in ("ab", "x" * 21, "has space", ".dotfirst", "admin"):
        assert _signup(username=bad).status_code == 422, bad


def test_username_available():
    username = f"free_{uuid.uuid4().hex[:8]}"
    check = client.get("/auth/username-available", params={"username": username}).json()
    assert check == {"username": username, "available": True, "reason": None}
    _signup(username=username)
    taken = client.get("/auth/username-available", params={"username": username.upper()}).json()
    assert taken["available"] is False and taken["reason"] == "That username is taken"
    bad = client.get("/auth/username-available", params={"username": "a b"}).json()
    assert bad["available"] is False and bad["reason"]


def test_update_me():
    token = _signup().json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    new = f"new_{uuid.uuid4().hex[:8]}"
    resp = client.patch("/auth/me", json={"username": new, "last_name": "Muir"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["username"] == new and resp.json()["last_name"] == "Muir"
    assert resp.json()["first_name"] == "Test"
    # Keeping your own username is fine; taking someone else's isn't.
    assert client.patch("/auth/me", json={"username": new}, headers=headers).status_code == 200
    other = f"oth_{uuid.uuid4().hex[:8]}"
    _signup(username=other)
    assert client.patch("/auth/me", json={"username": other}, headers=headers).status_code == 409
