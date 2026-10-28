"""Server-side crypto and identity-token verification.

Spendova does not issue its own sessions: Firebase signs ID tokens and this
module verifies them. One-time codes and reset tokens are stored only as keyed
digests, and queued email payloads are sealed at rest.
"""

import base64
import hashlib
import hmac
import secrets
from dataclasses import dataclass

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.core.config import get_settings


@dataclass(frozen=True)
class Identity:
    """Who is calling, as proven by a Firebase ID token (or the local development header)."""

    id: str
    email: str | None = None
    name: str | None = None
    photo_url: str | None = None
    email_verified: bool = False
    provider: str | None = None


def verify_firebase_token(token: str) -> Identity:
    """Raises ValueError when the token is invalid, expired, or for another project."""
    claims = id_token.verify_firebase_token(
        token, google_requests.Request(), audience=get_settings().firebase_project_id
    )
    if not claims:
        raise ValueError("Empty token claims")
    user_id = claims.get("sub") or claims.get("user_id")
    if not user_id:
        raise ValueError("Token has no user identity")
    return Identity(
        id=user_id,
        email=claims.get("email"),
        name=claims.get("name"),
        photo_url=claims.get("picture"),
        email_verified=bool(claims.get("email_verified")),
        provider=(claims.get("firebase") or {}).get("sign_in_provider"),
    )


def one_time_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def random_token() -> str:
    return secrets.token_urlsafe(32)


def code_digest(user_id: str, code: str, purpose: str = "verify-email") -> str:
    """Keyed hash of a one-time code. `purpose` keeps reset and sign-up codes separate."""
    secret = get_settings().otp_secret.encode()
    message = f"{user_id}:{code}" if purpose == "verify-email" else f"{purpose}:{user_id}:{code}"
    return hmac.new(secret, message.encode(), hashlib.sha256).hexdigest()


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def _box() -> AESGCM:
    return AESGCM(hashlib.sha256(get_settings().data_encryption_key.encode()).digest())


def seal(plaintext: str) -> str:
    """Encrypts a server-held value at rest (AES-256-GCM)."""
    nonce = secrets.token_bytes(12)
    return base64.b64encode(nonce + _box().encrypt(nonce, plaintext.encode(), b"spendova-seal")).decode()


def unseal(token: str) -> str:
    raw = base64.b64decode(token)
    return _box().decrypt(raw[:12], raw[12:], b"spendova-seal").decode()
