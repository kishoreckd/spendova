import smtplib
from email.message import EmailMessage

from .core.config import get_settings


def send_verification_code(recipient: str, code: str) -> None:
    settings = get_settings()
    if settings.email_delivery_mode == "console":
        print(f"Spendova development verification code for {recipient}: {code}")
        return
    if not settings.smtp_host or not settings.smtp_username or not settings.smtp_password:
        raise RuntimeError("SMTP delivery is not configured")

    message = EmailMessage()
    message["Subject"] = "Your Spendova verification code"
    message["From"] = settings.email_from
    message["To"] = recipient
    message.set_content(
        f"Your Spendova verification code is {code}. "
        f"It expires in {settings.otp_expiry_minutes} minutes.\n\n"
        "If you did not create a Spendova account, you can ignore this email."
    )
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
        if settings.smtp_use_tls:
            server.starttls()
        server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(message)
