"""Email notifications.

Each message is written to the durable outbox inside the caller's transaction, then sent by a
background task after the response, so requests never wait on SMTP and nothing is lost if the
server restarts. The background task runs only after the router has committed.
"""

from datetime import timedelta

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.constants.email import CATEGORY_ACCOUNT, CATEGORY_SECURITY
from app.core.config import get_settings
from app.db.model_helpers import utcnow
from app.db.models.user_model import User
from app.services import email_outbox_service as outbox
from app.services import email_templates
from app.services.email_templates import EmailContent


def _queue(
    db: Session,
    background: BackgroundTasks,
    to: str,
    content: EmailContent,
    category: str,
    ttl: timedelta | None = None,
) -> None:
    subject, text, html = email_templates.render(content)
    outbox_id = outbox.enqueue(db, to, subject, text, html, category, ttl)
    background.add_task(outbox.deliver, outbox_id)


def verify_email(db: Session, background: BackgroundTasks, user: User, code: str) -> None:
    # A code that arrives after it expires is useless, so the message expires with it.
    ttl = timedelta(minutes=get_settings().otp_expiry_minutes)
    _queue(
        db, background, user.email, email_templates.verification_email(user.display_name, code), CATEGORY_ACCOUNT, ttl
    )


def forgot_password(db: Session, background: BackgroundTasks, user: User, code: str) -> None:
    ttl = timedelta(minutes=get_settings().password_reset_code_minutes)
    _queue(
        db,
        background,
        user.email,
        email_templates.password_reset_email(user.display_name, code),
        CATEGORY_SECURITY,
        ttl,
    )


def google_sign_in_notice(db: Session, background: BackgroundTasks, user: User) -> None:
    _queue(db, background, user.email, email_templates.google_sign_in_notice(user.display_name), CATEGORY_SECURITY)


def password_changed(db: Session, background: BackgroundTasks, user: User) -> None:
    content = email_templates.password_changed_email(user.display_name, utcnow())
    _queue(db, background, user.email, content, CATEGORY_SECURITY)
