"""
Trips tests: logging, listing, editing, deleting, visibility, the friends
feed, companions and the photo upload flow. Like the other API tests these
need a real Postgres (DATABASE_URL).

Photo storage is replaced with an in-memory fake, so no S3 is needed; the
real S3Storage is checked offline at the bottom (signing needs no network).

Each test gets fresh users and sites with unique codes and deletes them
afterwards; trip rows go with them (ON DELETE CASCADE).
"""

import uuid
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.database import SessionLocal
from app.main import app
from app.models import Site, User
from app.storage import MAX_PHOTO_BYTES, MAX_VIDEO_BYTES, SignedUpload, get_storage, user_prefix
from tests.helpers import new_names

client = TestClient(app)


class FakeStorage:
    """Stands in for S3: remembers which keys have been 'uploaded'."""

    def __init__(self):
        self.objects: set[str] = set()
        self.deleted: list[str] = []

    def signed_upload(self, key, content_type):
        return SignedUpload(
            url="https://fake-bucket.example/upload",
            fields={"key": key, "Content-Type": content_type},
            expires_in=900,
        )

    def signed_url(self, key):
        return f"https://fake-bucket.example/{key}?signed=1"

    def exists(self, key):
        return key in self.objects

    def delete(self, key):
        self.objects.discard(key)
        self.deleted.append(key)


@pytest.fixture
def storage():
    fake = FakeStorage()
    app.dependency_overrides[get_storage] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_storage, None)


@pytest.fixture
def no_storage():
    app.dependency_overrides[get_storage] = lambda: None
    yield
    app.dependency_overrides.pop(get_storage, None)


class Person:
    def __init__(self):
        self.email = f"trip-{uuid.uuid4().hex[:10]}@example.com"
        resp = client.post(
            "/auth/signup",
            json={"email": self.email, "password": "correct-horse", **new_names()},
        )
        self.headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
        self.id = client.get("/auth/me", headers=self.headers).json()["id"]

    def befriend(self, other: "Person") -> None:
        friendship_id = client.post(
            "/friends/requests", json={"email": other.email}, headers=self.headers
        ).json()["id"]
        accepted = client.post(f"/friends/requests/{friendship_id}/accept", headers=other.headers)
        assert accepted.status_code == 200

    def log(self, code: str, **extra):
        body = {"park_code": code, "visited_on": "2024-06-12", **extra}
        return client.post("/trips", json=body, headers=self.headers)

    def get(self, trip_id: int):
        return client.get(f"/trips/{trip_id}", headers=self.headers)

    def upload(self, storage: FakeStorage, content_type="image/jpeg") -> str:
        """Ask for an upload form and 'upload' the file; returns the key."""
        resp = client.post(
            "/trips/photos/upload-url",
            json={"content_type": content_type, "size_bytes": 1000},
            headers=self.headers,
        )
        assert resp.status_code == 200, resp.text
        key = resp.json()["key"]
        storage.objects.add(key)
        return key


@pytest.fixture
def people():
    created: list[Person] = []

    def make() -> Person:
        person = Person()
        created.append(person)
        return person

    yield make

    with SessionLocal() as db:
        db.execute(delete(User).where(User.id.in_([p.id for p in created])))
        db.commit()


@pytest.fixture
def codes():
    """Two test sites; returns their park codes."""
    made = [f"t{uuid.uuid4().hex[:8]}" for _ in range(2)]
    with SessionLocal() as db:
        db.add_all(Site(park_code=code, name=f"Test Site {code}", states="UT") for code in made)
        db.commit()

    yield made

    with SessionLocal() as db:
        db.execute(delete(Site).where(Site.park_code.in_(made)))
        db.commit()


# --- auth ------------------------------------------------------------------


def test_requires_login():
    assert client.get("/trips").status_code == 401
    assert client.post("/trips", json={}).status_code == 401
    assert client.get("/trips/feed").status_code == 401
    assert client.get("/trips/1").status_code == 401
    assert client.patch("/trips/1", json={}).status_code == 401
    assert client.delete("/trips/1").status_code == 401
    assert client.post("/trips/photos/upload-url", json={}).status_code == 401


