"""
Trip journal routes (all require a signed-in user):

  POST   /trips                    log a visit
  GET    /trips                    my entries, newest visit first (?park_code=)
  GET    /trips/feed               friends' shared entries, newest posted first
  POST   /trips/photos/upload-url  signed form to upload one photo to S3
  GET    /trips/{id}               one entry (mine, or a friend's if shared)
  PATCH  /trips/{id}               change my entry (only the fields sent)
  DELETE /trips/{id}               delete my entry and its photos

Logging an entry is what marks a park visited (see app/passport.py).
Who may read an entry is decided in app/visibility.py: entries start
private, and "friends" shares one with accepted friends only.

Not-found vs forbidden: an entry you may not see is 404, never 403, so ids
don't reveal what exists. A friend who can read an entry but isn't its owner
gets 403 if they try to change it.

Photos are uploaded straight to S3 with a signed form (app/storage.py);
entries only hold the storage keys, and come back with short-lived signed
URLs. The photo endpoints answer 503 until S3 is configured.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Site, TripCompanion, TripEntry, TripPhoto, User
from app.schemas import (
    PhotoUploadOut,
    PhotoUploadRequest,
    TripCreate,
    TripOut,
    TripPhotoOut,
    TripUpdate,
    UserOut,
)
from app.storage import MAX_PHOTO_BYTES, Storage, get_storage, new_photo_key, user_prefix
from app.visibility import Visibility, can_view, friend_ids

logger = logging.getLogger(__name__)

router = APIRouter()


# --- helpers -----------------------------------------------------------------


def _out(entry: TripEntry, storage: Storage | None) -> TripOut:
    return TripOut(
        id=entry.id,
        owner=UserOut.model_validate(entry.user),
        park_code=entry.site.park_code,
        park_name=entry.site.name,
        visited_on=entry.visited_on,
        title=entry.title,
        notes=entry.notes,
        rating=entry.rating,
        stamp=entry.stamp,
        visibility=Visibility(entry.visibility),
        photos=[
            TripPhotoOut(
                key=p.storage_key, url=storage.signed_url(p.storage_key) if storage else None
            )
            for p in entry.photos
        ],
        companions=[UserOut.model_validate(c.user) for c in entry.companions],
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


def _site(db: Session, park_code: str) -> Site:
    site = db.scalars(select(Site).where(Site.park_code == park_code.lower())).first()
    if site is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Site not found")
    return site


def _viewable(db: Session, trip_id: int, me: User) -> TripEntry:
    entry = db.get(TripEntry, trip_id)
    if entry is None or not can_view(db, me.id, entry.user_id, entry.visibility):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Trip not found")
    return entry


def _owned(db: Session, trip_id: int, me: User) -> TripEntry:
    entry = _viewable(db, trip_id, me)
    if entry.user_id != me.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Only the owner can change a trip")
    return entry


def _bad_request(detail: str) -> HTTPException:
    return HTTPException(status.HTTP_400_BAD_REQUEST, detail=detail)


def _storage_off() -> HTTPException:
    return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="Photo storage isn't set up")


def _check_companions(db: Session, me: User, ids: list[int]) -> list[int]:
    if len(set(ids)) != len(ids):
        raise _bad_request("Each friend can only be tagged once")
    strangers = set(ids) - friend_ids(db, me.id)
    if strangers:
        raise _bad_request("You can only tag your friends")
    return ids


def _check_photo_keys(
    db: Session, me: User, storage: Storage | None, keys: list[str], keep: set[str]
) -> None:
    """New keys must be uploads by me that exist and aren't on any entry yet."""
    if len(set(keys)) != len(keys):
        raise _bad_request("A photo can only be added once")
    new = [k for k in keys if k not in keep]
    if not new:
        return
    if storage is None:
        raise _storage_off()
    prefix = user_prefix(me.id)
    for key in new:
        if not key.startswith(prefix) or ".." in key:
            raise _bad_request("Unknown photo key")
        if not storage.exists(key):
            raise _bad_request("A photo hasn't finished uploading")
    taken = db.scalars(select(TripPhoto.storage_key).where(TripPhoto.storage_key.in_(new))).all()
    if taken:
        raise _bad_request("A photo is already on another trip")


def _delete_objects(storage: Storage | None, keys: list[str]) -> None:
    """Best effort: a failure leaves an orphan object, not a broken request."""
    if storage is None:
        return
    for key in keys:
        try:
            storage.delete(key)
        except Exception:  # noqa: BLE001 - never fail a request over cleanup
            logger.warning("Could not delete photo %s", key, exc_info=True)


# --- routes ------------------------------------------------------------------


