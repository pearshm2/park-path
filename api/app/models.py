"""
SQLAlchemy models live here (or split into app/models/ once this grows —
e.g. users.py, parks.py, trips.py — and import them all into __init__.py
so Alembic still sees every table through Base.metadata).

Nothing to migrate yet this week; this file just proves the Base/engine/
Alembic wiring works end to end. Week 2+ (auth, quiz, parks) adds real
tables here.
"""

from datetime import UTC, date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    false,
    func,
    select,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, column_property, mapped_column, relationship

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
    # The @handle friends see instead of the email; always lowercase (app/usernames.py).
    username: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    first_name: Mapped[str] = mapped_column(String(50), nullable=False)
    last_name: Mapped[str] = mapped_column(String(50), nullable=False, server_default="")
    # A profile picture, small enough to keep in the database (the phone
    # shrinks it first). Deferred, so it's only loaded when it's served.
    avatar: Mapped[bytes | None] = mapped_column(LargeBinary, deferred=True)
    avatar_type: Mapped[str | None] = mapped_column(String(30))
    avatar_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Google's id for their account, once they've signed in with Google.
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    # Their onboarding quiz answers as GET/PUT /quiz serve them
    # (schemas.SavedQuiz), so a new phone doesn't ask again. Null until taken.
    quiz_answers: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    @property
    def signs_in_with_google(self) -> bool:
        """Linked to a Google account (and so may have no password they know)."""
        return self.google_sub is not None

    @property
    def avatar_url(self) -> str | None:
        """
        Where to fetch the profile picture (GET /users/{id}/avatar), with
        its version on the end so a new picture isn't served from a cache.
        """
        if self.avatar_updated_at is None:
            return None
        return f"/users/{self.id}/avatar?v={int(self.avatar_updated_at.timestamp())}"


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


