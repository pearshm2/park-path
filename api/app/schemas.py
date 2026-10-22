"""
Pydantic schemas (request/response shapes) — kept separate from
app/models.py on purpose. models.py describes the database; this
describes the API. They'll diverge over time (e.g. responses should
never include hashed_password) and conflating them is a common source
of accidental data leaks.
"""

from datetime import date, datetime, timedelta
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.storage import MAX_PHOTO_BYTES
from app.visibility import Visibility


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SiteOut(BaseModel):
    """
    One NPS site. Curated fields are null for sites nobody has filled in
    yet (most of the non-park units), so clients must handle missing values.
    """

    model_config = ConfigDict(from_attributes=True)

    park_code: str
    name: str
    designation: str | None
    states: str | None
    latitude: float | None
    longitude: float | None
    description: str | None
    nps_url: str | None
    image_url: str | None

    is_named_park: bool
    terrain_group: str | None
    feature: str | None
    effort: int | None
    typical_days: int | None
    seasons: list[str] | None
    permit_required: bool | None
    annual_visits_millions: float | None


class FriendRequestCreate(BaseModel):
    email: EmailStr


class FriendshipOut(BaseModel):
    """A friend request, pending or accepted, with both people named."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    status: Literal["pending", "accepted"]
    created_at: datetime
    accepted_at: datetime | None
    requester: UserOut
    addressee: UserOut


class FriendOut(BaseModel):
    """One entry in the signed-in user's friends list: the *other* person."""

    friendship_id: int
    user: UserOut
    since: datetime | None


class WishlistItemOut(BaseModel):
    """One saved site. The app already has the site details from GET /sites."""

    park_code: str
    added_at: datetime


# --- Recommendations (POST /recommendations) --------------------------------

QuizTerrain = Literal["mountain", "canyon", "desert", "forest", "coast", "water"]
Season = Literal["winter", "spring", "summer", "fall"]


class QuizAnswers(BaseModel):
    """The onboarding quiz, as the app sends it. Every question is required."""

    terrains: list[QuizTerrain] = Field(min_length=1)
    # Ranked, favourite first. An empty list means "Any season works for me".
    seasons: list[Season] = Field(max_length=4)
    crowds: Literal["icons", "either", "quiet"]

    @field_validator("terrains", "seasons")
    @classmethod
    def no_repeats(cls, value: list[str]) -> list[str]:
        if len(value) != len(set(value)):
            raise ValueError("each answer can only be picked once")
        return value


class Location(BaseModel):
    """Where the person starts, already converted from their zip code by the app."""

    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class RecommendationRequest(BaseModel):
    answers: QuizAnswers
    # The quiz requires a zip code, but the API accepts a request without
    # one, so the app can integrate before its zip lookup exists. Without
    # it, distance just isn't scored.
    location: Location | None = None


class SignalScores(BaseModel):
    """Each signal's match from 0 to 1, or null when it isn't in use."""

    distance: float | None
    terrain: float | None
    season: float | None
    crowds: float | None


class RecommendationOut(BaseModel):
    park_code: str
    # 0 to 1. Null for sites with no curated data yet.
    score: float | None
    reason: str | None
    signals: SignalScores


# --- Park maps (GET /sites/{park_code}/map) ---------------------------------

# A path is a list of [longitude, latitude] points.
Path = list[list[float]]


class TrailOut(BaseModel):
    name: str | None  # None for unnamed connectors: drawn, not listed
    uses: list[Literal["hike", "horse", "bike", "motorized"]]
    surface: str | None
    closed: bool  # temporarily closed
    length_miles: float
    paths: list[Path]


class RoadOut(BaseModel):
    name: str | None
    kind: Literal["primary", "secondary", "local", "4wd"]
    paths: list[Path]


class PlaceOut(BaseModel):
    name: str
    kind: Literal["visitor_center"]
    point: list[float]  # [longitude, latitude]


class MapLabelOut(BaseModel):
    """Where a label is printed on a brochure map, in the image's pixels."""

    name: str  # "Zion Canyon Visitor Center"
    x: int
    y: int
    width: int
    height: int


class BrochureMapOut(BaseModel):
    """One of the park's official brochure maps, as a JPEG at `url`."""

    title: str  # "Park Map", "Park Map, East Unit", ...
    url: str  # path on this API, e.g. /sites/zion/brochures/0
    width: int
    height: int
    visitor_centers: list[MapLabelOut]  # their labels printed on this map