@router.post("", response_model=TripOut, status_code=status.HTTP_201_CREATED)
def create_trip(
    payload: TripCreate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
    storage: Storage | None = Depends(get_storage),
):
    site = _site(db, payload.park_code)
    companions = _check_companions(db, me, payload.companion_ids)
    _check_photo_keys(db, me, storage, payload.photo_keys, keep=set())
    entry = TripEntry(
        user_id=me.id,
        site_id=site.id,
        visited_on=payload.visited_on,
        title=payload.title.strip(),
        notes=payload.notes,
        rating=payload.rating,
        stamp=(payload.stamp or "").strip() or None,
        visibility=payload.visibility.value,
        photos=[TripPhoto(storage_key=k, position=i) for i, k in enumerate(payload.photo_keys)],
        companions=[TripCompanion(user_id=uid) for uid in companions],
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _out(entry, storage)


@router.get("", response_model=list[TripOut])
def list_my_trips(
    park_code: str | None = Query(None, description="Only entries for this park"),
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
    storage: Storage | None = Depends(get_storage),
):
    stmt = select(TripEntry).where(TripEntry.user_id == me.id)
    if park_code:
        stmt = stmt.join(TripEntry.site).where(Site.park_code == park_code.lower())
    stmt = stmt.order_by(TripEntry.visited_on.desc(), TripEntry.id.desc())
    return [_out(e, storage) for e in db.scalars(stmt).unique().all()]


@router.get("/feed", response_model=list[TripOut])
def friends_feed(
    limit: int = Query(20, ge=1, le=50),
    before: int | None = Query(None, description="Entry id: only entries posted before it"),
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
    storage: Storage | None = Depends(get_storage),
):
    """Entries my friends shared with friends, newest first. Page with `before`."""
    friends = friend_ids(db, me.id)
    if not friends:
        return []
    stmt = select(TripEntry).where(
        TripEntry.user_id.in_(friends), TripEntry.visibility == Visibility.FRIENDS.value
    )
    if before is not None:
        stmt = stmt.where(TripEntry.id < before)
    stmt = stmt.order_by(TripEntry.id.desc()).limit(limit)
    return [_out(e, storage) for e in db.scalars(stmt).unique().all()]


@router.post("/photos/upload-url", response_model=PhotoUploadOut)
def photo_upload_url(
    payload: PhotoUploadRequest,
    me: User = Depends(get_current_user),
    storage: Storage | None = Depends(get_storage),
):
    if storage is None:
        raise _storage_off()
    key = new_photo_key(me.id, payload.content_type)
    signed = storage.signed_upload(key, payload.content_type)
    return PhotoUploadOut(
        key=key,
        upload_url=signed.url,
        fields=signed.fields,
        expires_in=signed.expires_in,
        max_bytes=MAX_PHOTO_BYTES,
    )


@router.get("/{trip_id}", response_model=TripOut)
def read_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
    storage: Storage | None = Depends(get_storage),
):
    return _out(_viewable(db, trip_id, me), storage)


@router.patch("/{trip_id}", response_model=TripOut)
def update_trip(
    trip_id: int,
    payload: TripUpdate,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
    storage: Storage | None = Depends(get_storage),
):
    entry = _owned(db, trip_id, me)
    sent = payload.model_fields_set

    # Fields that can't be null on the entry: sending null means "leave it".
    for name in ("visited_on", "title", "notes", "visibility"):
        value = getattr(payload, name)
        if name in sent and value is None:
            raise _bad_request(f"{name} can't be null")
    if "visited_on" in sent:
        entry.visited_on = payload.visited_on
    if "title" in sent:
        entry.title = payload.title.strip()
    if "notes" in sent:
        entry.notes = payload.notes
    if "rating" in sent:
        entry.rating = payload.rating
    if "stamp" in sent:
        entry.stamp = (payload.stamp or "").strip() or None
    if "visibility" in sent:
        entry.visibility = payload.visibility.value

    removed: list[str] = []
    if "companion_ids" in sent:
        if payload.companion_ids is None:
            raise _bad_request("companion_ids can't be null")
        ids = _check_companions(db, me, payload.companion_ids)
        entry.companions = [TripCompanion(user_id=uid) for uid in ids]
    if "photo_keys" in sent:
        if payload.photo_keys is None:
            raise _bad_request("photo_keys can't be null")
        current = {p.storage_key: p for p in entry.photos}
        _check_photo_keys(db, me, storage, payload.photo_keys, keep=set(current))
        removed = [k for k in current if k not in payload.photo_keys]
        # Re-use rows for kept photos so they aren't deleted and re-inserted.
        entry.photos = [
            current.get(k) or TripPhoto(storage_key=k, position=i)
            for i, k in enumerate(payload.photo_keys)
        ]
        for i, photo in enumerate(entry.photos):
            photo.position = i
    db.commit()
    db.refresh(entry)
    _delete_objects(storage, removed)
    return _out(entry, storage)


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    me: User = Depends(get_current_user),
    storage: Storage | None = Depends(get_storage),
):
    entry = _owned(db, trip_id, me)
    keys = [p.storage_key for p in entry.photos]
    db.delete(entry)
    db.commit()
    _delete_objects(storage, keys)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
