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

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_origins.split(",")]


settings = Settings()
