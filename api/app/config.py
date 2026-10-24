"""
Central app configuration.

All settings are read from environment variables (or a local .env file
during development). Nothing here should be hardcoded per-environment —
Docker Compose, CI, and Render all inject DATABASE_URL differently.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Example (local docker-compose default):
    # postgresql://parkpath:parkpath@db:5432/parkpath
    database_url: str = "postgresql://parkpath:parkpath@localhost:5432/parkpath"

    # Used for CORS and any environment-specific behavior later.
    environment: str = "development"

    # Comma-separated list of allowed origins for the mobile app / local dev.
    # e.g. "http://localhost:19006,https://parkpath.app"
    cors_origins: str = "*"

    # --- Auth / JWT ---
    # DEV DEFAULT ONLY — every real environment (CI, Render, teammates'
    # machines) must set its own SECRET_KEY via env var. Never commit a
    # real secret; this fallback exists purely so the app doesn't crash
    # with no .env present.
    secret_key: str = "dev-only-insecure-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24h — fine for a skeleton; tighten later

    # --- NPS sync job ---
    # Free key from https://www.nps.gov/subjects/developer/get-started.htm
    # Put it in api/.env as NPS_API_KEY=... (never commit it). Empty by
    # default so the API and tests run fine without one.
    nps_api_key: str = ""

    # --- Trip photo storage (S3) ---
    # Photos go from the phone straight to the bucket with a signed URL
    # (app/storage.py). Leave S3_BUCKET empty and the photo endpoints answer
    # 503 "not configured"; everything else in trips works without it.
    # Credentials: set both keys below, or leave them empty to use whatever
    # boto3 finds itself (an IAM role, AWS_PROFILE, ...).
    s3_bucket: str = ""
    s3_region: str = "us-east-1"
    # Only for S3-compatible stores such as MinIO; empty means real AWS S3.
    s3_endpoint_url: str = ""
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    # Signed URLs stop working after this long.
    s3_url_expire_seconds: int = 15 * 60

    # --- Google sign-in ---
    # OAuth client ids from Google Cloud, comma-separated: the web client
    # id (Android sign-in tokens are issued for it) and the iOS one. Empty
    # turns Google sign-in off (POST /auth/google answers 503).
    google_client_ids: str = ""

    @property
    def google_client_id_list(self) -> list[str]:
        return [cid.strip() for cid in self.google_client_ids.split(",") if cid.strip()]

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_origins.split(",")]


settings = Settings()
