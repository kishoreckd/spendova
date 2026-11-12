"""Swagger login independent of Firebase, matching the reference backend convention."""

import base64
import hashlib
import secrets
from pathlib import Path
from typing import Annotated

from cryptography.fernet import Fernet, InvalidToken
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.openapi.docs import get_redoc_html, get_swagger_ui_html
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import Field

from app.core.config import Settings
from app.core.rate_limit import auth_limit
from app.core.schema import RequestModel
from app.utils.validation.json_validator import JsonResponse


class DocsLogin(RequestModel):
    username: str = Field(min_length=1, max_length=1024)
    password: str = Field(min_length=1, max_length=1024)


def install_docs(app: FastAPI, settings: Settings) -> None:
    protected = settings.enable_api_docs
    if settings.is_production and not protected:
        return
    security = HTTPBasic(auto_error=False)
    cookie_name = "spendova_docs"
    material = f"{settings.otp_secret}:docs:{settings.swagger_username or ''}:{settings.swagger_password or ''}"
    signer = Fernet(base64.urlsafe_b64encode(hashlib.sha256(material.encode()).digest()))
    ttl = settings.swagger_session_ttl_minutes * 60

    def valid_credentials(username: str, password: str) -> bool:
        def digest(value: str) -> bytes:
            return hashlib.sha256(value.encode()).digest()

        return secrets.compare_digest(
            digest(username), digest(settings.swagger_username or "")
        ) & secrets.compare_digest(digest(password), digest(settings.swagger_password or ""))

    def authenticated(request: Request) -> bool:
        try:
            return signer.decrypt(request.cookies.get(cookie_name, "").encode(), ttl=ttl) == b"spendova-docs"
        except (InvalidToken, ValueError):
            return False

    def verify_credentials(request: Request, credentials: Annotated[HTTPBasicCredentials | None, Depends(security)]):
        if not authenticated(request) and not (
            credentials and valid_credentials(credentials.username, credentials.password)
        ):
            raise HTTPException(401, "Documentation authentication required")

    def same_origin(request: Request):
        if request.headers.get("origin") != str(request.base_url).rstrip("/"):
            raise HTTPException(403, "Same-origin request required")

    dependencies = [Depends(auth_limit), Depends(verify_credentials)] if protected else []

    @app.get("/api/docs", include_in_schema=False, dependencies=[Depends(auth_limit)])
    @app.get("/docs", include_in_schema=False, dependencies=[Depends(auth_limit)])
    def swagger(request: Request):
        if protected and not authenticated(request):
            template = Path(__file__).resolve().parents[1] / "utils/templates/docs/login.html"
            return HTMLResponse(template.read_text(encoding="utf-8"))
        response = get_swagger_ui_html(openapi_url="/api/openapi.json", title=f"{settings.app_name} - Swagger UI")
        if protected:
            response.body = bytes(response.body).replace(
                b"<body>",
                b"""<body><button style="position:fixed;right:24px;bottom:24px;z-index:1000"
onclick="fetch('/api/docs/logout',{method:'POST'}).then(()=>location.reload())">Sign out of docs</button>""",
            )
            response.headers["content-length"] = str(len(response.body))
        return response

    @app.get("/redoc", include_in_schema=False, dependencies=dependencies)
    def redoc():
        return get_redoc_html(openapi_url="/api/openapi.json", title=f"{settings.app_name} - ReDoc")

    @app.get("/api/openapi.json", include_in_schema=False, dependencies=dependencies)
    @app.get("/openapi.json", include_in_schema=False, dependencies=dependencies)
    def openapi():
        return JSONResponse(app.openapi())

    if protected:

        @app.post("/api/docs/login", include_in_schema=False, dependencies=[Depends(auth_limit), Depends(same_origin)])
        def login(body: DocsLogin):
            if not valid_credentials(body.username, body.password):
                raise HTTPException(401, "Incorrect username or password")
            response = JsonResponse.success("Signed in")
            response.set_cookie(
                cookie_name,
                signer.encrypt(b"spendova-docs").decode(),
                max_age=ttl,
                path="/",
                httponly=True,
                secure=settings.is_production,
                samesite="strict",
            )
            return response

        @app.post("/api/docs/logout", include_in_schema=False, dependencies=[Depends(same_origin)])
        def logout():
            response = JsonResponse.success("Signed out")
            response.delete_cookie(
                cookie_name, path="/", httponly=True, secure=settings.is_production, samesite="strict"
            )
            return response
