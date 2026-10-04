"""
SQLAlchemy models live here (or split into app/models/ once this grows —
e.g. users.py, parks.py, trips.py — and import them all into __init__.py
so Alembic still sees every table through Base.metadata).

Nothing to migrate yet this week; this file just proves the Base/engine/
Alembic wiring works end to end. Week 2+ (auth, quiz, parks) adds real
tables here.
"""

from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class HealthCheck(Base):
    """
    Throwaway table used only to prove Alembic migrations run against
    the real database. Safe to delete once real models exist —
    just also delete/replace its migration.
    """

    __tablename__ = "health_check"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )


class Site(Base):
    """
    One NPS site (park, monument, seashore, ...).

    Two kinds of columns live here:
    - NPS columns: overwritten every time the NPS sync job runs.
    - Curated columns: hand-entered by us for the recommendation engine
      (NPS doesn't provide terrain, effort, seasons, etc.). Nullable,
      because the sync can create a row before it has curated data.
    """

    __tablename__ = "sites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # --- From the NPS API (refreshed by the sync job) ---
    # NPS's own 4-letter code, e.g. "zion". Unique so the sync can
    # upsert on it (insert new parks, update existing ones, no duplicates).
    park_code: Mapped[str] = mapped_column(String(10), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    designation: Mapped[str | None] = mapped_column(String(100))  # "National Park"
    states: Mapped[str | None] = mapped_column(String(100))  # "TN,NC"
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    description: Mapped[str | None] = mapped_column(Text)
    nps_url: Mapped[str | None] = mapped_column(String(500))
    image_url: Mapped[str | None] = mapped_column(String(500))
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # --- Curated by us (used by the recommendation engine) ---
    terrain_group: Mapped[str | None] = mapped_column(String(50))  # "canyon"
    feature: Mapped[str | None] = mapped_column(String(100))  # "Slot canyon"
    effort: Mapped[int | None] = mapped_column(Integer)  # 1 easy, 2 moderate, 3 strenuous
    typical_days: Mapped[int | None] = mapped_column(Integer)
    seasons: Mapped[list[str] | None] = mapped_column(ARRAY(String(10)))  # ["spring", "fall"]
    permit_required: Mapped[bool | None] = mapped_column(Boolean)
    annual_visits_millions: Mapped[float | None] = mapped_column(Float)