# Spendova Backend

Production FastAPI API for Spendova. It provides session-authenticated user
profiles, accounts, categories, ledger-backed transactions, budgets, goals,
recurring money, owned assets, loans and EMIs, an audit log, and dashboard
analytics. Layout and conventions: [`../docs/02-architecture.md`](../docs/02-architecture.md);
endpoints: [`../docs/05-api-spec.md`](../docs/05-api-spec.md).

## Local development

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

The health endpoint is `http://localhost:8000/health`; API documentation is
available at `http://localhost:8000/docs` outside production.

## Vercel deployment

The API runs on Vercel as a serverless FastAPI function (same setup as Vaultessa).

1. Vercel â†’ **Add New Project** â†’ import `kishoreckd/spendova` â†’ **Root Directory = `backend`**.
   Vercel installs from `pyproject.toml` and serves `app.main:app` (`[tool.vercel]`).
2. Add the variables from [`.env.production.example`](.env.production.example) under
   Settings â†’ Environment Variables (Production). With `ENVIRONMENT=production` the API refuses
   to start unless `AUTH_REQUIRED=true`, `JWT_ACCESS_SECRET`, `OTP_SECRET` and
   `DATA_ENCRYPTION_KEY` are separate 32+ character values, and Brevo SMTP settings are complete.
3. Use Supabase's **transaction pooler** URL (port 6543) for `DATABASE_URL`. On Vercel the app
   uses no connection pool of its own and disables prepared statements for the pooler.
4. Migrations: Vercel has no pre-deploy hook, so `.github/workflows/migrate-database.yml` runs
   `alembic upgrade head` on every push to `main` that touches the schema. Add the repository
   secret `PRODUCTION_DIRECT_URL` (Supabase **session** pooler, port 5432) once. Keep
   migrations backward compatible â€” the new API may go live a minute before they finish.
5. Email retries: emails go out right after each request; failures are retried by Vercel Cron
   calling `/cron/email-outbox` (schedule in `vercel.json`, daily on the Hobby plan â€” tighten it
   to e.g. `*/15 * * * *` on Pro). Set `CRON_SECRET` so only Vercel can call it.
6. Set the frontend deployment's server-only `BACKEND_URL` to the API HTTPS origin and
   `VITE_API_BASE_PATH=/api/v1`. Put the frontend origin in backend `CORS_ORIGINS` and `APP_URL`.

Check a deployment with `GET /health` (database), `GET /health/email` (SMTP login), and
`POST /health/email` with header `X-Email-Test-Key: <EMAIL_TEST_API_KEY>` and
`{"email": "you@example.com"}` (sends one test email, at most one per minute).

Rate limits are in memory per serverless instance, so they are approximate on Vercel.

## Local email (Mailpit)

`docker compose up -d mailpit` from the repo root starts a local mail catcher. The local
template sends through it (`SMTP_HOST=127.0.0.1`, `SMTP_PORT=1026`); read the codes at
http://127.0.0.1:8026. To get real emails locally, use the Brevo settings from the production
template in your private `backend/.env` while keeping `ENVIRONMENT=development`.

## Authentication

In production, the frontend uses Spendova's database-backed email/password authentication.
Short-lived access tokens stay in browser memory; rotating refresh tokens are stored as hashes in
PostgreSQL and delivered only through an HttpOnly, Secure, SameSite=Strict cookie. The frontend
Vercel proxy keeps browser API calls same-origin. Firebase is not used.

## Verification

```powershell
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m ruff format --check .
.\.venv\Scripts\pyright.exe
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m alembic check
.\.venv\Scripts\python.exe -m pytest -q
```

The schema changes only through Alembic; the app never calls `create_all`, and
tests build their database by running the migrations. Preview the email
templates with `python scripts/preview_emails.py`.

## Docker local stack

From the repository root run `docker compose up -d --build --wait`. The API applies migrations
to the private Docker PostgreSQL database automatically. Runtime settings come from the private
backend env file; image build contexts exclude all env files. See the root README for URLs.
## Swagger and response conventions

For the local Compose stack, run `python backend/scripts/setup_local_docs.py` from the repository
root, then `docker compose up -d --force-recreate --wait api`. This creates the gitignored
`backend/.env.docs.local` with a random documentation password and username `developer`.
Open that file locally to see the password. It is excluded from container images. Swagger and
all schema aliases then require the separate documentation login, like the Password project.

The backend follows the Password/Vaultessa structure: `api/` routers, `services/` business logic,
`schemas/` DTOs, `db/models/` tables, and `core/` shared configuration, docs and errors.
Swagger: `/api/docs` (also `/docs`). Schema: `/api/openapi.json` (also `/openapi.json`).
ReDoc: `/redoc`. Use **Authorize** with a Spendova access token to call authenticated endpoints.

JSON responses use `{ "status": "success" | "error", "message": "...", "data": ... }`.
Errors have `data.code` and optional field `data.details`. Request validation uses HTTP 400;
HTTP 204 has no body. Swagger describes the envelope while routers validate/filter the DTO.

To protect docs locally or enable protected production docs, set `ENABLE_API_DOCS=true`,
`SWAGGER_USERNAME`, and `SWAGGER_PASSWORD` (16â€“1024 characters) in your own environment.
`SWAGGER_SESSION_TTL_MINUTES` defaults to 60. Documentation login is separate from account login.
When disabled, documentation is public locally and unavailable in production.

## Local account authentication (11 November 2026)

Authentication now follows the Password project: scrypt password hashes, database sessions,
15-minute signed access tokens, rotating HttpOnly refresh cookies, five-attempt password lockout,
email verification, and code-based password reset with session revocation. Firebase is not used.
Run `python backend/scripts/setup_local_auth.py` once, then rebuild/restart Compose; the generated
`backend/.env.auth.local` is gitignored and excluded from images. Production requires a separate
32+ character `JWT_ACCESS_SECRET`, plus the existing OTP/encryption/SMTP settings. Cookie-auth
refresh/logout require an allowed Origin; the frontend deployment proxy keeps requests same-origin,
so production cookies use Secure and SameSite=Strict. Set CORS_ORIGINS to the exact trusted frontend origin.

Existing user IDs and financial records are preserved. Existing Firebase users must use Forgot
password to establish their local password after email-code confirmation. Local mail is captured
at http://localhost:8026; production retains the Brevo SMTP outbox pipeline. The Password project's
vault-specific key derivation/encryption and optional authenticator/recovery MFA are not copied
into Spendova's account login.
