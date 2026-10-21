"""Transactional email content.

Every message is built from one layout and returned as HTML plus a plain-text
alternative. HTML uses tables and inline styles because Gmail, Outlook, and
Apple Mail ignore most stylesheets. All interpolated values are escaped.
"""

from dataclasses import dataclass
from datetime import datetime
from html import escape

BRAND = "Spendova"
INK = "#0B2A2F"
MUTED = "#5B6B73"
PRIMARY = "#0F766E"
SURFACE = "#F3F8F7"
BORDER = "#DCE7E5"


@dataclass(frozen=True)
class EmailContent:
    subject: str
    html: str
    text: str


def _layout(*, preheader: str, heading: str, body_html: str, footer_note: str) -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>{escape(heading)}</title>
</head>
<body style="margin:0;padding:0;background:{SURFACE};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{SURFACE};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
      <tr><td style="padding:0 4px 20px;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="width:36px;height:36px;border-radius:10px;background:{PRIMARY};color:#ffffff;font:700 20px Segoe UI,Helvetica,Arial,sans-serif;text-align:center;vertical-align:middle;">S</td>
          <td style="padding-left:10px;font:600 20px Segoe UI,Helvetica,Arial,sans-serif;color:{INK};">{BRAND}</td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#ffffff;border:1px solid {BORDER};border-radius:16px;padding:32px 28px;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:{INK};">
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:600;color:{INK};">{escape(heading)}</h1>
        {body_html}
      </td></tr>
      <tr><td style="padding:20px 8px 0;font:13px/1.5 Segoe UI,Helvetica,Arial,sans-serif;color:{MUTED};">
        {escape(footer_note)}<br>
        &copy; {datetime.now().year} {BRAND}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>"""


def _paragraph(text: str) -> str:
    return f'<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:{INK};">{text}</p>'


def _code_block(code: str, minutes: int) -> str:
    return f"""<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
  <tr><td align="center" style="background:{SURFACE};border:1px solid {BORDER};border-radius:12px;padding:20px 12px;">
    <div style="font:700 34px/1 Consolas,Menlo,monospace;letter-spacing:10px;color:{INK};padding-left:10px;">{escape(code)}</div>
    <div style="margin-top:10px;font:13px Segoe UI,Helvetica,Arial,sans-serif;color:{MUTED};">Expires in {minutes} minutes</div>
  </td></tr>
</table>"""


def _button(label: str, url: str) -> str:
    return f"""<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;"><tr>
  <td style="border-radius:10px;background:{PRIMARY};">
    <a href="{escape(url, quote=True)}" style="display:inline-block;padding:12px 22px;font:600 15px Segoe UI,Helvetica,Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:10px;">{escape(label)}</a>
  </td>
</tr></table>"""


def _greeting(name: str | None) -> str:
    first = (name or "").strip().split(" ")[0]
    return f"Hi {escape(first)}," if first else "Hi,"


def verification_code(*, name: str | None, code: str, minutes: int) -> EmailContent:
    html = _layout(
        preheader=f"Your Spendova verification code is {code}",
        heading="Verify your email",
        body_html=_paragraph(_greeting(name))
        + _paragraph("Enter this code in Spendova to finish creating your account.")
        + _code_block(code, minutes),
        footer_note="If you didn't create a Spendova account, you can ignore this email.",
    )
    text = (
        f"{_greeting(name)}\n\nYour Spendova verification code is {code}.\n"
        f"It expires in {minutes} minutes.\n\n"
        "If you didn't create a Spendova account, you can ignore this email."
    )
    return EmailContent(f"{code} is your Spendova verification code", html, text)


def password_reset_code(*, name: str | None, code: str, minutes: int) -> EmailContent:
    html = _layout(
        preheader=f"Your Spendova password reset code is {code}",
        heading="Reset your password",
        body_html=_paragraph(_greeting(name))
        + _paragraph("Use this code to set a new password for your Spendova account.")
        + _code_block(code, minutes)
        + _paragraph("Never share this code. Spendova will never ask you for it."),
        footer_note="If you didn't ask to reset your password, ignore this email. Your password stays the same.",
    )
    text = (
        f"{_greeting(name)}\n\nYour Spendova password reset code is {code}.\n"
        f"It expires in {minutes} minutes. Never share this code.\n\n"
        "If you didn't ask to reset your password, ignore this email."
    )
    return EmailContent(f"{code} is your Spendova password reset code", html, text)


def google_account_notice(*, name: str | None, app_url: str) -> EmailContent:
    sign_in = f"{app_url.rstrip('/')}/sign-in"
    html = _layout(
        preheader="Your Spendova account uses Google sign-in",
        heading="You sign in with Google",
        body_html=_paragraph(_greeting(name))
        + _paragraph(
            "Someone asked to reset the password for this email, but your Spendova account "
            "doesn't use a password. Sign in with <strong>Continue with Google</strong> instead."
        )
        + _button("Open Spendova", sign_in),
        footer_note="If you didn't ask for this, you can ignore this email.",
    )
    text = (
        f"{_greeting(name)}\n\nYour Spendova account uses Google sign-in, so it has no password "
        f"to reset. Choose \"Continue with Google\" at {sign_in}.\n\n"
        "If you didn't ask for this, you can ignore this email."
    )
    return EmailContent("Your Spendova account uses Google sign-in", html, text)


def password_changed(*, name: str | None, app_url: str, changed_at: datetime) -> EmailContent:
    when = changed_at.strftime("%d %b %Y, %H:%M UTC")
    sign_in = f"{app_url.rstrip('/')}/sign-in"
    html = _layout(
        preheader="Your Spendova password was changed",
        heading="Your password was changed",
        body_html=_paragraph(_greeting(name))
        + _paragraph(f"The password for your Spendova account was changed on <strong>{escape(when)}</strong>. "
                     "Other devices have been signed out.")
        + _paragraph("If this wasn't you, reset your password right away.")
        + _button("Sign in to Spendova", sign_in),
        footer_note="You're receiving this security notice because your account details changed.",
    )
    text = (
        f"{_greeting(name)}\n\nYour Spendova password was changed on {when}. "
        "Other devices have been signed out.\n\n"
        f"If this wasn't you, reset your password right away at {sign_in}."
    )
    return EmailContent("Your Spendova password was changed", html, text)
