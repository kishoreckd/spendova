"""Create a persistent local session-signing key without printing it."""

import secrets
from pathlib import Path

target = Path(__file__).resolve().parents[1] / ".env.auth.local"
if not target.exists():
    with target.open("x", encoding="utf-8") as output:
        output.write(f"# Local session signing key. Never commit.\nJWT_ACCESS_SECRET={secrets.token_urlsafe(48)}\n")
print("Local session signing configuration ready in backend/.env.auth.local.")
