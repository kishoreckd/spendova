import logging
import smtplib
from email.message import EmailMessage

from . import email_templates
from .core.config import get_settings
from .email_templates import EmailContent

logger = logging.getLogger(__name__)


def send_email(recipient: str, content: EmailContent) -> None:
    """Deliver one message as plain text with an HTML alternative.

    Console mode prints the plain text for local development only; it is
    refused in production so codes never end up in server logs.
    """
    settings = get_settings()
    if settings.email_delivery_mode == "console":
        if settings.environment == "production":
            raise RuntimeError("Email delivery is not configured")
        print(f"[email to {recipient}] {content.subject}\n{content.text}\n")
        return
    if not settings.smtp_host or not settings.smtp_username or not settings.smtp_password:
        raise RuntimeError("SMTP delivery is not configured")

    message = EmailMessage()
    message["Subject"] = content.subject
    message["From"] = settings.email_from
    message["To"] = recipient
    message.set_content(content.text)
    message.add_alternative(content.html, subtype="html")

    if settings.smtp_port == 465:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(message)
        return
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
        if settings.smtp_use_tls:
            server.starttls()
        server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(message)


def send_in_background(recipient: str, content: EmailContent) -> None:
    """For background tasks: failures are logged without the message body."""
    try:
        send_email(recipient, content)
    except Exception:
        logger.exception("Could not send %r email", content.subject.split(" is your ")[-1])


def send_verification_code(recipient: str, code: str, name: str | None = None) -> None:
    settings = get_settings()
    send_email(
        recipient,
        email_templates.verification_code(name=name, code=code, minutes=settings.otp_expiry_minutes),
    )
