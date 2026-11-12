from functools import lru_cache
from typing import Annotated
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Placeholder for local development only; production refuses to start with it.
DEVELOPMENT_SECRET = "development-only-change-me"  # noqa: S105


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore")

    app_name: str = "Spendova API"
    app_version: str = "0.8.0"
    environment: str = "development"
    database_url: str = "sqlite:///./spendova.db"
    # Optional non-transaction-pooler connection used only by Alembic migrations.
    direct_url: str | None = None
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]
    auth_required: bool = False
    jwt_access_secret: str = DEVELOPMENT_SECRET
    access_token_ttl_minutes: int = Field(default=15, ge=1, le=60)
    refresh_token_ttl_days: int = Field(default=30, ge=1, le=90)
    refresh_cookie_name: str = "spendova_refresh"
    enable_api_docs: bool = False
    swagger_username: str | None = None
    swagger_password: str | None = Field(default=None, repr=False)
    swagger_session_ttl_minutes: int = Field(default=60, ge=5, le=480)

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

    openai_api_key: str | None = None
    finance_assistant_model: str = "gpt-4.1-mini"
    rate_limit_assistant_requests: int = 10
    finance_assistant_daily_token_limit: int = Field(default=20000, ge=0, le=1000000)
    finance_assistant_max_daily_tokens: int = Field(default=100000, ge=0, le=1000000)
    finance_assistant_reset_timezone: str = "Asia/Kolkata"
    reminders_enabled: bool = True
    reminder_poll_seconds: int = Field(default=300, ge=30, le=86400)

    # Per-IP sliding-window limits (in-memory, per instance).
    rate_limit_enabled: bool = True
    rate_limit_window_seconds: int = 60
    rate_limit_global_requests: int = 300
    rate_limit_auth_requests: int = 10
    rate_limit_refresh_requests: int = 120

    @field_validator("finance_assistant_reset_timezone")
    @classmethod
    def valid_reset_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError("Use a valid IANA reset timezone") from exc
        return value

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

    @field_validator("database_url", "direct_url", mode="before")
    @classmethod
    def select_psycopg_driver(cls, value: object) -> object:
        if isinstance(value, str) and value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    @model_validator(mode="after")
    def production_is_locked_down(self) -> "Settings":
        """Refuse to start an unsafe production server instead of failing open."""
        if self.enable_api_docs:
            if not self.swagger_username or not self.swagger_username.strip() or ":" in self.swagger_username:
                raise ValueError("SWAGGER_USERNAME is required and must not contain a colon")
            if (
                not self.swagger_password
                or not self.swagger_password.strip()
                or not 8 <= len(self.swagger_password) <= 1024
            ):
                raise ValueError("SWAGGER_PASSWORD must be between 8 and 1024 characters")
        if not self.is_production:
            return self
        problems = []
        if not self.auth_required:
            problems.append("AUTH_REQUIRED must be true")
        for name in ("otp_secret", "data_encryption_key", "jwt_access_secret"):
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
