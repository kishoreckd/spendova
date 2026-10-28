"""SMTP settings boundary. Credentials come from backend secrets, never from templates."""

from dataclasses import dataclass, field

from app.core.config import get_settings


@dataclass(frozen=True)
class EmailConfig:
    host: str
    port: int
    sender: str
    username: str | None = None
    password: str | None = field(default=None, repr=False)
    starttls: bool = True


def get_email_config() -> EmailConfig | None:
    """SMTP configuration, or None when delivery is console-only or incomplete."""
    settings = get_settings()
    if settings.email_delivery_mode != "smtp" or not settings.smtp_host:
        return None
    if bool(settings.smtp_username) != bool(settings.smtp_password):
        return None
    return EmailConfig(
        settings.smtp_host,
        settings.smtp_port,
        settings.email_from,
        settings.smtp_username,
        settings.smtp_password,
        settings.smtp_use_tls,
    )


def email_enabled() -> bool:
    """True when messages actually leave the server (console mode only prints them)."""
    return get_email_config() is not None
