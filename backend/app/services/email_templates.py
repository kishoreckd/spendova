"""One consistent layout for every email (plain text + HTML).

HTML lives in app/utils/templates/emails/ and extends layout.html. Builders here
choose the template and words; `render` produces (subject, text, html).
Never put passwords, full account numbers, or balances in an email.
"""

from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

from app.constants.email import DARK_THEME, EMAIL_ASSETS, THEME
from app.core.config import get_settings


@dataclass
class EmailContent:
    subject: str
    heading: str
    paragraphs: list[str]
    button: tuple[str, str] | None = None  # (label, url)
    details: list[tuple[str, str]] = field(default_factory=list)  # label/value rows
    footnote: str = "You're receiving this because of activity on your Spendova account."
    tone: str = "info"  # "info" | "alert"
    template: str = "message.html"
    preheader: str = ""  # Inbox preview line.
    greeting: str = ""
    one_time_code: str = ""
    code_note: str = ""


_ENV = Environment(
    loader=FileSystemLoader(Path(__file__).resolve().parents[1] / "utils/templates/emails"),
    autoescape=select_autoescape(["html"]),
    undefined=StrictUndefined,
)


def render(content: EmailContent, *, preview: bool = False) -> tuple[str, str, str]:
    lines = [content.heading, "", *([content.greeting, ""] if content.greeting else []), *content.paragraphs]
    if content.one_time_code:
        lines += ["", f"Code: {content.one_time_code}"]
        if content.code_note:
            lines.append(content.code_note)
    if content.details:
        lines += ["", *(f"{label}: {value}" for label, value in content.details)]
    if content.button:
        lines += ["", f"{content.button[0]}: {content.button[1]}"]
    lines += ["", content.footnote]

    def asset(cid: str) -> str:
        return "../static/email/" + EMAIL_ASSETS[cid].name if preview else "cid:" + cid

    html = _ENV.get_template(content.template).render(
        content=content,
        theme=THEME,
        dark_styles=render_dark_styles(),
        logo=asset("spendova-logo"),
        year=datetime.now(UTC).year,
    )
    return content.subject, "\n".join(lines), html


def render_dark_styles(*, force: bool = False) -> str:
    """Automatic dark-mode rules; `force` applies them unconditionally for local previews."""
    return _ENV.get_template("dark_styles.css").render(dark=DARK_THEME, theme=THEME, force=force)


def render_preview_gallery(links: str) -> str:
    """Only the local preview script supplies escaped, constant navigation links."""
    return _ENV.get_template("preview_gallery.html").render(links=links, theme=THEME, dark=DARK_THEME)


def _greeting(name: str | None) -> str:
    first = (name or "").strip().split(" ")[0]
    return f"Hi {first}," if first else "Hi,"


def _app_url(path: str) -> str:
    return get_settings().app_url.rstrip("/") + path


def verification_email(name: str | None, code: str) -> EmailContent:
    minutes = get_settings().otp_expiry_minutes
    return EmailContent(
        template="verify_email.html",
        subject=f"{code} is your Spendova verification code",
        heading="Verify your email",
        preheader="Enter this code in Spendova to finish creating your account.",
        greeting=_greeting(name),
        paragraphs=["Enter this code in Spendova to finish creating your account."],
        one_time_code=code,
        code_note=f"Expires in {minutes} minutes",
        footnote="If you didn't create a Spendova account, you can ignore this email.",
    )


def password_reset_email(name: str | None, code: str) -> EmailContent:
    minutes = get_settings().password_reset_code_minutes
    return EmailContent(
        template="forgot_password.html",
        subject=f"{code} is your Spendova password reset code",
        heading="Reset your password",
        preheader=f"Your reset code expires in {minutes} minutes.",
        greeting=_greeting(name),
        paragraphs=["Use this code to set a new password for your Spendova account."],
        one_time_code=code,
        code_note=f"Expires in {minutes} minutes",
        button=("Enter reset code", _app_url("/forgot-password")),
        footnote="If you didn't ask to reset your password, ignore this email. Your password stays the same.",
    )


def google_sign_in_notice(name: str | None) -> EmailContent:
    return EmailContent(
        template="google_account.html",
        subject="Your Spendova account uses Google sign-in",
        heading="You sign in with Google",
        preheader="Your Spendova account doesn't use a password.",
        greeting=_greeting(name),
        paragraphs=[
            "Someone asked to reset the password for this email, but your Spendova account doesn't use one.",
            "Sign in with Continue with Google instead.",
        ],
        button=("Open Spendova", _app_url("/sign-in")),
        footnote="If you didn't ask for this, you can ignore this email.",
    )


def password_changed_email(name: str | None, changed_at: datetime) -> EmailContent:
    return EmailContent(
        template="password_changed.html",
        subject="Your Spendova password was changed",
        heading="Your password was changed",
        preheader="Other devices have been signed out.",
        greeting=_greeting(name),
        paragraphs=[
            "The password for your Spendova account was changed and other devices were signed out.",
            "If this wasn't you, reset your password right away.",
        ],
        details=[("Changed", changed_at.strftime("%d %b %Y, %H:%M UTC"))],
        button=("Sign in to Spendova", _app_url("/sign-in")),
        tone="alert",
        footnote="You're receiving this security notice because your account details changed.",
    )
