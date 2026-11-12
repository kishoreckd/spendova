from pydantic import Field

from app.core.schema import ApiModel, Email, OneTimeCode, RequestModel


class LoginRequest(RequestModel):
    email: Email
    password: str = Field(min_length=1, max_length=128)


class RegisterRequest(LoginRequest):
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=128)


class GoogleAuthRequest(RequestModel):
    email: str | None = Field(default=None, max_length=320)
    name: str | None = Field(default=None, max_length=120)
    photo_url: str | None = Field(default=None, max_length=1000)


class UserRead(ApiModel):
    id: str
    email: str
    display_name: str | None
    photo_url: str | None
    base_currency: str
    country_code: str | None
    locale: str
    time_zone: str
    onboarding_completed: bool
    email_verified: bool


class UserUpdate(RequestModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    base_currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    country_code: str | None = Field(default=None, pattern=r"^[A-Z]{2}$")
    locale: str | None = Field(default=None, min_length=2, max_length=20)
    time_zone: str | None = Field(default=None, min_length=1, max_length=80)
    onboarding_completed: bool | None = None


class LoginResponse(ApiModel):
    access_token: str
    expires_in_seconds: int
    account: UserRead
    development_code: str | None = None


class TokenResponse(ApiModel):
    access_token: str
    expires_in_seconds: int


class VerificationCodeRequest(RequestModel):
    code: OneTimeCode


class VerificationCodeSent(ApiModel):
    sent: bool
    expires_in_seconds: int
    development_code: str | None = None