# --- logging and reading -----------------------------------------------------


def test_log_a_trip(people, codes):
    ann = people()
    resp = ann.log(
        codes[0],
        title="  Angels Landing  ",
        notes="Chains were busy.",
        rating=5,
        stamp="Observation Point",
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["park_code"] == codes[0]
    assert body["park_name"] == f"Test Site {codes[0]}"
    assert body["visited_on"] == "2024-06-12"
    assert body["title"] == "Angels Landing"  # trimmed
    assert body["rating"] == 5
    assert body["stamp"] == "Observation Point"
    assert body["owner"]["id"] == ann.id
    assert body["photos"] == [] and body["companions"] == []
    assert ann.get(body["id"]).json() == body


def test_new_trips_are_private_by_default(people, codes):
    ann = people()
    assert ann.log(codes[0]).json()["visibility"] == "private"


def test_park_code_is_case_insensitive_and_unknown_is_404(people, codes):
    ann = people()
    assert ann.log(codes[0].upper()).status_code == 201
    assert ann.log("nope-nope").status_code == 404


def test_validation(people, codes):
    ann = people()
    assert ann.log(codes[0], rating=0).status_code == 422
    assert ann.log(codes[0], rating=6).status_code == 422
    assert ann.log(codes[0], visibility="public").status_code == 422
    assert ann.log(codes[0], title="x" * 201).status_code == 422
    future = (date.today() + timedelta(days=30)).isoformat()
    assert ann.log(codes[0], visited_on=future).status_code == 422
    missing_date = client.post("/trips", json={"park_code": codes[0]}, headers=ann.headers)
    assert missing_date.status_code == 422


def test_list_is_mine_newest_visit_first_and_filters_by_park(people, codes):
    ann, bob = people(), people()
    old = ann.log(codes[0], visited_on="2023-01-01").json()["id"]
    new = ann.log(codes[1], visited_on="2024-05-05").json()["id"]
    bob.log(codes[0])

    mine = client.get("/trips", headers=ann.headers).json()
    assert [t["id"] for t in mine] == [new, old]
    only = client.get("/trips", params={"park_code": codes[0]}, headers=ann.headers).json()
    assert [t["id"] for t in only] == [old]


# --- visibility ---------------------------------------------------------------


def test_private_trips_are_invisible_to_everyone_else(people, codes):
    ann, bob, stranger = people(), people(), people()
    ann.befriend(bob)
    trip_id = ann.log(codes[0]).json()["id"]
    assert bob.get(trip_id).status_code == 404  # friends too, until shared
    assert stranger.get(trip_id).status_code == 404


def test_friends_can_read_a_shared_trip_strangers_cannot(people, codes):
    ann, bob, stranger = people(), people(), people()
    ann.befriend(bob)
    trip_id = ann.log(codes[0], visibility="friends").json()["id"]
    assert bob.get(trip_id).status_code == 200
    assert bob.get(trip_id).json()["owner"]["id"] == ann.id
    assert stranger.get(trip_id).status_code == 404


def test_a_pending_request_shares_nothing(people, codes):
    ann, bob = people(), people()
    client.post("/friends/requests", json={"email": bob.email}, headers=ann.headers)
    trip_id = ann.log(codes[0], visibility="friends").json()["id"]
    assert bob.get(trip_id).status_code == 404


def test_unfriending_hides_shared_trips(people, codes):
    ann, bob = people(), people()
    ann.befriend(bob)
    trip_id = ann.log(codes[0], visibility="friends").json()["id"]
    assert bob.get(trip_id).status_code == 200
    client.delete(f"/friends/{bob.id}", headers=ann.headers)
    assert bob.get(trip_id).status_code == 404


def test_changing_visibility_back_to_private_hides_it_again(people, codes):
    ann, bob = people(), people()
    ann.befriend(bob)
    trip_id = ann.log(codes[0], visibility="friends").json()["id"]
    patched = client.patch(f"/trips/{trip_id}", json={"visibility": "private"}, headers=ann.headers)
    assert patched.status_code == 200
    assert bob.get(trip_id).status_code == 404


def test_a_friend_cannot_change_or_delete_a_shared_trip(people, codes):
    ann, bob, stranger = people(), people(), people()
    ann.befriend(bob)
    trip_id = ann.log(codes[0], visibility="friends").json()["id"]
    edit = client.patch(f"/trips/{trip_id}", json={"title": "x"}, headers=bob.headers)
    assert edit.status_code == 403
    assert client.delete(f"/trips/{trip_id}", headers=bob.headers).status_code == 403
    # A stranger can't even tell it exists.
    assert client.delete(f"/trips/{trip_id}", headers=stranger.headers).status_code == 404
    assert ann.get(trip_id).json()["title"] == ""


# --- the friends feed -----------------------------------------------------------


def test_feed_shows_only_friends_shared_trips_newest_first(people, codes):
    ann, bob, cat, stranger = people(), people(), people(), people()
    ann.befriend(bob)
    ann.befriend(cat)
    first = bob.log(codes[0], visibility="friends").json()["id"]
    bob.log(codes[0])  # private: not in the feed
    second = cat.log(codes[1], visibility="friends").json()["id"]
    stranger.log(codes[0], visibility="friends")  # not a friend
    ann.log(codes[0], visibility="friends")  # my own trips aren't in my feed

    feed = client.get("/trips/feed", headers=ann.headers).json()
    assert [t["id"] for t in feed] == [second, first]


def test_feed_is_empty_without_friends(people, codes):
    ann = people()
    ann.log(codes[0], visibility="friends")
    assert client.get("/trips/feed", headers=ann.headers).json() == []


def test_feed_pages_with_before(people, codes):
    ann, bob = people(), people()
    ann.befriend(bob)
    ids = [bob.log(codes[0], visibility="friends").json()["id"] for _ in range(3)]
    page = client.get("/trips/feed", params={"limit": 2}, headers=ann.headers).json()
    assert [t["id"] for t in page] == [ids[2], ids[1]]
    rest = client.get(
        "/trips/feed", params={"limit": 2, "before": page[-1]["id"]}, headers=ann.headers
    ).json()
    assert [t["id"] for t in rest] == [ids[0]]


# --- editing and deleting ---------------------------------------------------------


def test_patch_changes_only_what_is_sent(people, codes):
    ann = people()
    trip = ann.log(codes[0], title="Before", notes="Keep me", rating=3, stamp="Spot")
    trip_id = trip.json()["id"]
    resp = client.patch(
        f"/trips/{trip_id}", json={"title": "After", "rating": None}, headers=ann.headers
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "After"
    assert body["rating"] is None  # explicit null clears it
    assert body["notes"] == "Keep me"  # not sent: unchanged
    assert body["stamp"] == "Spot"


def test_patch_cannot_null_required_fields(people, codes):
    ann = people()
    trip_id = ann.log(codes[0]).json()["id"]
    for field in ("visited_on", "title", "notes", "visibility", "photo_keys", "companion_ids"):
        resp = client.patch(f"/trips/{trip_id}", json={field: None}, headers=ann.headers)
        assert resp.status_code == 400, field


def test_delete(people, codes):
    ann = people()
    trip_id = ann.log(codes[0]).json()["id"]
    assert client.delete(f"/trips/{trip_id}", headers=ann.headers).status_code == 204
    assert ann.get(trip_id).status_code == 404
    assert client.delete(f"/trips/{trip_id}", headers=ann.headers).status_code == 404


# --- companions ------------------------------------------------------------------


def test_tag_friends_who_were_there(people, codes):
    ann, bob, stranger = people(), people(), people()
    ann.befriend(bob)
    resp = ann.log(codes[0], companion_ids=[bob.id])
    assert resp.status_code == 201
    assert [c["id"] for c in resp.json()["companions"]] == [bob.id]
    assert ann.log(codes[0], companion_ids=[stranger.id]).status_code == 400
    assert ann.log(codes[0], companion_ids=[bob.id, bob.id]).status_code == 400
    assert ann.log(codes[0], companion_ids=[ann.id]).status_code == 400  # not your own friend


def test_patch_replaces_companions(people, codes):
    ann, bob, cat = people(), people(), people()
    ann.befriend(bob)
    ann.befriend(cat)
    trip_id = ann.log(codes[0], companion_ids=[bob.id]).json()["id"]
    resp = client.patch(f"/trips/{trip_id}", json={"companion_ids": [cat.id]}, headers=ann.headers)
    assert [c["id"] for c in resp.json()["companions"]] == [cat.id]
    resp = client.patch(f"/trips/{trip_id}", json={"companion_ids": []}, headers=ann.headers)
    assert resp.json()["companions"] == []


# --- photos ---------------------------------------------------------------------


def test_upload_url_is_scoped_to_the_caller(people, storage):
    ann = people()
    resp = client.post(
        "/trips/photos/upload-url",
        json={"content_type": "image/png", "size_bytes": 5000},
        headers=ann.headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["key"].startswith(user_prefix(ann.id)) and body["key"].endswith(".png")
    assert body["fields"]["key"] == body["key"]
    assert body["upload_url"] and body["expires_in"] == 900
    assert body["max_bytes"] == MAX_PHOTO_BYTES


def test_upload_url_rejects_bad_types_and_sizes(people, storage):
    ann = people()

    def ask(**body):
        return client.post("/trips/photos/upload-url", json=body, headers=ann.headers)

    assert ask(content_type="application/pdf", size_bytes=10).status_code == 422
    assert ask(content_type="image/jpeg", size_bytes=0).status_code == 422
    assert ask(content_type="image/jpeg", size_bytes=MAX_PHOTO_BYTES + 1).status_code == 422


def test_photo_endpoints_say_503_until_s3_is_set_up(people, codes, no_storage):
    ann = people()
    resp = client.post(
        "/trips/photos/upload-url",
        json={"content_type": "image/jpeg", "size_bytes": 10},
        headers=ann.headers,
    )
    assert resp.status_code == 503
    assert ann.log(codes[0], photo_keys=[f"{user_prefix(ann.id)}x.jpg"]).status_code == 503
    # Trips without photos work with no storage at all.
    assert ann.log(codes[0]).status_code == 201


def test_attach_photos_in_order_and_read_signed_urls(people, codes, storage):
    ann = people()
    keys = [ann.upload(storage) for _ in range(3)]
    resp = ann.log(codes[0], photo_keys=keys)
    assert resp.status_code == 201, resp.text
    photos = resp.json()["photos"]
    assert [p["key"] for p in photos] == keys
    assert all(p["url"].startswith("https://fake-bucket.example/") for p in photos)


def test_cannot_attach_someone_elses_or_an_unuploaded_photo(people, codes, storage):
    ann, bob = people(), people()
    bobs = bob.upload(storage)
    assert ann.log(codes[0], photo_keys=[bobs]).status_code == 400  # not in ann's folder
    never_uploaded = f"{user_prefix(ann.id)}{uuid.uuid4().hex}.jpg"
    assert ann.log(codes[0], photo_keys=[never_uploaded]).status_code == 400
    sneaky = f"{user_prefix(ann.id)}../{user_prefix(bob.id)}x.jpg"
    storage.objects.add(sneaky)
    assert ann.log(codes[0], photo_keys=[sneaky]).status_code == 400


def test_a_photo_can_only_be_on_one_trip(people, codes, storage):
    ann = people()
    key = ann.upload(storage)
    assert ann.log(codes[0], photo_keys=[key]).status_code == 201
    assert ann.log(codes[1], photo_keys=[key]).status_code == 400
    assert ann.upload(storage) and ann.log(codes[0], photo_keys=[key, key]).status_code == 400


def test_at_most_eight_photos(people, codes, storage):
    ann = people()
    keys = [ann.upload(storage) for _ in range(9)]
    assert ann.log(codes[0], photo_keys=keys).status_code == 422
    assert ann.log(codes[0], photo_keys=keys[:8]).status_code == 201


def test_patch_photos_reorders_adds_and_removes_from_storage(people, codes, storage):
    ann = people()
    a, b, c = (ann.upload(storage) for _ in range(3))
    trip_id = ann.log(codes[0], photo_keys=[a, b]).json()["id"]

    resp = client.patch(f"/trips/{trip_id}", json={"photo_keys": [c, a]}, headers=ann.headers)
    assert resp.status_code == 200, resp.text
    assert [p["key"] for p in resp.json()["photos"]] == [c, a]
    assert storage.deleted == [b]  # dropped photo is removed from the bucket
    assert ann.get(trip_id).json()["photos"][0]["key"] == c


def test_deleting_a_trip_deletes_its_photos(people, codes, storage):
    ann = people()
    keys = [ann.upload(storage) for _ in range(2)]
    trip_id = ann.log(codes[0], photo_keys=keys).json()["id"]
    assert client.delete(f"/trips/{trip_id}", headers=ann.headers).status_code == 204
    assert sorted(storage.deleted) == sorted(keys)


def test_a_failing_bucket_does_not_fail_the_delete(people, codes, storage):
    ann = people()
    key = ann.upload(storage)
    trip_id = ann.log(codes[0], photo_keys=[key]).json()["id"]

    def boom(_key):
        raise RuntimeError("S3 is down")

    storage.delete = boom
    assert client.delete(f"/trips/{trip_id}", headers=ann.headers).status_code == 204
    assert ann.get(trip_id).status_code == 404


def test_photo_urls_work_for_friends_reading_a_shared_trip(people, codes, storage):
    ann, bob = people(), people()
    ann.befriend(bob)
    key = ann.upload(storage)
    trip_id = ann.log(codes[0], visibility="friends", photo_keys=[key]).json()["id"]
    assert bob.get(trip_id).json()["photos"][0]["url"].endswith("?signed=1")


# --- trails, captions and videos ------------------------------------------------


def test_several_trails_in_order(people, codes):
    ann = people()
    resp = ann.log(codes[0], trails=["  Angels Landing ", "The Narrows", "", "angels landing"])
    assert resp.status_code == 201, resp.text
    body = resp.json()
    # Trimmed, blanks and repeats (any case) dropped, order kept.
    assert body["trails"] == ["Angels Landing", "The Narrows"]
    assert body["stamp"] == "Angels Landing"  # the first, for older clients


def test_stamp_is_the_older_one_trail_form(people, codes):
    ann = people()
    trip = ann.log(codes[0], stamp="Observation Point").json()
    assert trip["trails"] == ["Observation Point"]
    # `trails` wins when both are sent.
    both = ann.log(codes[0], stamp="Ignored", trails=["Kept"]).json()
    assert both["trails"] == ["Kept"]


def test_patch_trails_and_stamp(people, codes):
    ann = people()
    trip_id = ann.log(codes[0], trails=["A", "B", "C"]).json()["id"]

    def patch(body):
        resp = client.patch(f"/trips/{trip_id}", json=body, headers=ann.headers)
        assert resp.status_code == 200, resp.text
        return resp.json()["trails"]

    assert patch({"trails": ["C", "A"]}) == ["C", "A"]
    # The older form changes only the first trail...
    assert patch({"stamp": "Z"}) == ["Z", "A"]
    # ...and null removes it, keeping the rest.
    assert patch({"stamp": None}) == ["A"]
    assert patch({"trails": []}) == []
    assert client.patch(
        f"/trips/{trip_id}", json={"trails": None}, headers=ann.headers
    ).status_code == 400


def test_at_most_twenty_trails_of_200_characters(people, codes):
    ann = people()
    assert ann.log(codes[0], trails=[f"t{i}" for i in range(21)]).status_code == 422
    assert ann.log(codes[0], trails=["x" * 201]).status_code == 422


def test_photos_with_captions(people, codes, storage):
    ann = people()
    a, b = ann.upload(storage), ann.upload(storage)
    resp = ann.log(
        codes[0], photos=[{"key": a, "caption": "First light"}, {"key": b}]
    )
    assert resp.status_code == 201, resp.text
    photos = resp.json()["photos"]
    assert [(p["key"], p["caption"], p["kind"]) for p in photos] == [
        (a, "First light", "photo"),
        (b, "", "photo"),
    ]


def test_patch_captions_and_keys_only_keeps_them(people, codes, storage):
    ann = people()
    a, b = ann.upload(storage), ann.upload(storage)
    trip_id = ann.log(codes[0], photos=[{"key": a, "caption": "One"}, {"key": b}]).json()["id"]

    resp = client.patch(
        f"/trips/{trip_id}",
        json={"photos": [{"key": b, "caption": "Now first"}, {"key": a, "caption": "One"}]},
        headers=ann.headers,
    )
    assert [(p["key"], p["caption"]) for p in resp.json()["photos"]] == [
        (b, "Now first"),
        (a, "One"),
    ]
    # The older keys-only form reorders without wiping the captions.
    resp = client.patch(f"/trips/{trip_id}", json={"photo_keys": [a, b]}, headers=ann.headers)
    assert [(p["key"], p["caption"]) for p in resp.json()["photos"]] == [
        (a, "One"),
        (b, "Now first"),
    ]


def test_captions_have_a_length_limit(people, codes, storage):
    ann = people()
    key = ann.upload(storage)
    assert ann.log(codes[0], photos=[{"key": key, "caption": "x" * 501}]).status_code == 422


def test_videos_upload_and_come_back_as_videos(people, codes, storage):
    ann = people()
    mp4 = ann.upload(storage, content_type="video/mp4")
    mov = ann.upload(storage, content_type="video/quicktime")
    assert mp4.endswith(".mp4") and mov.endswith(".mov")
    resp = ann.log(
        codes[0],
        photos=[
            {"key": mp4, "caption": "Wading in", "duration_ms": 12_500},
            {"key": mov},
        ],
    )
    assert resp.status_code == 201, resp.text
    photos = resp.json()["photos"]
    assert [(p["kind"], p["duration_ms"]) for p in photos] == [("video", 12_500), ("video", None)]


def test_videos_get_a_bigger_size_limit_than_photos(people, storage):
    ann = people()

    def ask(content_type, size_bytes):
        return client.post(
            "/trips/photos/upload-url",
            json={"content_type": content_type, "size_bytes": size_bytes},
            headers=ann.headers,
        )

    video = ask("video/mp4", 50 * 1024 * 1024)
    assert video.status_code == 200, video.text
    assert video.json()["max_bytes"] == MAX_VIDEO_BYTES
    # The same size is too big for a photo.
    assert ask("image/jpeg", 50 * 1024 * 1024).status_code == 422
    assert ask("video/mp4", MAX_VIDEO_BYTES + 1).status_code == 422


# --- the real S3 signer, offline ----------------------------------------------------


def test_s3_storage_signs_uploads_without_network(monkeypatch):
    from app import storage as storage_module
    from app.config import settings

    monkeypatch.setattr(settings, "s3_bucket", "parkpath-test")
    monkeypatch.setattr(settings, "s3_region", "us-east-1")
    monkeypatch.setattr(settings, "aws_access_key_id", "AKIAFAKEFAKEFAKEFAKE")
    monkeypatch.setattr(settings, "aws_secret_access_key", "fake-secret")
    monkeypatch.setattr(storage_module, "_storage", None)

    s3 = storage_module.get_storage()
    assert isinstance(s3, storage_module.S3Storage)
    signed = s3.signed_upload("trips/1/abc.jpg", "image/jpeg")
    assert "parkpath-test" in signed.url
    assert signed.fields["key"] == "trips/1/abc.jpg"
    assert signed.fields["Content-Type"] == "image/jpeg"
    assert "policy" in signed.fields and "x-amz-signature" in signed.fields
    assert signed.expires_in == settings.s3_url_expire_seconds
    read = s3.signed_url("trips/1/abc.jpg")
    assert "trips/1/abc.jpg" in read and "X-Amz-Signature" in read

    monkeypatch.setattr(storage_module, "_storage", None)


def test_storage_is_off_without_a_bucket(monkeypatch):
    from app import storage as storage_module
    from app.config import settings

    monkeypatch.setattr(settings, "s3_bucket", "")
    assert storage_module.get_storage() is None


def test_upload_content_types_match_the_schema():
    from typing import get_args

    from app.schemas import PhotoUploadRequest
    from app.storage import ALLOWED_CONTENT_TYPES

    literal = PhotoUploadRequest.model_fields["content_type"].annotation
    assert set(get_args(literal)) == set(ALLOWED_CONTENT_TYPES)
