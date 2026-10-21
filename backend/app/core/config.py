from functools import lru_cache
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore")

    app_name: str = "Spendova API"
    app_version: str = "0.7.0"
    environment: str = "development"
    database_url: str = "sqlite:///./spendova.db"
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]
    auth_required: bool = False
    firebase_project_id: str | None = None
    email_delivery_mode: str = "console"
    email_from: str = "Spendova <no-reply@spendova.app>"
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_use_tls: bool = True
    otp_secret: str = "development-only-change-me"
    otp_expiry_minutes: int = 10
    # Password reset: emailed code lifetime, then a short window to set the new password.
    password_reset_code_minutes: int = 10
    password_reset_token_minutes: int = 15
    # Firebase Admin credentials (service-account JSON as one line). Required to
    # change passwords from the server; never expose it to the frontend.
    firebase_service_account_json: str | None = None
    # Public web address used for links inside emails.
    app_url: str = "http://localhost:5173"

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


@lru_cache
def get_settings() -> Settings:
    return Settings()