class UserTagWeight(Base):
    """
    How much one user cares about one tag; the recommendation engine's
    per-user input, and the thing feedback adjusts.

    A tag is a namespaced string built from a site attribute, so the set of
    tags can grow without a migration. Convention:
        "terrain:canyon", "season:fall", "effort:2", "feature:Slot canyon"

    Weights are plain floats, positive for "more of this" and negative for
    "less". Their scale and how feedback moves them belong to the engine
    (Dylan), so the database deliberately doesn't constrain the range.
    A missing row means "no opinion yet", not zero.
    """

    __tablename__ = "user_tag_weights"
    __table_args__ = (UniqueConstraint("user_id", "tag", name="uq_user_tag_weights_user_tag"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    tag: Mapped[str] = mapped_column(String(100), nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        server_default=func.now(),
    )


class SiteFeedback(Base):
    """
    A user's current thumbs-up (+1) or thumbs-down (-1) on a site.

    One row per (user, site): changing your mind updates the row and taking
    the vote back deletes it, so this is current state, not a history log.
    """

    __tablename__ = "site_feedback"
    __table_args__ = (
        UniqueConstraint("user_id", "site_id", name="uq_site_feedback_user_site"),
        CheckConstraint("rating IN (-1, 1)", name="ck_site_feedback_rating"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    site_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sites.id", ondelete="CASCADE"), index=True, nullable=False
    )
    rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # -1 down, 1 up
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        server_default=func.now(),
    )


class WishlistItem(Base):
    """
    A site the user has saved to their wishlist, to visit some day.

    One row per (user, site): saving is idempotent and removing deletes the
    row. Private to the user for now; sharing it with friends would go
    through app/visibility.py like trips.
    """

    __tablename__ = "wishlist_items"
    __table_args__ = (UniqueConstraint("user_id", "site_id", name="uq_wishlist_items_user_site"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    site_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sites.id", ondelete="CASCADE"), index=True, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now()
    )

    site: Mapped[Site] = relationship()


class Snooze(Base):
    """
    A park set aside with "Not for now": left out of the user's
    recommendations in the app until `until`, then back. Not a dislike, so
    the engine never sees it.

    One row per (user, site); snoozing again moves `until` out. Rows past
    `until` are simply ignored, and replaced on the next snooze.
    """

    __tablename__ = "snoozes"
    __table_args__ = (UniqueConstraint("user_id", "site_id", name="uq_snoozes_user_site"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    site_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False
    )
    until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    site: Mapped[Site] = relationship()


class ParkMap(Base):
    """
    What a national park's own map is drawn from: its boundary, roads and
    trails, copied from the NPS's public GIS datasets by app/park_map_sync.py
    and simplified to phone-screen detail.

    One row per site, replaced whole on every sync. The three columns hold
    the JSON exactly as GET /sites/{park_code}/map serves it (see
    ParkMapOut), with coordinates as [longitude, latitude]. `places` holds
    the visitor centers.
    """

    __tablename__ = "park_maps"

    site_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sites.id", ondelete="CASCADE"), primary_key=True
    )
    boundary: Mapped[list] = mapped_column(JSONB, nullable=False)
    roads: Mapped[list] = mapped_column(JSONB, nullable=False)
    trails: Mapped[list] = mapped_column(JSONB, nullable=False)
    places: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now()
    )

    site: Mapped[Site] = relationship()


class BrochureMap(Base):
    """
    One of a park's official NPS brochure maps, as a JPEG ready to serve
    (see app/brochure_maps.py). `position` orders a park's maps, main first.
    """

    __tablename__ = "brochure_maps"
    __table_args__ = (UniqueConstraint("site_id", "asset_id", name="uq_brochure_maps_site_asset"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    site_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sites.id", ondelete="CASCADE"), index=True, nullable=False
    )
    asset_id: Mapped[str] = mapped_column(String(64), nullable=False)  # NPGallery AssetID
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    image: Mapped[bytes] = mapped_column(LargeBinary, nullable=False, deferred=True)
    # Visitor center labels printed on the map, in image pixels:
    # [{"name", "x", "y", "width", "height"}]. NULL until read (see
    # app/brochure_maps.py); empty when the map has none or isn't a PDF.
    labels: Mapped[list | None] = mapped_column(JSONB)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now()
    )


class TripEntry(Base):
    """
    One journal entry: one visit to one site by one user. Logging an entry
    is what marks a park visited, so the passport is computed from these.

    `visibility` is "private" or "friends" (see app/visibility.py, which
    decides who may read an entry; nothing else should compare it directly).
    New entries are shared with friends unless the owner makes them private.
    """

    __tablename__ = "trip_entries"
    __table_args__ = (
        CheckConstraint("rating IS NULL OR rating BETWEEN 1 AND 5", name="ck_trip_entries_rating"),
        CheckConstraint("visibility IN ('private', 'friends')", name="ck_trip_entries_visibility"),
        # The passport and the friends feed both read "this user's entries, newest visit first".
        Index("ix_trip_entries_user_visited", "user_id", "visited_on"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    site_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sites.id", ondelete="CASCADE"), index=True, nullable=False
    )
    visited_on: Mapped[date] = mapped_column(Date, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False, default="", server_default="")
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    rating: Mapped[int | None] = mapped_column(SmallInteger)  # 1 to 5 stars
    # Trails or spots they loved, shown on the entry and in friends' feeds.
    trails: Mapped[list[str]] = mapped_column(
        ARRAY(String(200)), nullable=False, default=list, server_default="{}"
    )
    visibility: Mapped[str] = mapped_column(
        String(10), nullable=False, default="friends", server_default="friends"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        server_default=func.now(),
    )

    user: Mapped["User"] = relationship(lazy="joined")
    site: Mapped[Site] = relationship(lazy="joined")
    photos: Mapped[list["TripPhoto"]] = relationship(
        order_by="TripPhoto.position",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    companions: Mapped[list["TripCompanion"]] = relationship(
        order_by="TripCompanion.id", cascade="all, delete-orphan", lazy="selectin"
    )


class TripPhoto(Base):
    """
    A photo or video on an entry. The bytes live in object storage (S3),
    uploaded straight from the phone with a signed URL (app/storage.py);
    this row remembers the storage key (whose extension says which it is),
    its caption, and a video's length. `position` orders the entry's photos.
    """

    __tablename__ = "trip_photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entry_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("trip_entries.id", ondelete="CASCADE"), index=True, nullable=False
    )
    storage_key: Mapped[str] = mapped_column(String(300), unique=True, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    # Words shown over it when the trip is relived; may be empty.
    caption: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    # A video's length, as the phone measured it; None for photos.
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now()
    )


class TripCompanion(Base):
    """A friend tagged as having been on a trip. Only the entry's owner can tag people."""

    __tablename__ = "trip_companions"
    __table_args__ = (
        UniqueConstraint("entry_id", "user_id", name="uq_trip_companions_entry_user"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entry_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("trip_entries.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )

    user: Mapped["User"] = relationship(lazy="joined")


class TripComment(Base):
    """
    A comment on a trip, by its owner or anyone who can see it (their
    friends, for a trip shared with friends).
    """

    __tablename__ = "trip_comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entry_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("trip_entries.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), server_default=func.now()
    )

    user: Mapped["User"] = relationship(lazy="joined")


# How many comments a trip has, counted in the same query that loads it.
TripEntry.comment_count = column_property(
    select(func.count(TripComment.id))
    .where(TripComment.entry_id == TripEntry.id)
    .correlate_except(TripComment)
    .scalar_subquery()
)
