"""Email templates and the durable outbox."""

from datetime import timedelta

from sqlalchemy import select

from app.constants.email import THEME
from app.db.model_helpers import utcnow
from app.db.models.email_outbox_model import EmailOutbox
from app.db.session import SessionLocal
from app.services import email_outbox_service as outbox
from app.services import email_templates
from app.services.email_service import EmailDeliveryResult, build_message


def _queue(subject: str = "Hello", ttl: timedelta | None = None) -> str:
    with SessionLocal() as db:
        outbox_id = outbox.enqueue(db, "to@example.com", subject, "text body", "<p>html</p>", "account", ttl)
        db.commit()
    return outbox_id


def _row(outbox_id: str) -> EmailOutbox:
    with SessionLocal() as db:
        row = db.scalar(select(EmailOutbox).where(EmailOutbox.id == outbox_id))
        assert row is not None
        return row


def test_every_template_renders_with_brand_theme_and_plain_text():
    builders = [
        email_templates.verification_email("Priya Sharma", "123456"),
        email_templates.password_reset_email("Priya", "654321"),
        email_templates.google_sign_in_notice(None),
        email_templates.password_changed_email("Priya", utcnow()),
    ]
    for content in builders:
        subject, text, html = email_templates.render(content)
        assert subject and content.heading in text and content.heading in html
        assert THEME["primary"] in html and "cid:spendova-logo" in html
        assert "prefers-color-scheme: dark" in html


def test_inline_logo_is_attached():
    _, text, html = email_templates.render(email_templates.verification_email("Priya", "123456"))
    message = build_message("Spendova <no-reply@spendova.app>", "to@example.com", "Subject", text, html)
    assert any(part.get("Content-ID") == "<spendova-logo>" for part in message.walk())


def test_payload_is_sealed_at_rest_and_wiped_after_sending(api):
    outbox_id = _queue(subject="Secret code 123456")
    row = _row(outbox_id)
    assert row.payload_enc and "123456" not in row.payload_enc

    sent: list[str] = []
    status = outbox.deliver(
        outbox_id,
        sender=lambda to, subject, text, html: (sent.append(subject) or EmailDeliveryResult("accepted", "ok")),
    )
    assert status == "sent" and sent == ["Secret code 123456"]
    assert _row(outbox_id).payload_enc is None


def test_failed_delivery_is_retried_with_backoff_then_sent(api):
    outbox_id = _queue()
    failing = lambda *_: EmailDeliveryResult("failed", "SMTP down")  # noqa: E731
    assert outbox.deliver(outbox_id, sender=failing) == "pending"
    row = _row(outbox_id)
    assert row.attempts == 1 and row.last_error == "SMTP down"

    later = utcnow() + timedelta(minutes=5)
    counts = outbox.run_once(now=later, sender=lambda *_: EmailDeliveryResult("accepted", "ok"))
    assert counts == {"sent": 1}


def test_expired_messages_are_not_sent(api):
    outbox_id = _queue(ttl=timedelta(minutes=1))
    status = outbox.deliver(
        outbox_id, sender=lambda *_: EmailDeliveryResult("accepted", "ok"), now=utcnow() + timedelta(minutes=5)
    )
    assert status == "expired"
    assert _row(outbox_id).payload_enc is None
