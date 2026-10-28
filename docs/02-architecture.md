# Spendova backend architecture

The reference POC was used as a structural guide, not copied wholesale. Spendova keeps its synchronous SQLAlchemy session because the current request path is synchronous and changing to async without an async driver would add complexity without improving correctness.

## Package responsibilities

- `app/api/`: HTTP routing, dependency injection, status codes, and request/response models.
- `app/services/`: reusable business use-cases. Services must not create global database sessions.
- `app/core/`: environment-backed settings, exception handlers, and application lifecycle concerns.
- `app/db/`: engine, declarative base, and request-scoped database sessions.
- `app/models.py`: SQLAlchemy persistence models. Split by domain when this module becomes difficult to navigate.
- `app/schemas.py`: Pydantic transport schemas. Split by domain at the same point as models.
- `app/domain.py`: pure financial calculations with no HTTP or database dependency.
- `app/utils/validation/json_validator.py`: the shared API envelope and response builder.

Legacy `app.config` and `app.database` modules are compatibility shims for migrations and external imports. New code must import from `app.core.config` and `app.db.session`.

## Response contract

Successful JSON responses use:

```json
{
  "status": "success",
  "message": "Transactions retrieved",
  "data": []
}
```

Errors use the same shape with `status: "error"`. Request-validation errors provide field details in `data`. Endpoints returning HTTP `204 No Content` intentionally have no response body.

Routes should declare `response_model=ApiResponse[SchemaType]` and return `JsonResponse.success(...)`. This preserves OpenAPI documentation, computed Pydantic fields, and Decimal serializers. Expected failures should raise `HTTPException`; the global handlers convert them into the error envelope.

## Rules retained from the review

- Secrets remain in environment variables; never add service-account JSON files to the repository.
- Alembic owns production schema changes; automatic table creation is development/test only.
- Database sessions are request-scoped through `Depends(get_db)`.
- Do not instantiate stateful services globally in route modules.
- Do not suppress database startup failures in production.
