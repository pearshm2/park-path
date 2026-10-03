"""
NPS sync job: copies park data from the NPS API into our `sites` table.

Run from the api/ folder:

    python -m app.nps_sync                    # fetch live from NPS and save to the database
    python -m app.nps_sync --save-snapshot    # same, and also write data/nps_snapshot.json
    python -m app.nps_sync --from-snapshot    # load from the snapshot file instead
                                              # (no internet or API key needed: demo fallback)

Safe to run any number of times ("idempotent"): parks are matched on
park_code, so a park that already exists is updated, never duplicated.

Only NPS-owned columns are written. Our curated columns (terrain_group,
effort, seasons, ...) are never touched, so hand-entered data survives
every sync.
"""

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path

import httpx
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import Site

NPS_PARKS_URL = "https://developer.nps.gov/api/v1/parks"
PAGE_SIZE = 50  # parks per request; ~10 requests for the whole system

# api/data/nps_snapshot.json
SNAPSHOT_PATH = Path(__file__).resolve().parent.parent / "data" / "nps_snapshot.json"

# The columns this job owns. Everything else on Site is curated by us.
NPS_COLUMNS = [
    "park_code",
    "name",
    "designation",
    "states",
    "latitude",
    "longitude",
    "description",
    "nps_url",
    "image_url",
]


# ---------------------------------------------------------------------------
# 1. FETCH: download every park from the NPS API, one page at a time
# ---------------------------------------------------------------------------
def fetch_all_parks(api_key: str, client: httpx.Client | None = None) -> list[dict]:
    """Return the raw park records exactly as NPS sends them."""
    own_client = client is None
    client = client or httpx.Client(timeout=30)
    parks: list[dict] = []
    start = 0
    try:
        while True:
            response = client.get(
                NPS_PARKS_URL,
                params={"limit": PAGE_SIZE, "start": start},
                headers={"X-Api-Key": api_key},
            )
            response.raise_for_status()  # stop loudly on a bad key, rate limit, outage...
            body = response.json()

            page = body.get("data", [])
            parks.extend(page)
            start += len(page)

            total = int(body.get("total", 0))
            if not page or start >= total:
                break
    finally:
        if own_client:
            client.close()
    return parks


# ---------------------------------------------------------------------------
# 2. TRANSFORM: reshape one NPS record into a row for our sites table
# ---------------------------------------------------------------------------
def _to_float(value) -> float | None:
    """NPS sends coordinates as strings, sometimes empty ones."""
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def transform_park(raw: dict) -> dict | None:
    """Return a dict of NPS_COLUMNS, or None if the record is unusable."""
    park_code = (raw.get("parkCode") or "").strip().lower()
    name = (raw.get("fullName") or "").strip()
    if not park_code or not name:
        return None

    images = raw.get("images") or []
    return {
        "park_code": park_code,
        "name": name,
        "designation": (raw.get("designation") or "").strip() or None,
        "states": (raw.get("states") or "").strip() or None,
        "latitude": _to_float(raw.get("latitude")),
        "longitude": _to_float(raw.get("longitude")),
        "description": (raw.get("description") or "").strip() or None,
        "nps_url": raw.get("url") or None,
        "image_url": images[0].get("url") if images else None,
    }


def transform_all(raw_parks: list[dict]) -> list[dict]:
    """Transform every record, dropping unusable ones and duplicate park codes."""
    rows: dict[str, dict] = {}
    for raw in raw_parks:
        row = transform_park(raw)
        if row is not None:
            rows[row["park_code"]] = row  # a repeated code keeps the last copy
    return sorted(rows.values(), key=lambda r: r["park_code"])


# ---------------------------------------------------------------------------
# 3. UPSERT: insert new parks, update existing ones (matched on park_code)
# ---------------------------------------------------------------------------
def upsert_sites(db: Session, rows: list[dict]) -> int:
    """Write rows to the sites table. Returns how many rows were sent."""
    if not rows:
        return 0

    now = datetime.now(UTC)
    values = [{**row, "last_synced_at": now} for row in rows]

    stmt = insert(Site).values(values)
    # "excluded" means "the new values we just tried to insert".
    # Only NPS columns are listed, so curated columns are left alone.
    update_columns = {col: stmt.excluded[col] for col in NPS_COLUMNS if col != "park_code"}
    update_columns["last_synced_at"] = stmt.excluded.last_synced_at
    stmt = stmt.on_conflict_do_update(index_elements=["park_code"], set_=update_columns)

    db.execute(stmt)
    db.commit()
    return len(values)


def count_sites(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(Site))


# ---------------------------------------------------------------------------
# Command-line entry point
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(description="Sync NPS park data into the sites table.")
    parser.add_argument(
        "--from-snapshot", action="store_true", help="load from data/nps_snapshot.json"
    )
    parser.add_argument(
        "--save-snapshot", action="store_true", help="also write data/nps_snapshot.json"
    )
    args = parser.parse_args()

    if args.from_snapshot:
        print(f"Loading parks from {SNAPSHOT_PATH} ...")
        rows = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    else:
        if not settings.nps_api_key:
            raise SystemExit(
                "NPS_API_KEY is not set. Add NPS_API_KEY=your-key to api/.env "
                "(or run with --from-snapshot)."
            )
        print("Fetching parks from the NPS API ...")
        raw_parks = fetch_all_parks(settings.nps_api_key)
        rows = transform_all(raw_parks)
        print(f"  got {len(raw_parks)} records, {len(rows)} usable parks")

        if args.save_snapshot:
            SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
            SNAPSHOT_PATH.write_text(json.dumps(rows, indent=2) + "\n", encoding="utf-8")
            print(f"  snapshot written to {SNAPSHOT_PATH}")

    with SessionLocal() as db:
        before = count_sites(db)
        sent = upsert_sites(db, rows)
        after = count_sites(db)

    print(f"Done. Sent {sent} parks. Sites in database: {before} before, {after} after.")


if __name__ == "__main__":
    main()
