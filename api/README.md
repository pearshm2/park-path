# ParkPath API

FastAPI + PostgreSQL backend skeleton — Sebastian's Week 1 scope: set up FastAPI, Postgres, and deploy a skeleton API over HTTPS.

(CI is Dylan's piece and isn't set up in this repo yet — once his GitHub Actions workflow exists, it should install `requirements.txt`, run `alembic upgrade head` against a Postgres service container, and run `pytest`.)

## Run locally (Docker — recommended)

Requires Docker Desktop.

```bash
docker compose up --build
```

This starts Postgres and the API together, runs Alembic migrations automatically on boot, and serves the API at:

- http://localhost:8000/ — root
- http://localhost:8000/health — liveness (no DB)
- http://localhost:8000/health/db — readiness (confirms Postgres is reachable)
- http://localhost:8000/docs — Swagger UI (auto-generated from FastAPI)

## Run locally (without Docker)

Requires Python 3.11+ and a local/reachable Postgres.

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # edit DATABASE_URL if not using docker-compose's db
alembic upgrade head
uvicorn app.main:app --reload
```

## Running tests

```bash
pytest -v
```

`test_health_db` needs a real Postgres reachable at `DATABASE_URL` — either run `docker compose up db` first, or point `.env` at one you already have running.

## Project layout

```
app/
  main.py        FastAPI app + routes (routers get added here week by week)
  config.py      Settings, read from environment variables
  database.py    SQLAlchemy engine/session, declarative Base
  models.py      SQLAlchemy models (Alembic autogenerates from these)
alembic/          Migrations
tests/            pytest
Dockerfile        Used for both docker-compose and Render
docker-compose.yml  Local API + Postgres
render.yaml       Render Blueprint (web service + managed Postgres)
```

## Adding a model / migration

1. Add or edit a class in `app/models.py` (subclass `Base`).
2. `alembic revision --autogenerate -m "add <thing>"`
3. Check the generated file in `alembic/versions/` — autogenerate is good, not perfect.
4. `alembic upgrade head` locally to apply it, then commit the migration file.

## Deploying (Render)

HTTPS is handled for you — Render terminates TLS at its edge, so as long as the container listens on `$PORT` (it does, via the Dockerfile), you get an `https://` URL with no extra config.

1. Push this repo to GitHub.
2. In the Render dashboard: **New → Blueprint**, point it at the repo. It reads `render.yaml` and provisions the `parkpath-api` web service plus the `parkpath-db` Postgres instance together, and wires `DATABASE_URL` between them automatically.
3. First deploy will build the Docker image, run `alembic upgrade head`, then start uvicorn (see `Dockerfile` CMD).
4. Once live, confirm:
   - `https://<your-service>.onrender.com/health` → `{"status": "ok"}`
   - `https://<your-service>.onrender.com/health/db` → `{"status": "ok", "database": "reachable"}`

**Railway** works the same way without `render.yaml`: add a Postgres plugin, add a service from this repo (Railway detects the `Dockerfile`), set `DATABASE_URL` to the Postgres plugin's reference variable, and Railway gives you HTTPS on its `*.up.railway.app` domain automatically.

Either way, use `/health` as the platform's health-check path, not `/`, so a DB hiccup doesn't get read as an app crash.

## Team notes

- Auth, quiz, parks, etc. land as new routers in `app/main.py` starting Week 2 — keep `main.py` thin, push logic into `app/routers/`.
- CORS is wide open (`CORS_ORIGINS=*`) for now since the Expo app isn't live yet. Tighten this once the app has a fixed origin/scheme.
- The `health_check` table/migration is a throwaway used only to prove the DB + Alembic wiring works end to end — delete it once real tables exist.
