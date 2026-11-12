"""Create a private Spendova production env without printing secret values."""

from __future__ import annotations

import argparse
import secrets
from email.utils import formataddr, parseaddr
from pathlib import Path


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip().upper()] = value.strip().strip('"').strip("'")
    return values


def secret(existing: dict[str, str], key: str, *, rotate: bool) -> str:
    current = existing.get(key, "")
    placeholders = {"", "development-only-change-me", "replace-with-a-long-random-secret"}
    return current if not rotate and current not in placeholders else secrets.token_urlsafe(48)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("password_env", type=Path, help="Private Password/Vaultessa env source")
    parser.add_argument("--rotate-app-secrets", action="store_true")
    args = parser.parse_args()

    backend = Path(__file__).resolve().parents[1]
    target = backend / ".env.production"
    existing = read_env(target)
    shared = read_env(args.password_env)

    smtp_from = shared.get("SMTP_FROM", shared.get("EMAIL_FROM", ""))
    _, sender_address = parseaddr(smtp_from)
    smtp_from = formataddr(("Spendova", sender_address)) if sender_address else smtp_from
    smtp_tls = shared.get("SMTP_STARTTLS", shared.get("SMTP_USE_TLS", "true"))
    swagger_username = "spendova_admin"
    rotate = args.rotate_app_secrets

    values = {
        "APP_NAME": "Spendova API",
        "APP_VERSION": "0.8.0",
        "ENVIRONMENT": "production",
        "VERCEL": "true",
        "ENABLE_API_DOCS": "true",
        "SWAGGER_USERNAME": swagger_username,
        "SWAGGER_PASSWORD": secret(existing, "SWAGGER_PASSWORD", rotate=rotate),
        "SWAGGER_SESSION_TTL_MINUTES": "60",
        # Never copy another application's database credentials.
        "DATABASE_URL": existing.get("DATABASE_URL", ""),
        "DIRECT_URL": existing.get("DIRECT_URL", ""),
        "APP_URL": existing.get("APP_URL") or "https://spendova-jet.vercel.app",
        "CORS_ORIGINS": existing.get("CORS_ORIGINS") or "https://spendova-jet.vercel.app",
        "AUTH_REQUIRED": "true",
        "JWT_ACCESS_SECRET": secret(existing, "JWT_ACCESS_SECRET", rotate=rotate),
        "ACCESS_TOKEN_TTL_MINUTES": "15",
        "REFRESH_TOKEN_TTL_DAYS": "30",
        "REFRESH_COOKIE_NAME": "spendova_refresh",
        "OTP_SECRET": secret(existing, "OTP_SECRET", rotate=rotate),
        "DATA_ENCRYPTION_KEY": secret(existing, "DATA_ENCRYPTION_KEY", rotate=rotate),
        "OTP_EXPIRY_MINUTES": "10",
        "PASSWORD_RESET_CODE_MINUTES": "10",
        "PASSWORD_RESET_TOKEN_MINUTES": "15",
        "EMAIL_DELIVERY_MODE": "smtp",
        "SMTP_HOST": shared.get("SMTP_HOST", "smtp-relay.brevo.com"),
        "SMTP_PORT": shared.get("SMTP_PORT", "587"),
        "SMTP_USERNAME": shared.get("SMTP_USERNAME", ""),
        "SMTP_PASSWORD": shared.get("SMTP_PASSWORD", ""),
        "SMTP_USE_TLS": smtp_tls,
        "SMTP_TIMEOUT_SECONDS": shared.get("SMTP_TIMEOUT_SECONDS", "15"),
        "EMAIL_FROM": smtp_from,
        "EMAIL_OUTBOX_MAX_ATTEMPTS": "8",
        "EMAIL_OUTBOX_WORKER_ENABLED": "false",
        "EMAIL_OUTBOX_POLL_SECONDS": "30",
        "EMAIL_OUTBOX_DEFAULT_TTL_HOURS": "24",
        "EMAIL_OUTBOX_RETENTION_DAYS": "30",
        "CRON_SECRET": secret(existing, "CRON_SECRET", rotate=rotate),
        "RATE_LIMIT_ENABLED": "true",
        "RATE_LIMIT_WINDOW_SECONDS": "60",
        "RATE_LIMIT_GLOBAL_REQUESTS": "300",
        "RATE_LIMIT_AUTH_REQUESTS": "10",
        "RATE_LIMIT_REFRESH_REQUESTS": "120",
        "OPENAI_API_KEY": existing.get("OPENAI_API_KEY", ""),
        "FINANCE_ASSISTANT_MODEL": "gpt-4.1-mini",
        "RATE_LIMIT_ASSISTANT_REQUESTS": "10",
        "FINANCE_ASSISTANT_DAILY_TOKEN_LIMIT": "20000",
        "FINANCE_ASSISTANT_MAX_DAILY_TOKENS": "100000",
        "FINANCE_ASSISTANT_RESET_TIMEZONE": "Asia/Kolkata",
        "REMINDERS_ENABLED": "true",
        "REMINDER_POLL_SECONDS": "300",
    }

    sections = [
        (
            "Runtime",
            [
                "APP_NAME", "APP_VERSION", "ENVIRONMENT", "VERCEL", "APP_URL", "CORS_ORIGINS",
                "DATABASE_URL", "DIRECT_URL",
            ],
            ["DATABASE_URL uses Supabase transaction mode (6543); DIRECT_URL uses session mode (5432)."],
        ),
        (
            "Protected Swagger documentation",
            ["ENABLE_API_DOCS", "SWAGGER_USERNAME", "SWAGGER_PASSWORD", "SWAGGER_SESSION_TTL_MINUTES"],
            ["These credentials protect /api/docs and are separate from customer sign-in."],
        ),
        (
            "Account authentication",
            [
                "AUTH_REQUIRED", "JWT_ACCESS_SECRET", "ACCESS_TOKEN_TTL_MINUTES",
                "REFRESH_TOKEN_TTL_DAYS", "REFRESH_COOKIE_NAME", "OTP_SECRET",
                "DATA_ENCRYPTION_KEY", "OTP_EXPIRY_MINUTES", "PASSWORD_RESET_CODE_MINUTES",
                "PASSWORD_RESET_TOKEN_MINUTES",
            ],
            ["JWT/OTP/encryption values are Spendova-only secrets and must not be shared with another app."],
        ),
        (
            "Brevo transactional email",
            [
                "EMAIL_DELIVERY_MODE", "SMTP_HOST", "SMTP_PORT", "SMTP_USERNAME", "SMTP_PASSWORD",
                "SMTP_USE_TLS", "SMTP_TIMEOUT_SECONDS", "EMAIL_FROM", "EMAIL_OUTBOX_MAX_ATTEMPTS",
                "EMAIL_OUTBOX_WORKER_ENABLED", "EMAIL_OUTBOX_POLL_SECONDS",
                "EMAIL_OUTBOX_DEFAULT_TTL_HOURS", "EMAIL_OUTBOX_RETENTION_DAYS",
            ],
            ["SMTP_PASSWORD is a Brevo SMTP key, not the Brevo account password."],
        ),
        (
            "Scheduled jobs and rate limits",
            [
                "CRON_SECRET", "RATE_LIMIT_ENABLED", "RATE_LIMIT_WINDOW_SECONDS",
                "RATE_LIMIT_GLOBAL_REQUESTS", "RATE_LIMIT_AUTH_REQUESTS", "RATE_LIMIT_REFRESH_REQUESTS",
            ],
            ["CRON_SECRET authenticates Vercel Cron requests to protected cron endpoints."],
        ),
        (
            "Optional finance assistant",
            [
                "OPENAI_API_KEY", "FINANCE_ASSISTANT_MODEL", "RATE_LIMIT_ASSISTANT_REQUESTS",
                "FINANCE_ASSISTANT_DAILY_TOKEN_LIMIT", "FINANCE_ASSISTANT_MAX_DAILY_TOKENS",
                "FINANCE_ASSISTANT_RESET_TIMEZONE",
            ],
            ["AI is opt-in per chat request. Local summaries and calculators work without OPENAI_API_KEY."],
        ),
        (
            "Reminders",
            ["REMINDERS_ENABLED", "REMINDER_POLL_SECONDS"],
            ["Users must explicitly enable reminders in their own settings."],
        ),
    ]
    lines = ["# PRIVATE Spendova production configuration. Never commit or share."]
    for title, keys, comments in sections:
        lines.extend(["", f"# --- {title} " + "-" * max(1, 70 - len(title))])
        lines.extend(f"# {comment}" for comment in comments)
        lines.extend(f"{key}={values[key]}" for key in keys)
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Configured {len(values)} production variables in the Git-ignored backend env file.")


if __name__ == "__main__":
    main()
