"""
Writes the API's contract (its OpenAPI description) to api/openapi.json.

FastAPI already builds this description from the routes and the Pydantic
schemas in app/schemas.py; it's what powers the /docs page. Saving it as a
file means:

- every pull request shows exactly how the API changed, as a diff of this file
- the mobile app generates its TypeScript types from it (npm run api:types),
  so CI catches the app and the API drifting apart

Run from the api/ folder after changing a route or a schema:

    python -m app.export_openapi

No database is needed: this only reads the code.
"""

import json
from pathlib import Path

from app.main import app

OUTPUT = Path(__file__).resolve().parent.parent / "openapi.json"


def main() -> None:
    OUTPUT.write_text(json.dumps(app.openapi(), indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
