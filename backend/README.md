# Spendova Backend

Production FastAPI API for Spendova. It provides Firebase-authenticated user
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

1. Vercel → **Add New Project** → import `kishoreckd/spendova` → **Root Directory = `backend`**.
   Vercel installs from `pyproject.toml` and serves `app.main:app` (`[tool.vercel]`).
2. Add the variables from [`.env.production.example`](.env.production.example) under
   Settings → Environment Variables (Production). With `ENVIRONMENT=production` the API refuses
   to start unless `AUTH_REQUIRED=true`, `FIREBASE_PROJECT_ID`, 32+ character `OTP_SECRET` and
   `DATA_ENCRYPTION_KEY`, `EMAIL_DELIVERY_MODE=smtp`, and the SMTP host, username, password, and
   sender are all set.
3. Use Supabase's **transaction pooler** URL (port 6543) for `DATABASE_URL`. On Vercel the app
   uses no connection pool of its own and disables prepared statements for the pooler.
4. Migrations: Vercel has no pre-deploy hook, so `.github/workflows/migrate-database.yml` runs
   `alembic upgrade head` on every push to `main` that touches the schema. Add the repository
   secret `PRODUCTION_DATABASE_URL` (Supabase **session** pooler, port 5432) once. Keep
   migrations backward compatible — the new API may go live a minute before they finish.
5. Email retries: emails go out right after each request; failures are retried by Vercel Cron
   calling `/cron/email-outbox` (schedule in `vercel.json`, daily on the Hobby plan — tighten it
   to e.g. `*/15 * * * *` on Pro). Set `CRON_SECRET` so only Vercel can call it.
6. Use the deployment's URL + `/api/v1` as the frontend's `VITE_API_URL`, and put the frontend
   origin in `CORS_ORIGINS` and `APP_URL`.

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

In production, the frontend sends a Firebase ID token using
`Authorization: Bearer <token>`. `POST /api/v1/auth/google` creates or updates
the local PostgreSQL profile after a valid Google sign-in. Password/email signup
uses Firebase plus the backend verification flow.

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
