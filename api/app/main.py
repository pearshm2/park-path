"""
ParkPath API entrypoint.

Week 1 scope: FastAPI is running, Postgres is reachable, and this is
deployed over HTTPS. Auth, quiz, parks, etc. land in later weeks as
routers included below — keep main.py thin and push logic into routers.
"""

from fastapi import Depends, FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.routers import (
    auth,
    friends,
    passport,
    quiz,
    recommendations,
    sites,
    snoozes,
    trips,
    users,
    wishlist,
)

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
# Compress larger responses: a park's trail map (GET /sites/{code}/map) is
# up to ~0.5 MB of JSON and about a quarter of that gzipped. The phone's
# fetch decompresses transparently.
app.add_middleware(GZipMiddleware, minimum_size=1000)


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
app.include_router(sites.router, prefix="/sites", tags=["sites"])
app.include_router(friends.router, prefix="/friends", tags=["friends"])
app.include_router(recommendations.router, prefix="/recommendations", tags=["recommendations"])
app.include_router(wishlist.router, prefix="/wishlist", tags=["wishlist"])
app.include_router(snoozes.router, prefix="/snoozes", tags=["snoozes"])
app.include_router(quiz.router, prefix="/quiz", tags=["quiz"])
app.include_router(trips.router, prefix="/trips", tags=["trips"])
app.include_router(passport.router, prefix="/passport", tags=["passport"])
app.include_router(users.router, prefix="/users", tags=["users"])

# Future routers (quiz, etc.) follow the same pattern.
