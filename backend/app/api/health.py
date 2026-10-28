from datetime import UTC, datetime, timedelta
from secrets import compare_digest
from threading import Lock
from time import monotonic

from fastapi import APIRouter, Depends, Header
from fastapi.security import APIKeyHeader
from pydantic import Field
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings
from app.core.deps import DbSession
from app.core.errors import AppError
from app.core.rate_limit import auth_limit
from app.core.schema import Email, RequestModel
from app.db.model_helpers import utcnow
from app.db.models.email_outbox_model import EmailOutbox
from app.services import email_outbox_service, email_service
from app.services.email_config import email_enabled
from app.services.email_service import EmailDeliveryResult
from app.utils.validation.json_validator import JsonResponse

router = APIRouter(tags=["operations"])

TEST_CATEGORY = "diagnostic"
_check_lock = Lock()
_check_cache: tuple[float, dict[str, str]] | None = None
_test_key_header = APIKeyHeader(name="X-Email-Test-Key", auto_error=False)


@router.get("/health")
def health(db: DbSession):
    """Liveness and database reachability."""
    data = {
        "status": "ok",
        "version": get_settings().app_version,
        "time": datetime.now(UTC),
        "db": "ok",
        "email": "configured" if email_enabled() else "not_configured",
    }
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        data.update(status="degraded", db="unreachable", code="SERVICE_UNAVAILABLE")
        return JsonResponse.error("Database unavailable", data, status_code=503)
    return JsonResponse.success("Spendova API is healthy", data)


@router.get("/health/email")
def email_health():
    """Connects and logs in to SMTP without sending mail. Cached per instance for 60 seconds."""
    global _check_cache
    with _check_lock:
        if _check_cache is None or monotonic() >= _check_cache[0]:
            _check_cache = (monotonic() + 60, email_service.check_connection())
        data = {**_check_cache[1], "cache_seconds": 60}
    if data["stage"] != "complete":
        return JsonResponse.error("Email connectivity check failed", data, status_code=503)
    return JsonResponse.success("SMTP login works. Inbox delivery was not tested.", data)


def require_cron_secret(authorization: str | None = Header(default=None)) -> None:
    """Vercel Cron calls with `Authorization: Bearer <CRON_SECRET>`."""
    configured = get_settings().cron_secret
    if not configured:
        raise AppError(503, "CRON_DISABLED", "Set CRON_SECRET to enable scheduled jobs")
    expected = f"Bearer {configured}"
    if not authorization or not compare_digest(authorization.encode(), expected.encode()):
        raise AppError.unauthorized("Invalid cron secret")


@router.get("/cron/email-outbox", dependencies=[Depends(require_cron_secret)])
def retry_email_outbox():
    """Resends due emails and prunes old outbox rows (scheduled in backend/vercel.json)."""
    counts = email_outbox_service.run_once()
    return JsonResponse.success("Email outbox processed", counts)


def require_email_test_key(key: str | None = Depends(_test_key_header)) -> None:
    configured = get_settings().email_test_api_key
    if not configured or len(configured) < 32:
        raise AppError(503, "EMAIL_TEST_DISABLED", "Set EMAIL_TEST_API_KEY (32+ characters) to enable test emails")
    if not key or not compare_digest(key.encode(), configured.encode()):
        raise AppError.unauthorized("Invalid email test key")


class TestEmailRequest(RequestModel):
    email: Email
    message: str = Field(default="If you received this, Spendova email delivery works.", min_length=1, max_length=1000)


@router.post("/health/email", dependencies=[Depends(auth_limit), Depends(require_email_test_key)])
def send_test_email(payload: TestEmailRequest, db: DbSession):
    """Sends one labelled test email through the outbox; at most one per minute."""
    if db.get_bind().dialect.name == "postgresql":
        # Serialise test sends across instances so the one-per-minute rule holds.
        db.execute(text("SELECT pg_advisory_xact_lock(746238902)"))
    recent = db.scalar(
        select(EmailOutbox.id)
        .where(
            EmailOutbox.category == TEST_CATEGORY,
            EmailOutbox.created_at > utcnow() - timedelta(seconds=60),
        )
        .limit(1)
    )
    if recent is not None:
        raise AppError.rate_limited("One test email per minute. Try again shortly.")
    outbox_id = email_outbox_service.enqueue(
        db,
        payload.email,
        "[Spendova test] Email delivery test",
        "This is a requested Spendova test email.\n\n" + payload.message,
        None,
        TEST_CATEGORY,
        ttl=timedelta(minutes=5),
    )
    db.commit()

    results: list[EmailDeliveryResult] = []

    def sender(to: str, subject: str, body: str, html: str | None) -> EmailDeliveryResult:
        result = email_service.send_email(to, subject, body, html)
        results.append(result)
        return result

    email_outbox_service.deliver(outbox_id, sender=sender)
    if not results:
        return JsonResponse.error("Test delivery was not attempted", {"code": "EMAIL_TEST_NOT_ATTEMPTED"}, 503)
    result = results[0]
    data = {"submission": result.status, "message_id": result.message_id, "test_id": outbox_id}
    if result.status != "accepted":
        return JsonResponse.error(result.message, data, status_code=503)
    return JsonResponse.success(result.message, data, status_code=202)
