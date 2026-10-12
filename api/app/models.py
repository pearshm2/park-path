"""
SQLAlchemy models live here (or split into app/models/ once this grows —
e.g. users.py, parks.py, trips.py — and import them all into __init__.py
so Alembic still sees every table through Base.metadata).

Nothing to migrate yet this week; this file just proves the Base/engine/
Alembic wiring works end to end. Week 2+ (auth, quiz, parks) adds real
tables here.
"""

from datetime import UTC, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    false,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

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
    # One of the 63 national parks. NPS's designation can't say this on its
    # own: Denali is a "National Park & Preserve", Redwood is "National and
    # State Parks", American Samoa has none, and Sequoia & Kings Canyon is
    # one NPS unit ("seki") covering two parks.
    is_named_park: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    terrain_group: Mapped[str | None] = mapped_column(String(50))  # "canyon"
    feature: Mapped[str | None] = mapped_column(String(100))  # "Slot canyon"
    effort: Mapped[int | None] = mapped_column(Integer)  # 1 easy, 2 moderate, 3 strenuous
    typical_days: Mapped[int | None] = mapped_column(Integer)
    seasons: Mapped[list[str] | None] = mapped_column(ARRAY(String(10)))  # ["spring", "fall"]
    permit_required: Mapped[bool | None] = mapped_column(Boolean)
    annual_visits_millions: Mapped[float | None] = mapped_column(Float)


class Friendship(Base):
    """
    One row per pair of users, in one of two states:

    - "pending":  `requester` asked `addressee`; nothing is shared yet.
    - "accepted": the addressee said yes; the two are friends (mutual).

    A declined or cancelled request, and an unfriend, delete the row, so
    there is no "declined" state to get stuck in and either side can ask
    again later.

    Direction only matters while pending (only the addressee may accept).
    The unique index on (LEAST(a, b), GREATEST(a, b)) means a pair can never
    have two rows, even when both users send a request at the same moment.
    """

    __tablename__ = "friendships"
    __table_args__ = (
        CheckConstraint("requester_id <> addressee_id", name="ck_friendships_not_self"),
        CheckConstraint("status IN ('pending', 'accepted')", name="ck_friendships_status"),
        Index(
            "uq_friendships_pair",
            func.least(Column("requester_id"), Column("addressee_id")),
            func.greatest(Column("requester_id"), Column("addressee_id")),
            unique=True,
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    requester_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    addressee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now()
    )
    # Set when the request is accepted; null while pending.
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Loaded together with the row: every response shows both people.
    requester: Mapped["User"] = relationship(foreign_keys=[requester_id], lazy="joined")
    addressee: Mapped["User"] = relationship(foreign_keys=[addressee_id], lazy="joined")
