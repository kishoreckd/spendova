"""Multipart SMTP delivery with typed results and inline brand artwork."""

import logging
import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import make_msgid
from typing import Literal

from app.constants.email import EMAIL_ASSETS
from app.core.config import get_settings
from app.services.email_config import EmailConfig, get_email_config

logger = logging.getLogger("spendova.mail")


@dataclass(frozen=True)
class EmailDeliveryResult:
    status: Literal["accepted", "failed", "unconfigured"]
    message: str
    message_id: str | None = None


def build_message(sender: str, to: str, subject: str, text: str, html: str | None) -> EmailMessage:
    message = EmailMessage()
    message["From"], message["To"], message["Subject"] = sender, to, " ".join(subject.splitlines())
    message["Message-ID"] = make_msgid(domain="spendova.app")
    message.set_content(text)
    if html:
        message.add_alternative(html, subtype="html")
        html_part = message.get_body(preferencelist=("html",))
        if html_part is None:  # Unreachable: the HTML alternative was just added.
            raise RuntimeError("HTML part missing from email")
        for cid, path in EMAIL_ASSETS.items():
            if f"cid:{cid}" in html:
                html_part.add_related(
                    path.read_bytes(), maintype="image", subtype="png", cid=f"<{cid}>", disposition="inline"
                )
    return message


def _open_smtp(config: EmailConfig, timeout: int) -> smtplib.SMTP:
    if config.port == 465:
        return smtplib.SMTP_SSL(config.host, config.port, timeout=timeout, context=ssl.create_default_context())
    return smtplib.SMTP(config.host, config.port, timeout=timeout)


def check_connection() -> dict[str, str]:
    """Connects, upgrades to TLS, and logs in without sending anything.

    Returns the last stage reached ("complete" on success) and, on failure, a credential-free detail.
    """
    config = get_email_config()
    if config is None:
        return {"stage": "configuration", "detail": "SMTP is not configured"}
    stage = "connect"
    try:
        with _open_smtp(config, get_settings().smtp_timeout_seconds) as smtp:
            if config.starttls and config.port != 465:
                stage = "starttls"
                smtp.starttls(context=ssl.create_default_context())
            if config.username and config.password:
                stage = "authenticate"
                smtp.login(config.username, config.password)
            smtp.noop()
    except (OSError, smtplib.SMTPException) as error:
        code = error.smtp_code if isinstance(error, smtplib.SMTPResponseException) else None
        return {"stage": stage, "detail": f"SMTP {code}" if isinstance(code, int) else type(error).__name__}
    return {"stage": "complete", "host": config.host, "port": str(config.port)}


def send_email(to: str, subject: str, text: str, html: str | None = None) -> EmailDeliveryResult:
    settings = get_settings()
    if settings.email_delivery_mode == "console":
        if settings.is_production:
            return EmailDeliveryResult("unconfigured", "Email delivery is not configured.")
        # Local development only: print the plain-text body so codes can be read in the terminal.
        print(f"[email to {to}] {subject}\n{text}\n")  # noqa: T201
        return EmailDeliveryResult("accepted", "Printed to the console (development).")

    config = get_email_config()
    if config is None:
        logger.warning("SMTP skipped: email configuration is incomplete")
        return EmailDeliveryResult("unconfigured", "Email delivery is not configured.")
    try:
        message = build_message(config.sender, to, subject, text, html)
    except OSError:
        logger.warning("Email artwork is unavailable; delivery skipped")
        return EmailDeliveryResult("failed", "Email assets are unavailable. Please try again later.")

    stage = "connect"
    try:
        with _open_smtp(config, settings.smtp_timeout_seconds) as smtp:
            if config.starttls and config.port != 465:
                stage = "starttls"
                smtp.starttls(context=ssl.create_default_context())
            if config.username and config.password:
                stage = "authenticate"
                smtp.login(config.username, config.password)
            stage = "send"
            if smtp.send_message(message):
                logger.warning("SMTP rejected recipient: message_id=%s", message["Message-ID"])
                return EmailDeliveryResult("failed", "The mail server rejected the recipient.")
        logger.info("SMTP accepted: message_id=%s", message["Message-ID"])
        return EmailDeliveryResult("accepted", "The mail server accepted the email.", str(message["Message-ID"]))
    except (OSError, smtplib.SMTPException) as error:
        # SMTP errors can echo credentials or addresses; log only the stage and error type.
        code = error.smtp_code if isinstance(error, smtplib.SMTPResponseException) else None
        detail = f"SMTP {code}" if isinstance(code, int) else type(error).__name__
        logger.warning("SMTP failed: stage=%s detail=%s message_id=%s", stage, detail, message["Message-ID"])
        return EmailDeliveryResult("failed", f"Email could not be sent: stage={stage}, {detail}.")
