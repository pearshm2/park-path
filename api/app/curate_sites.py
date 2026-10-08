"""
Curated-data job: copies our hand-entered site data into the `sites` table.

Run from the api/ folder, after the NPS sync has created the rows:

    python -m app.curate_sites

The data lives in data/curated_sites.json: terrain, effort, seasons, trip
length, permits, visitation, and whether the site is one of the 63
national parks. NPS doesn't provide any of it. It started as the mobile
app's bundled fixtures (120 sites), so the other ~350 NPS sites have no
curated data yet. Add them to the JSON file and rerun.

Safe to run any number of times: each listed site is overwritten with the
file's values. Only curated columns are written, so NPS data is untouched,
the mirror image of the NPS sync.
"""

import json
from pathlib import Path

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Site

# api/data/curated_sites.json
CURATED_PATH = Path(__file__).resolve().parent.parent / "data" / "curated_sites.json"

# The columns this job owns. Everything else on Site belongs to the NPS sync.
CURATED_COLUMNS = [
    "is_named_park",
    "terrain_group",
    "feature",
    "effort",
    "typical_days",
    "seasons",
    "permit_required",
    "annual_visits_millions",
]


def apply_curated(db: Session, rows: list[dict]) -> list[str]:
    """
    Write each row's curated columns onto the site with its park_code.
    Returns the codes that matched no site (run the NPS sync first).
    """
    missing = []
    for row in rows:
        values = {col: row.get(col) for col in CURATED_COLUMNS}
        values["is_named_park"] = bool(values["is_named_park"])
        result = db.execute(
            update(Site).where(Site.park_code == row["park_code"]).values(**values)
        )
        if result.rowcount == 0:
            missing.append(row["park_code"])
    db.commit()
    return missing


def main() -> None:
    print(f"Loading curated data from {CURATED_PATH} ...")
    rows = json.loads(CURATED_PATH.read_text(encoding="utf-8"))

    with SessionLocal() as db:
        missing = apply_curated(db, rows)

    print(f"Done. Curated {len(rows) - len(missing)} of {len(rows)} sites.")
    if missing:
        print(
            f"  {len(missing)} codes matched no site: {', '.join(missing)}\n"
            "  Run `python -m app.nps_sync --from-snapshot` first."
        )


if __name__ == "__main__":
    main()
