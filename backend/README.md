# Spendova Backend

Production FastAPI API for Spendova. It provides Firebase-authenticated user
profiles, accounts, categories, ledger-backed transactions, budgets, goals,
recurring money, owned assets, and dashboard analytics.

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

## Railway deployment

Connect the `kishoreckd/spendova` repository to a Railway service, set its Root
Directory to `/backend`, and use the checked-in Dockerfile.

Configure the service deployment settings as follows:

```text
Pre-deploy command: alembic upgrade head
Healthcheck path: /health
Healthcheck timeout: 120 seconds
Restart policy: On Failure (maximum 5 retries)
```

The Docker image starts Uvicorn on Railway's injected `PORT`. The pre-deploy
command applies schema migrations before Railway sends traffic to the release.

Configure these Railway variables (never commit their values):

```text
ENVIRONMENT=production
DATABASE_URL=postgresql+psycopg://...
CORS_ORIGINS=https://your-frontend-domain.example
AUTH_REQUIRED=true
FIREBASE_PROJECT_ID=your-firebase-project-id
OTP_SECRET=a-long-random-production-secret
EMAIL_DELIVERY_MODE=smtp
EMAIL_FROM=Spendova <no-reply@your-domain.example>
SMTP_HOST=...
SMTP_PORT=587
SMTP_USERNAME=...
SMTP_PASSWORD=...
SMTP_USE_TLS=true
```

Use the Supabase session pooler URL when Railway cannot reach the direct IPv6
database endpoint. Generate a public Railway domain after the first successful
deployment and use its `/api/v1` URL as the frontend's `VITE_API_URL`.

## Authentication

In production, the frontend sends a Firebase ID token using
`Authorization: Bearer <token>`. `POST /api/v1/auth/google` creates or updates
the local PostgreSQL profile after a valid Google sign-in. Password/email signup
uses Firebase plus the backend verification flow.

## Verification

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\pyright.exe --pythonpath .\.venv\Scripts\python.exe app tests
.\.venv\Scripts\python.exe -m compileall -q app
```

Production schema changes must use Alembic. Do not use SQLAlchemy `create_all`
as a production migration mechanism.
