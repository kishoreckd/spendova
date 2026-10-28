from pydantic import Field, model_validator

from app.core.schema import ApiModel, Email, OneTimeCode, RequestModel


class PasswordResetRequest(RequestModel):
    email: Email


class PasswordResetRequested(ApiModel):
    """Identical for every email address so accounts cannot be discovered."""

    sent: bool
    expires_in_seconds: int
    resend_after_seconds: int
    development_code: str | None = None


class PasswordResetVerify(RequestModel):
    email: Email
    code: OneTimeCode


class PasswordResetVerified(ApiModel):
    reset_token: str
    expires_in_seconds: int


class PasswordResetComplete(RequestModel):
    reset_token: str = Field(min_length=20, max_length=200)
    new_password: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def strong_enough(self) -> "PasswordResetComplete":
        password = self.new_password
        if password.strip() != password:
            raise ValueError("Password can't start or end with a space")
        if not any(char.isalpha() for char in password) or not any(char.isdigit() for char in password):
            raise ValueError("Use at least one letter and one number")
        return self


class PasswordResetCompleted(ApiModel):
    email: str
