"""
Photo and video storage: signed-URL uploads to S3.

Photos and videos never pass through the API. The flow:

  1. The app asks POST /trips/photos/upload-url for permission to upload one
     photo. The API picks a storage key under the caller's own folder
     (trips/<user id>/<random>.<ext>) and returns a short-lived signed form:
     a URL plus fields the app must send with the file.
  2. The app POSTs the file to that URL, straight to S3. The signature pins
     the key, the content type and a maximum size, so the form can't be
     used for anything else.
  3. The app saves or edits a trip with the key in `photo_keys`. The API
     checks the key is in the caller's folder and that the object really
     exists, then stores the key on the entry.
  4. Reading: entries come back with a short-lived signed GET url per photo.
     The bucket stays private; there are no permanent public links.

Everything the routes need from S3 is behind the small `Storage` interface
below so tests can swap in an in-memory fake (see tests/test_trips.py) and
so the bucket can be set up later: with S3_BUCKET empty `get_storage()`
returns None and the photo endpoints answer 503.

Bucket setup (once, in AWS): a private bucket, "Block all public access" on,
and a CORS rule allowing POST from anywhere (the app isn't a browser, but
Expo web would be). The IAM user the API runs as needs s3:PutObject,
s3:GetObject and s3:DeleteObject on the bucket's trips/* keys.
"""

import uuid
from dataclasses import dataclass
from typing import Protocol

from app.config import settings

# What the phone may upload, and the file extension we store each as.
ALLOWED_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
}
VIDEO_EXTENSIONS = {"mp4", "mov"}
MAX_PHOTO_BYTES = 10 * 1024 * 1024  # 10 MB; phone photos are ~1 to 4 MB
# The app takes clips up to a minute; a minute of 1080p phone video is
# roughly 60 to 130 MB depending on the phone.
MAX_VIDEO_BYTES = 150 * 1024 * 1024


def max_bytes_for(content_type: str) -> int:
    """The largest upload allowed for a content type."""
    return MAX_VIDEO_BYTES if content_type.startswith("video/") else MAX_PHOTO_BYTES


def media_kind(key: str) -> str:
    """"video" or "photo", from the extension the key was given at upload."""
    return "video" if key.rsplit(".", 1)[-1].lower() in VIDEO_EXTENSIONS else "photo"


@dataclass
class SignedUpload:
    url: str
    fields: dict[str, str]
    expires_in: int


class Storage(Protocol):
    def signed_upload(self, key: str, content_type: str) -> SignedUpload: ...
    def signed_url(self, key: str) -> str: ...
    def exists(self, key: str) -> bool: ...
    def delete(self, key: str) -> None: ...


def user_prefix(user_id: int) -> str:
    """Every key a user may upload or attach starts with this."""
    return f"trips/{user_id}/"


def new_photo_key(user_id: int, content_type: str) -> str:
    return f"{user_prefix(user_id)}{uuid.uuid4().hex}.{ALLOWED_CONTENT_TYPES[content_type]}"


class S3Storage:
    def __init__(self) -> None:
        import boto3
        from botocore.config import Config

        kwargs: dict = {
            "region_name": settings.s3_region,
            # Signature v4 is required for presigned POST in every region.
            "config": Config(signature_version="s3v4"),
        }
        if settings.s3_endpoint_url:
            kwargs["endpoint_url"] = settings.s3_endpoint_url
        if settings.aws_access_key_id and settings.aws_secret_access_key:
            kwargs["aws_access_key_id"] = settings.aws_access_key_id
            kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
        self.bucket = settings.s3_bucket
        self.client = boto3.client("s3", **kwargs)

    def signed_upload(self, key: str, content_type: str) -> SignedUpload:
        expires = settings.s3_url_expire_seconds
        post = self.client.generate_presigned_post(
            self.bucket,
            key,
            Fields={"Content-Type": content_type},
            Conditions=[
                {"Content-Type": content_type},
                ["content-length-range", 1, max_bytes_for(content_type)],
            ],
            ExpiresIn=expires,
        )
        return SignedUpload(url=post["url"], fields=post["fields"], expires_in=expires)

    def signed_url(self, key: str) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=settings.s3_url_expire_seconds,
        )

    def exists(self, key: str) -> bool:
        from botocore.exceptions import ClientError

        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
                return False
            raise
        return True

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)


_storage: Storage | None = None


def get_storage() -> Storage | None:
    """FastAPI dependency: the configured storage, or None until S3 is set up."""
    global _storage
    if not settings.s3_bucket:
        return None
    if _storage is None:
        _storage = S3Storage()
    return _storage
