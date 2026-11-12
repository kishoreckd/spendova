"""Document the response envelope after FastAPI has generated the DTO schemas."""

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

ERROR_DESCRIPTIONS = {
    "400": "Request validation failed",
    "401": "Authentication required or invalid credentials",
    "403": "Permission denied or email not verified",
    "404": "Resource not found",
    "409": "Resource conflict",
    "429": "Rate limit exceeded",
    "500": "Unexpected server error",
    "503": "Service unavailable",
}


def install_openapi(app: FastAPI) -> None:
    def schema():
        if app.openapi_schema:
            return app.openapi_schema
        result = get_openapi(title=app.title, version=app.version, routes=app.routes)
        result.setdefault("components", {}).setdefault("schemas", {})["ApiErrorEnvelope"] = {
            "type": "object",
            "required": ["status", "message", "data"],
            "properties": {
                "status": {"type": "string", "enum": ["error"]},
                "message": {"type": "string"},
                "data": {
                    "type": "object",
                    "required": ["code"],
                    "additionalProperties": True,
                    "properties": {
                        "code": {"type": "string"},
                        "details": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "required": ["path", "message"],
                                "properties": {"path": {"type": "string"}, "message": {"type": "string"}},
                            },
                        },
                    },
                },
            },
        }
        for methods in result["paths"].values():
            for method, operation in methods.items():
                if method not in {"get", "post", "put", "patch", "delete", "options", "head"}:
                    continue
                responses = operation["responses"]
                for status, response in responses.items():
                    if status == "204":
                        response.pop("content", None)
                    elif status.startswith("2"):
                        content = response.get("content", {}).get("application/json")
                        if content is not None:
                            content["schema"] = {
                                "type": "object",
                                "required": ["status", "message", "data"],
                                "properties": {
                                    "status": {"type": "string", "enum": ["success"]},
                                    "message": {"type": "string"},
                                    "data": content.get("schema", {}),
                                },
                            }
                responses.pop("422", None)  # RequestValidationError uses HTTP 400.
                for status, description in ERROR_DESCRIPTIONS.items():
                    response = responses.setdefault(status, {"description": description})
                    response.setdefault("content", {})["application/json"] = {
                        "schema": {"$ref": "#/components/schemas/ApiErrorEnvelope"}
                    }
        app.openapi_schema = result
        return result

    app.openapi = schema
