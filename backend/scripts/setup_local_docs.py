"""Create separate, untracked local Swagger credentials without printing the password."""

import secrets
from pathlib import Path

target = Path(__file__).resolve().parents[1] / ".env.docs.local"
if target.exists():
    print("Existing local Swagger configuration preserved.")
else:
    with target.open("x", encoding="utf-8") as output:
        output.write(
            "# Local Swagger access only. Never commit this file.\n"
            "ENABLE_API_DOCS=true\n"
            "SWAGGER_USERNAME=developer\n"
            f"SWAGGER_PASSWORD={secrets.token_urlsafe(32)}\n"
            "SWAGGER_SESSION_TTL_MINUTES=60\n"
        )
    print("Local Swagger credentials created in backend/.env.docs.local (username: developer).")
