# Architecture

Spendova is one repository with two independently deployed apps:

| App | Stack | Hosted on |
|---|---|---|
| `backend/` | Python 3.12, FastAPI, SQLAlchemy 2 (sync), Alembic, Pydantic v2 | Vercel (serverless function), PostgreSQL on Supabase |
| `frontend/` | React 19, Vite, Tailwind 4, shadcn (Base UI), TanStack Query, react-hook-form + zod | Vercel |

Identity comes from Firebase Authentication. The browser signs in with Firebase and sends the ID
token as `Authorization: Bearer <token>`; the backend verifies it and owns profiles, data, and
authorization. The structure mirrors the Vaultessa project.

## Backend

```
backend/app/
  main.py                    app = create_app()
  core/
    application.py           create_app(): middleware, routers, error handlers, lifespan
    config.py                Settings (env vars); refuses unsafe production config
    deps.py                  DbSession, SignedIn, Auth (verified user) dependencies
    errors.py                AppError + the error envelope handlers
    security.py              Firebase token check, one-time codes, AES-GCM seal/unseal
    rate_limit.py            per-IP sliding-window limiters (global, auth)
    schema.py                RequestModel (extra="forbid"), ApiModel, shared field types
    finance.py               pure money maths: postings, goals, cost-per-day, loans/EMIs
  constants/                 API prefix, finance enums and defaults, email theme
  api/<feature>.py           HTTP routes: validate, call service, audit, commit
  services/<feature>_service.py  business logic and authorization; never commits
  schemas/<feature>.py       request/response models per feature
  db/
    session.py               engine, Base, request-scoped sessions (SQLite FKs enforced)
    model_helpers.py         ids and timestamp columns
    models/<name>_model.py   one table per file; models/__init__.py registers them all
  utils/templates/emails/    Jinja email templates (layout, dark mode, one file per email)
  utils/validation/          ApiJSONResponse (the success envelope)
migrations/                  Alembic; the only way the schema changes
tests/                       pytest; the schema is built by running the real migrations
```

### Request lifecycle

1. Middleware: global rate limit, CORS, security headers.
2. `Auth` resolves the Firebase user (or the local development user when `AUTH_REQUIRED=false`)
   and requires a verified email when authentication is enforced.
3. The router calls one service function. Services `add`/`flush`, check ownership, and raise
   `AppError`. They never commit.
4. Mutating routes write an audit row with `record(...)` and then call `db.commit()` once, so the
   change, its audit entry, and any queued email are atomic.
5. Responses use the envelope below. Errors raised anywhere are converted by `core/errors.py`.

### Response envelope

```json
{ "status": "success", "message": "Loan created", "data": { ... } }
{ "status": "error", "message": "Some details need attention",
  "data": { "code": "VALIDATION_ERROR", "details": [{ "path": "lines.0.amount_limit", "message": "..." }] } }
```

Validation errors use HTTP 400. Other codes: `UNAUTHORIZED`, `EMAIL_NOT_VERIFIED`, `FORBIDDEN`,
`NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `UNAVAILABLE`, `INTERNAL`. `204` responses have no body.

### Money and ledger

Money is `Decimal` end to end and travels as a decimal string. Every transaction creates balanced
ledger entries (`core/finance.create_posting` + `assert_balanced`); account balances derive from the
opening balance plus cleared entries. Financial writes accept an `Idempotency-Key` header.

### Email

Emails are queued in `email_outbox` inside the caller's transaction and sent by a background task
after commit; failures are retried with backoff (an in-process loop locally, Vercel Cron calling
`/cron/email-outbox` in production). Bodies are sealed with AES-GCM until sent.
See [11-email-delivery.md](./11-email-delivery.md).

### Loans and EMIs

`loans` stores only the terms. EMI, schedule, interest split, progress, and due dates are
recalculated from them by `core/finance.py` (reducing balance). Each tracked loan owns a monthly
recurring bill; paying an EMI posts a real expense through it. See
[12-loans-and-finance-assistant.md](./12-loans-and-finance-assistant.md).

## Frontend

```
frontend/src/
  api/client.ts              apiFetch: Firebase token, envelope unwrap, ApiError(code, fieldErrors)
  api/<feature>/api.ts       typed calls for one backend router; types.ts holds its contracts
  lib/query-client.ts        QueryClient, every query key, invalidateLedger()
  lib/forms.ts               zod helpers, applyServerErrors, toasts
  features/<feature>/        page.tsx, dialogs, hooks.ts (TanStack Query), feature maths
  components/common/         shared app components (form-field, money-input, date-picker,
                             tile-picker, account-select, confirm-dialog, loading-screen)
  components/layout/         app shell, navigation, page actions slot
  components/ui/             shadcn primitives only (no business logic)
  app/router.tsx             lazy routes and auth guards
```

Server state lives in the TanStack Query cache; components never call `fetch`. Mutations
invalidate the keys they affect, and anything that posts money calls `invalidateLedger()` so
balances, the dashboard, budgets, bills, loans, and goals refresh together. Signing out (or
switching user) clears the cache.

## Deployment (Vercel + Supabase)

```
Browser ──► Vercel: frontend project (static React build)
   │  HTTPS + Firebase ID token (VITE_API_URL)
   ▼
Vercel: backend project (FastAPI serverless function, Root Directory = backend)
   │  Supabase transaction pooler (6543), no app-side pool
   ▼
Supabase PostgreSQL ◄── GitHub Actions: alembic upgrade head on push to main (session pooler, 5432)
```

- Vercel serves `app.main:app` from `pyproject.toml` (`[tool.vercel]`); `.vercelignore` keeps tests,
  scripts, and local files out of the bundle. Vercel sets `VERCEL=1`, which turns off the in-process
  email loop and the connection pool.
- Migrations run from `.github/workflows/migrate-database.yml` (secret `PRODUCTION_DATABASE_URL`).
  Keep them backward compatible: the new API can go live a minute before they finish.
- Vercel Cron (`backend/vercel.json`) calls `/cron/email-outbox` with `CRON_SECRET` to retry emails.
- Rate limits are per instance (approximate on serverless).
- Production refuses to start unless `AUTH_REQUIRED=true`, `FIREBASE_PROJECT_ID` is set,
  `OTP_SECRET` and `DATA_ENCRYPTION_KEY` are 32+ random characters, `EMAIL_DELIVERY_MODE=smtp`,
  and the SMTP host, username, password, and sender are set. Full list: `backend/.env.production.example`.
- Release order: merge to `main` (migrations run), let the backend deploy, then the frontend.
