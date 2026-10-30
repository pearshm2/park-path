"""
Pydantic schemas (request/response shapes) — kept separate from
app/models.py on purpose. models.py describes the database; this
describes the API. They'll diverge over time (e.g. responses should
never include hashed_password) and conflating them is a common source
of accidental data leaks.
"""

from datetime import date, datetime, timedelta
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.storage import MAX_VIDEO_BYTES, max_bytes_for
from app.visibility import Visibility

Name = Annotated[str, Field(min_length=1, max_length=50)]


def _clean_name(value: str) -> str:
    value = " ".join(value.split())
    if not value:
        raise ValueError("Enter a name")
    return value


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    # Checked against app/usernames.py's rules in the route, so the error
    # can say what's wrong.
    username: str
    first_name: Name
    last_name: Name

    _names = field_validator("first_name", "last_name")(_clean_name)


class UserUpdate(BaseModel):
    """
    PATCH /auth/me: any of these; the rest are left as they are. Changing
    the email also needs the current password.
    """

    username: str | None = None
    first_name: Name | None = None
    last_name: Name | None = None
    email: EmailStr | None = None
    current_password: str | None = None

    @field_validator("first_name", "last_name")
    @classmethod
    def _names(cls, value: str | None) -> str | None:
        return None if value is None else _clean_name(value)


class GoogleSignIn(BaseModel):
    """POST /auth/google: the ID token the phone got from Google."""

    id_token: str = Field(min_length=20, max_length=5000)


class GoogleToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    # True when this sign-in made a new account: the app then offers to
    # change the name and username it was given.
    created: bool


class AccountDelete(BaseModel):
    """DELETE /auth/me: "DELETE" typed out, and the password (not for Google accounts)."""

    confirm: str
    password: str | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=200)


class AvatarUpload(BaseModel):
    """PUT /auth/me/avatar: the picture, base64-encoded (at most ~300 KB)."""

    content_type: Literal["image/jpeg", "image/png"]
    data: str = Field(max_length=420_000)


class UsernameCheck(BaseModel):
    """GET /auth/username-available: whether it's free, and if not, why."""

    username: str
    available: bool
    reason: str | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    username: str
    first_name: str
    last_name: str
    # GET this (with your token) for their profile picture; null without one.
    avatar_url: str | None = None
    # Signs in with Google: deleting the account then asks for no password.
    signs_in_with_google: bool = False


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
    """Who to ask: by email, or by username (typed, or from their QR code)."""

    email: EmailStr | None = None
    username: str | None = None

    @model_validator(mode="after")
    def _one_of(self):
        if (self.email is None) == (self.username is None):
            raise ValueError("Give an email or a username")
        return self


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


class SavedQuiz(QuizAnswers):
    """The quiz as GET/PUT /quiz keep it: the answers plus the zip code they gave."""

    # Null if they skipped it. The app turns it into a Location itself.
    zip: str | None = Field(default=None, pattern=r"^\d{5}$")


# --- Snoozes (GET/PUT/DELETE /snoozes) ---------------------------------------


class SnoozeIn(BaseModel):
    """
    Optional body for PUT /snoozes/{park_code}. Without `until` the park is
    set aside for the usual 30 days; with it (a snooze carried over from
    the phone), until then, but never more than 30 days out.
    """

    until: datetime | None = None


class SnoozeOut(BaseModel):
    park_code: str
    until: datetime


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
    # Parks the user has set aside with "Not for now" (park codes). Not held
    # against them: only so the "something different" pick is never one,
    # since the app hides set-aside parks.
    snoozed: list[str] = Field(default_factory=list, max_length=500)


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
    # True when the signed-in user has logged a trip here (always false
    # without a token). Visited parks are moved down the list.
    visited: bool
    # True for at most one site: the signed-in user's "something different"
    # pick, a national park from outside their top 10 (see
    # app/recommender.py). The app shows it at #4.
    different: bool = False


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
MAX_TRIP_TRAILS = 20
MAX_CAPTION_LENGTH = 500
# Longest video length the API accepts; the app itself takes a minute.
MAX_VIDEO_MS = 5 * 60 * 1000


