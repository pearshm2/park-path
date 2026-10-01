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

client = TestClient(app)


def unique_email() -> str:
    return f"test-{uuid.uuid4().hex[:10]}@example.com"


def test_signup_returns_token():
    response = client.post(
        "/auth/signup", json={"email": unique_email(), "password": "correct-horse"}
    )
    assert response.status_code == 201
    body = response.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_signup_duplicate_email_rejected():
    email = unique_email()
    client.post("/auth/signup", json={"email": email, "password": "correct-horse"})

    response = client.post("/auth/signup", json={"email": email, "password": "different"})
    assert response.status_code == 409


def test_login_with_correct_password():
    email = unique_email()
    client.post("/auth/signup", json={"email": email, "password": "correct-horse"})

    response = client.post("/auth/login", json={"email": email, "password": "correct-horse"})
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_with_wrong_password_rejected():
    email = unique_email()
    client.post("/auth/signup", json={"email": email, "password": "correct-horse"})

    response = client.post("/auth/login", json={"email": email, "password": "wrong-password"})
    assert response.status_code == 401


def test_me_requires_token():
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_me_with_valid_token():
    email = unique_email()
    signup_resp = client.post(
        "/auth/signup", json={"email": email, "password": "correct-horse"}
    )
    token = signup_resp.json()["access_token"]

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == email
