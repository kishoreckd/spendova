from typing import Literal

from pydantic import Field

from app.core.schema import ApiModel, RequestModel

TwoFactorMethod = Literal["totp", "email"]
SignInMethod = Literal["totp", "email", "recovery"]


class TwoFactorStatus(ApiModel):
    enabled: bool
    method: TwoFactorMethod | None
    recovery_codes_left: int


class TotpSetup(ApiModel):
    secret: str
    otpauth_uri: str


class TotpEnableRequest(RequestModel):
    code: str = Field(pattern=r"^\d{6}$")


class RecoveryCodes(ApiModel):
    recovery_codes: list[str]


class TwoFactorDisableRequest(RequestModel):
    password: str = Field(min_length=1, max_length=128)


class TwoFactorPasswordRequest(RequestModel):
    password: str = Field(min_length=1, max_length=128)


class TwoFactorChallengeRead(ApiModel):
    """Returned by /auth/login instead of a session when a second step is needed."""

    two_factor_required: Literal[True] = True
    challenge_token: str
    method: TwoFactorMethod
    expires_in_seconds: int
    development_code: str | None = None


class TwoFactorLoginRequest(RequestModel):
    challenge_token: str = Field(min_length=20, max_length=200)
    method: SignInMethod
    code: str = Field(min_length=6, max_length=20)
    trust_device: bool = False


class TwoFactorResendRequest(RequestModel):
    challenge_token: str = Field(min_length=20, max_length=200)


class TwoFactorCodeSent(ApiModel):
    sent: bool
    development_code: str | None = None
