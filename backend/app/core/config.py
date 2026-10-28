from functools import lru_cache
from typing import Annotated

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Placeholder for local development only; production refuses to start with it.
DEVELOPMENT_SECRET = "development-only-change-me"  # noqa: S105


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore")

    app_name: str = "Spendova API"
    app_version: str = "0.8.0"
    environment: str = "development"
    database_url: str = "sqlite:///./spendova.db"
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]
    auth_required: bool = False
    firebase_project_id: str | None = None
    # Firebase Admin credentials (service-account JSON as one line). Required to
    # change passwords from the server; never expose it to the frontend.
    firebase_service_account_json: str | None = None

    # Email delivery. "console" prints messages locally; "smtp" delivers them.
    email_delivery_mode: str = "console"
    email_from: str = "Spendova <no-reply@spendova.app>"
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_use_tls: bool = True
    smtp_timeout_seconds: int = 15
    # Optional secret (32+ characters) that unlocks POST /health/email test sends.
    # Never reuse the SMTP password here.
    email_test_api_key: str | None = None
    # Durable outbox: queued mail is retried with backoff until sent or expired.
    email_outbox_worker_enabled: bool = True
    email_outbox_poll_seconds: int = 30
    email_outbox_max_attempts: int = 8
    email_outbox_default_ttl_hours: int = 24
    email_outbox_retention_days: int = 30
    # Public web address used for links inside emails.
    app_url: str = "http://localhost:5173"

    # Keys. Both must be long random values in production.
    otp_secret: str = DEVELOPMENT_SECRET
    data_encryption_key: str = DEVELOPMENT_SECRET
    otp_expiry_minutes: int = 10
    password_reset_code_minutes: int = 10
    password_reset_token_minutes: int = 15

    # Vercel sets VERCEL=1 in its functions. Serverless instances freeze between requests, so
    # there is no background worker loop and no connection pool there.
    vercel: bool = False
    # Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" to the scheduled endpoints.
    cron_secret: str | None = None

    # Per-IP sliding-window limits (in-memory, per instance).
    rate_limit_enabled: bool = True
    rate_limit_window_seconds: int = 60
    rate_limit_global_requests: int = 300
    rate_limit_auth_requests: int = 10

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def show_development_codes(self) -> bool:
        """One-time codes are echoed to the browser only for local console delivery."""
        return self.environment in {"development", "test"} and self.email_delivery_mode == "console"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("database_url", mode="before")
    @classmethod
    def select_psycopg_driver(cls, value: object) -> object:
        if isinstance(value, str) and value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    @model_validator(mode="after")
    def production_is_locked_down(self) -> "Settings":
        """Refuse to start an unsafe production server instead of failing open."""
        if not self.is_production:
            return self
        problems = []
        if not self.auth_required:
            problems.append("AUTH_REQUIRED must be true")
        if not self.firebase_project_id:
            problems.append("FIREBASE_PROJECT_ID is required")
        for name in ("otp_secret", "data_encryption_key"):
            value = getattr(self, name)
            if value == DEVELOPMENT_SECRET or len(value) < 32:
                problems.append(f"{name.upper()} must be a random value of at least 32 characters")
        if self.email_delivery_mode != "smtp":
            problems.append("EMAIL_DELIVERY_MODE must be smtp")
        for name in ("smtp_host", "smtp_username", "smtp_password", "email_from"):
            if not getattr(self, name):
                problems.append(f"{name.upper()} is required")
        if self.email_test_api_key and len(self.email_test_api_key) < 32:
            problems.append("EMAIL_TEST_API_KEY must be at least 32 characters (or unset)")
        if self.cron_secret and len(self.cron_secret) < 32:
            problems.append("CRON_SECRET must be at least 32 characters (or unset)")
        if problems:
            raise ValueError("Unsafe production configuration: " + "; ".join(problems))
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
