from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from .api import accounts, assets, auth, budgets, categories, dashboard, goals, recurring, transactions
from .core.config import get_settings
from .core.exceptions import http_exception_handler, request_validation_exception_handler, unhandled_exception_handler
from .auth import get_verified_current_user
from .db.session import Base, engine
from .utils.validation.json_validator import ApiResponse, JsonResponse

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Alembic owns production schema changes. This keeps local/test startup simple.
    if settings.environment != "production":
        Base.metadata.create_all(engine)
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url="/redoc" if settings.environment != "production" else None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-User-Id"],
)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, request_validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

app.include_router(auth.router, prefix="/api/v1")
for router in (
    accounts.router,
    categories.router,
    transactions.router,
    goals.router,
    assets.router,
    budgets.router,
    recurring.router,
    dashboard.router,
):
    app.include_router(
        router,
        prefix="/api/v1",
        dependencies=[Depends(get_verified_current_user)],
    )


@app.get("/health", tags=["operations"], response_model=ApiResponse[dict])
def health():
    return JsonResponse.success("Spendova API is healthy", {"time": datetime.now(timezone.utc)})
