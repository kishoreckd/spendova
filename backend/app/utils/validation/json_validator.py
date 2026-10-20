"""Shared API response contract.

The filename is retained for compatibility with the reference project, though
this module formats responses rather than validating request JSON.
"""

from collections.abc import Mapping
from typing import Any, Generic, Literal, TypeVar

from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, ValidationError

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """OpenAPI-visible envelope used by every JSON endpoint."""

    model_config = ConfigDict(from_attributes=True)

    status: Literal["success", "error"]
    message: str
    data: T | None = None

class JsonResponse:
    @staticmethod
    def create(
        response_status: Literal["success", "error"],
        message: str,
        data: Any = None,
        status_code: int = 200,
        headers: Mapping[str, str] | None = None,
    ) -> JSONResponse:
        body = ApiResponse[Any](status=response_status, message=message, data=data)
        return JSONResponse(
            content=jsonable_encoder(body.model_dump()),
            status_code=status_code,
            headers=headers,
        )

    @classmethod
    def success(cls, message: str, data: Any = None, status_code: int = 200, headers: Mapping[str, str] | None = None) -> dict[str, Any]:
        """Return data for FastAPI to validate against the route response model.

        Success status codes belong on the route decorator. Keeping validation
        in FastAPI preserves computed fields, decimal formatting, and OpenAPI.
        The final two arguments remain accepted for compatibility with the
        reference helper while routes are migrated.
        """
        _ = status_code, headers
        return {"status": "success", "message": message, "data": data}

    @classmethod
    def error(cls, message: str, data: Any = None, status_code: int = 400, headers: Mapping[str, str] | None = None) -> JSONResponse:
        return cls.create("error", message, data, status_code, headers=headers)

    @classmethod
    def validation_error(cls, error: ValidationError, status_code: int = 422, headers: Mapping[str, str] | None = None) -> JSONResponse:
        errors = [
            {
                "field": " -> ".join(str(part) for part in item["loc"]),
                "message": item["msg"],
                "error_type": item["type"],
            }
            for item in error.errors()
        ]
        return cls.error(
            message="Validation error",
            data=errors,
            status_code=status_code,
            headers=headers,
        )
