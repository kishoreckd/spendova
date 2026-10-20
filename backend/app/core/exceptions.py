import logging

from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError

from ..utils.validation.json_validator import JsonResponse

logger = logging.getLogger(__name__)


async def http_exception_handler(_: Request, exc: Exception):
    assert isinstance(exc, HTTPException)
    message = exc.detail if isinstance(exc.detail, str) else "Request failed"
    details = None if isinstance(exc.detail, str) else exc.detail
    return JsonResponse.error(message, details, exc.status_code, exc.headers)


async def request_validation_exception_handler(_: Request, exc: Exception):
    assert isinstance(exc, RequestValidationError)
    details = [
        {
            "field": " -> ".join(str(part) for part in item["loc"]),
            "message": item["msg"],
            "error_type": item["type"],
        }
        for item in exc.errors()
    ]
    return JsonResponse.error("Validation error", details, 422)


async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled API error for %s %s", request.method, request.url.path, exc_info=exc)
    return JsonResponse.error("An unexpected server error occurred", None, 500)
