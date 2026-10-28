"""Shared wire format for all JSON API responses (204 has no body).

Every response is `{"status": "success" | "error", "message": str, "data": ...}`.
Errors carry `data: {"code": "...", "details": [{"path": ..., "message": ...}]}`.
"""

from typing import Any, Literal

from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from starlette.background import BackgroundTask


class JsonResponse:
    @staticmethod
    def body(status: Literal["success", "error"], message: str, data: Any = None) -> dict:
        return {"status": status, "message": message, "data": data}

    @classmethod
    def create(
        cls,
        status: Literal["success", "error"],
        message: str,
        data: Any,
        status_code: int,
        headers=None,
        background: BackgroundTask | None = None,
    ) -> JSONResponse:
        return JSONResponse(
            content=jsonable_encoder(cls.body(status, message, data)),
            status_code=status_code,
            headers=headers,
            background=background,
        )

    @classmethod
    def success(cls, message: str, data=None, status_code: int = 200, headers=None, background=None) -> JSONResponse:
        return cls.create("success", message, data, status_code, headers, background)

    @classmethod
    def error(cls, message: str, data=None, status_code: int = 400, headers=None, background=None) -> JSONResponse:
        return cls.create("error", message, data, status_code, headers, background)


class ApiJSONResponse(JSONResponse):
    """Default response class: wraps a route's validated DTO in the shared envelope.

    A dict carrying a string `message` key uses it as the envelope message.
    """

    def render(self, content: Any) -> bytes:
        message = "Success"
        data = content
        if isinstance(content, dict) and isinstance(content.get("message"), str):
            message = content["message"]
            data = {key: value for key, value in content.items() if key != "message"} or None
        return super().render(JsonResponse.body("success", message, data))
