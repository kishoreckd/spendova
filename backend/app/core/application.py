import asyncio
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

import app.db.models  # noqa: F401  Registers every mapping before the first query.
from app.api.accounts import router as accounts_router
from app.api.assets import router as assets_router
from app.api.audit import router as audit_router
from app.api.auth import router as auth_router
from app.api.budgets import router as budgets_router
from app.api.categories import router as categories_router
from app.api.dashboard import router as dashboard_router
from app.api.goals import router as goals_router
from app.api.health import router as health_router
from app.api.loans import router as loans_router
from app.api.password_reset import router as password_reset_router
from app.api.recurring import router as recurring_router
from app.api.transactions import router as transactions_router
from app.constants.http import API_PREFIX, DOCS_PATHS
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.rate_limit import global_limit
from app.utils.validation.json_validator import ApiJSONResponse


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Alembic owns the schema (run `alembic upgrade head`); this only starts background work."""
    from app.services import email_outbox_service

    settings = get_settings()
    stop = asyncio.Event()
    tasks = []
    # On Vercel the instance freezes between requests, so retries run from Vercel Cron instead
    # (GET /cron/email-outbox). Elsewhere the first pass resends anything pending after a restart.
    if settings.email_outbox_worker_enabled and not settings.vercel:
        tasks.append(asyncio.create_task(email_outbox_service.run_loop(stop)))
    try:
        yield
    finally:
        stop.set()
        await asyncio.gather(*tasks)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        default_response_class=ApiJSONResponse,
        lifespan=lifespan,
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None if settings.is_production else "/redoc",
        openapi_url=None if settings.is_production else "/openapi.json",
        dependencies=[Depends(global_limit)],
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-User-Id"],
    )

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("Cache-Control", "no-store")
        if not request.url.path.startswith(DOCS_PATHS):
            response.headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
        if settings.is_production:
            response.headers.setdefault("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
        return response

    register_error_handlers(app)

    # Health checks and cron endpoints live outside the versioned API.
    app.include_router(health_router)
    for router in (
        auth_router,
        password_reset_router,
        accounts_router,
        categories_router,
        transactions_router,
        recurring_router,
        budgets_router,
        goals_router,
        assets_router,
        loans_router,
        dashboard_router,
        audit_router,
    ):
        app.include_router(router, prefix=API_PREFIX)
    return app
