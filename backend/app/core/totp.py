"""RFC 6238 TOTP (SHA-1, 6 digits, 30 s): Google Authenticator, Microsoft Authenticator, Authy, 1Password."""

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote

DIGITS = 6
PERIOD_SECONDS = 30
ISSUER = "Spendova"
RECOVERY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"  # no look-alike characters


def new_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")


def _key(secret: str) -> bytes:
    cleaned = secret.replace(" ", "").upper()
    return base64.b32decode(cleaned + "=" * (-len(cleaned) % 8))


def code_at(secret: str, counter: int) -> str:
    mac = hmac.new(_key(secret), struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = mac[-1] & 0x0F
    value = struct.unpack(">I", mac[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(value % 10**DIGITS).zfill(DIGITS)


def matching_counter(secret: str, code: str, now: float | None = None, window: int = 1) -> int | None:
    """The time step the code belongs to (allowing ±window steps of clock drift), else None."""
    code = code.strip().replace(" ", "")
    if len(code) != DIGITS or not code.isdigit():
        return None
    current = int((now if now is not None else time.time()) // PERIOD_SECONDS)
    for counter in range(current - window, current + window + 1):
        if hmac.compare_digest(code_at(secret, counter), code):
            return counter
    return None


def otpauth_uri(secret: str, account: str) -> str:
    label = quote(f"{ISSUER}:{account}")
    return (
        f"otpauth://totp/{label}?secret={secret}&issuer={quote(ISSUER)}"
        f"&algorithm=SHA1&digits={DIGITS}&period={PERIOD_SECONDS}"
    )


def new_recovery_codes(count: int = 8) -> list[str]:
    """10-character single-use codes (about 49 bits each), shown as xxxxx-xxxxx."""
    codes = []
    for _ in range(count):
        raw = "".join(secrets.choice(RECOVERY_ALPHABET) for _ in range(10))
        codes.append(f"{raw[:5]}-{raw[5:]}")
    return codes


def normalize_recovery_code(code: str) -> str:
    return code.strip().lower().replace("-", "").replace(" ", "")