class PhotoUploadRequest(BaseModel):
    """Ask for permission to upload one photo or video."""

    content_type: Literal[
        "image/jpeg", "image/png", "image/webp", "image/heic", "video/mp4", "video/quicktime"
    ]
    size_bytes: int = Field(gt=0, le=MAX_VIDEO_BYTES)

    @model_validator(mode="after")
    def within_its_limit(self) -> "PhotoUploadRequest":
        # Photos have a smaller limit than videos.
        if self.size_bytes > max_bytes_for(self.content_type):
            raise ValueError(f"size_bytes is over the limit for {self.content_type}")
        return self


class PhotoUploadOut(BaseModel):
    """
    A signed form for one photo or video upload. The app sends a multipart
    POST to `upload_url`: every entry of `fields` first, in order, then the
    file as the last part named `file`. Then it passes `key` in `photos`
    when it saves the trip. The form stops working after `expires_in`
    seconds.
    """

    key: str
    upload_url: str
    fields: dict[str, str]
    expires_in: int
    max_bytes: int


class TripPhotoIn(BaseModel):
    """A photo or video on a trip: its key from the upload, and its caption."""

    key: str
    caption: str = Field("", max_length=MAX_CAPTION_LENGTH)
    # A video's length in ms, as the phone measured it.
    duration_ms: int | None = Field(None, ge=0, le=MAX_VIDEO_MS)


class TripPhotoOut(BaseModel):
    key: str
    # Short-lived signed link; fetch the trip again for a fresh one.
    url: str | None
    kind: Literal["photo", "video"]
    caption: str
    duration_ms: int | None


# Each trail or spot: up to 200 characters.
Trail = Annotated[str, Field(max_length=200)]


class TripCreate(BaseModel):
    park_code: str
    visited_on: date
    title: str = Field("", max_length=200)
    notes: str = Field("", max_length=10_000)
    rating: int | None = Field(None, ge=1, le=5)
    # Trails or spots they loved, in order.
    trails: list[Trail] | None = Field(None, max_length=MAX_TRIP_TRAILS)
    # The older form of `trails`: one trail. Ignored when `trails` is sent.
    stamp: str | None = Field(None, max_length=200)
    visibility: Visibility = Visibility.FRIENDS
    # Uploads from POST /trips/photos/upload-url, in the order to show them.
    photos: list[TripPhotoIn] | None = Field(None, max_length=MAX_TRIP_PHOTOS)
    # The older form of `photos`: keys only, no captions. Ignored when
    # `photos` is sent.
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
    """
    Only the fields sent change. `rating` can be set to null to clear it.

    `trails` replaces the list. `stamp`, the older one-trail form, sets the
    first trail (keeping the rest), or removes it when null; it's ignored
    when `trails` is sent. Likewise `photos` replaces the photos and their
    captions, and `photo_keys` (keys only) is ignored when it's sent.
    """

    visited_on: date | None = None
    title: str | None = Field(None, max_length=200)
    notes: str | None = Field(None, max_length=10_000)
    rating: int | None = Field(None, ge=1, le=5)
    trails: list[Trail] | None = Field(None, max_length=MAX_TRIP_TRAILS)
    stamp: str | None = Field(None, max_length=200)
    visibility: Visibility | None = None
    photos: list[TripPhotoIn] | None = Field(None, max_length=MAX_TRIP_PHOTOS)
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
    trails: list[str]
    # The first trail, for older clients; null without any.
    stamp: str | None
    visibility: Visibility
    photos: list[TripPhotoOut]
    companions: list[UserOut]
    comment_count: int = 0
    created_at: datetime
    updated_at: datetime


class TripCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=1000)

    @field_validator("body")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Write something first")
        return value


class TripCommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    author: UserOut = Field(validation_alias="user")
    body: str
    created_at: datetime


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
