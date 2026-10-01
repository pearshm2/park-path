"""
ParkPath API entrypoint.

Week 1 scope: FastAPI is running, Postgres is reachable, and this is
deployed over HTTPS. Auth, quiz, parks, etc. land in later weeks as
routers included below — keep main.py thin and push logic into routers.
"""

from fastapi import Depends, FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.routers import auth

app = FastAPI(
    title="ParkPath API",
    version="0.1.0",
    description="Backend for the ParkPath capstone project.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["meta"])
def root():
    return {"service": "parkpath-api", "status": "ok"}


@app.get("/health", tags=["meta"], status_code=status.HTTP_200_OK)
def health():
    """Liveness check — does the process respond at all. No DB dependency."""
    return {"status": "ok"}


@app.get("/health/db", tags=["meta"])
def health_db(db: Session = Depends(get_db)):
    """
    Readiness check — can we actually reach Postgres. Deploy platforms
    (Render/Railway) and future CI smoke tests should hit this, not just /health.
    """
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "reachable"}


app.include_router(auth.router, prefix="/auth", tags=["auth"])

# Future routers (parks, trips, quiz, etc.) follow the same pattern:
# from app.routers import parks
# app.include_router(parks.router, prefix="/parks", tags=["parks"])