class ParkBoundaryOut(BaseModel):
    """A park's outline, for working out on the device whether you're in it."""

    park_code: str
    bbox: list[float]  # [min_lon, min_lat, max_lon, max_lat], to rule parks out fast
    rings: list[Path]  # test with the even-odd rule


class ParkMapOut(BaseModel):
    park_code: str
    boundary: list[Path]  # rings; fill with the even-odd rule
    roads: list[RoadOut]
    trails: list[TrailOut]
    places: list[PlaceOut]
    brochures: list[BrochureMapOut]
    # The park's own maps page on nps.gov, with the official brochure map.
    official_map_url: str
    synced_at: datetime


# --- Trips (/trips) ---------------------------------------------------------

MAX_TRIP_PHOTOS = 8
MAX_TRIP_COMPANIONS = 20


class PhotoUploadRequest(BaseModel):
    """Ask for permission to upload one photo."""

    content_type: Literal["image/jpeg", "image/png", "image/webp", "image/heic"]
    size_bytes: int = Field(gt=0, le=MAX_PHOTO_BYTES)


class PhotoUploadOut(BaseModel):
    """
    A signed form for one photo upload. The app sends a multipart POST to
    `upload_url`: every entry of `fields` first, in order, then the file as
    the last part named `file`. Then it passes `key` in `photo_keys` when it
    saves the trip. The form stops working after `expires_in` seconds.
    """

    key: str
    upload_url: str
    fields: dict[str, str]
    expires_in: int
    max_bytes: int


class TripPhotoOut(BaseModel):
    key: str
    # Short-lived signed link; fetch the trip again for a fresh one.
    url: str | None


class TripCreate(BaseModel):
    park_code: str
    visited_on: date
    title: str = Field("", max_length=200)
    notes: str = Field("", max_length=10_000)
    rating: int | None = Field(None, ge=1, le=5)
    stamp: str | None = Field(None, max_length=200)
    visibility: Visibility = Visibility.PRIVATE
    # Keys from POST /trips/photos/upload-url, in the order to show them.
    photo_keys: list[str] = Field(default_factory=list, max_length=MAX_TRIP_PHOTOS)
    # User ids of friends who were there.
    companion_ids: list[int] = Field(default_factory=list, max_length=MAX_TRIP_COMPANIONS)

    @field_validator("visited_on")
    @classmethod
    def not_in_the_future(cls, value: date) -> date:
        # A day of slack so a phone ahead of UTC can log "today".
        if value > date.today() + timedelta(days=1):
            raise ValueError("a visit can't be in the future")
        return value


class TripUpdate(BaseModel):
    """Only the fields sent change. `rating` and `stamp` can be set to null to clear them."""

    visited_on: date | None = None
    title: str | None = Field(None, max_length=200)
    notes: str | None = Field(None, max_length=10_000)
    rating: int | None = Field(None, ge=1, le=5)
    stamp: str | None = Field(None, max_length=200)
    visibility: Visibility | None = None
    photo_keys: list[str] | None = Field(None, max_length=MAX_TRIP_PHOTOS)
    companion_ids: list[int] | None = Field(None, max_length=MAX_TRIP_COMPANIONS)

    @field_validator("visited_on")
    @classmethod
    def not_in_the_future(cls, value: date | None) -> date | None:
        if value is not None and value > date.today() + timedelta(days=1):
            raise ValueError("a visit can't be in the future")
        return value


class TripOut(BaseModel):
    id: int
    owner: UserOut
    park_code: str
    park_name: str
    visited_on: date
    title: str
    notes: str
    rating: int | None
    stamp: str | None
    visibility: Visibility
    photos: list[TripPhotoOut]
    companions: list[UserOut]
    created_at: datetime
    updated_at: datetime


# --- Passport (GET /passport) -----------------------------------------------


class PassportStampOut(BaseModel):
    """One national park's stamp: earned by logging a visit."""

    park_code: str
    name: str
    states: str | None
    region: str | None  # a RegionProgressOut id; null for territories
    earned: bool
    visit_count: int
    first_visited_on: date | None
    last_visited_on: date | None
    # The trip to reopen when the stamp is tapped: the latest visit.
    latest_trip_id: int | None


class RegionProgressOut(BaseModel):
    id: str
    label: str
    visited: int
    total: int
    complete: bool


class AchievementOut(BaseModel):
    id: str
    title: str
    description: str
    earned: bool
    progress: int  # capped at goal
    goal: int


class PassportOut(BaseModel):
    owner: UserOut
    parks_visited: int
    parks_total: int
    stamps: list[PassportStampOut]  # every national park, by name
    regions: list[RegionProgressOut]
    achievements: list[AchievementOut]
