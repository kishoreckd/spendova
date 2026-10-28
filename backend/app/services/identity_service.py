"""Server-side account operations backed by the Firebase Admin SDK.

The Admin SDK needs a service-account key (FIREBASE_SERVICE_ACCOUNT_JSON).
Keep this module small so tests can replace `identity_provider`.
"""

import json
from functools import lru_cache
from typing import Any, Protocol

from ..core.config import get_settings


class IdentityUnavailable(RuntimeError):
    """Raised when server-side account changes are not configured."""


class IdentityError(RuntimeError):
    """Raised when Firebase rejects or fails an account operation."""


class IdentityProvider(Protocol):
    def sign_in_methods(self, uid: str) -> set[str]: ...

    def set_password(self, uid: str, password: str) -> None: ...

    def sign_out_everywhere(self, uid: str) -> None: ...


class FirebaseIdentity:
    def __init__(self, service_account: dict[str, Any]) -> None:
        import firebase_admin
        from firebase_admin import auth, credentials

        self._auth = auth
        try:
            self._app = firebase_admin.get_app("spendova-admin")
        except ValueError:
            self._app = firebase_admin.initialize_app(
                credentials.Certificate(service_account), name="spendova-admin"
            )

    def sign_in_methods(self, uid: str) -> set[str]:
        try:
            user = self._auth.get_user(uid, app=self._app)
        except Exception as exc:
            raise IdentityError("Could not look up the account") from exc
        return {provider.provider_id for provider in user.provider_data}

    def set_password(self, uid: str, password: str) -> None:
        try:
            self._auth.update_user(uid, password=password, app=self._app)
        except Exception as exc:
            raise IdentityError("Could not update the password") from exc

    def sign_out_everywhere(self, uid: str) -> None:
        try:
            self._auth.revoke_refresh_tokens(uid, app=self._app)
        except Exception as exc:
            raise IdentityError("Could not sign out other sessions") from exc


@lru_cache
def _firebase_identity() -> FirebaseIdentity:
    raw = get_settings().firebase_service_account_json
    if not raw:
        raise IdentityUnavailable("Password reset is not configured on the server")
    try:
        return FirebaseIdentity(json.loads(raw))
    except (ValueError, KeyError) as exc:
        raise IdentityUnavailable("The Firebase service account is invalid") from exc


def optional_identity_provider() -> IdentityProvider | None:
    """FastAPI dependency: the provider, or None when it is not configured.

    Tests override this dependency with a fake.
    """
    try:
        return _firebase_identity()
    except IdentityUnavailable:
        return None
