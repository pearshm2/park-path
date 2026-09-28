from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_db():
    """
    Requires a reachable Postgres (DATABASE_URL env var). CI spins one up
    as a service container — see .github/workflows/ci.yml.
    """
    response = client.get("/health/db")
    assert response.status_code == 200
    assert response.json()["database"] == "reachable"
