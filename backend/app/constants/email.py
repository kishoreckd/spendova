"""One Spendova email palette (midnight / teal / mint) and the inline assets emails may embed."""

from pathlib import Path

ASSET_DIR = Path(__file__).resolve().parents[1] / "static" / "email"

THEME = {
    "brand": "Spendova",
    "primary": "#087F7A",
    "ink": "#0B2A33",
    "muted": "#5B6E75",
    "background": "#F1F7F6",
    "soft": "#E8F5F2",
    "border": "#D6E6E3",
    "accent": "#0F9D8C",
    "button_text": "#FFFFFF",
}
DARK_THEME = {
    "background": "#0B1A22",
    "card": "#122630",
    "soft": "#183340",
    "ink": "#E8F4F2",
    "muted": "#A7BCC1",
    "border": "#2A4552",
    "accent": "#5FD4C1",
}

# Content-ID -> file. Every key referenced as cid:<key> in a template is attached inline.
EMAIL_ASSETS = {"spendova-logo": ASSET_DIR / "email-mark.png"}

# Outbox categories (also the audit trail of why a message was sent).
CATEGORY_SECURITY = "security"
CATEGORY_ACCOUNT = "account"
