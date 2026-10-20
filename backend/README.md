# Spendova API

FastAPI backend for Spendova's accounts, categories, double-entry transactions,
savings goals and contributions, owned assets, budgets, recurring money, and
dashboard analytics.

## Local setup

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/docs`. The React app expects the API base URL
`http://localhost:8000/api/v1` by default.

## Authentication

Development defaults to `AUTH_REQUIRED=false`. Requests use
`local-development-user`, or a test identity supplied with `X-User-Id`.

Production must set `AUTH_REQUIRED=true` and `FIREBASE_PROJECT_ID`. The frontend
sends its Firebase ID token using `Authorization: Bearer <token>`. Never send a
database password or Gemini API key to the browser.

Authentication endpoints:

- `POST /api/v1/auth/google` — creates a profile on first Google sign-in and
  returns the existing profile on later logins.
- `GET /api/v1/auth/me` — returns the authenticated profile.
- `PATCH /api/v1/auth/me` — updates locale, currency, country, timezone, and
  onboarding state.
- `POST /api/v1/auth/logout` — completes the backend logout contract; the
  frontend must also call Firebase `signOut` and discard its token.

## Supabase PostgreSQL

Copy the appropriate connection string from Supabase's **Connect** panel into
`backend/.env` as `DATABASE_URL`, using the `postgresql+psycopg` scheme. Prefer
the session pooler URL where IPv6 is unavailable. Then run:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
```

The password belongs only in `.env` or the deployment platform's secret store.

## Quality checks

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m compileall -q app
```

Production schema changes must use Alembic. `create_all` runs only for local
development and tests.

## Implemented API areas

- `/api/v1/auth` — Google sign-in, current profile, preferences, and logout.
- `/api/v1/accounts` — account creation, listing, and archival.
- `/api/v1/categories` — defaults plus user-defined categories.
- `/api/v1/transactions` — filtered ledger-backed transactions and voiding.
- `/api/v1/goals` — savings goals and contribution history.
- `/api/v1/assets` — owned assets, age, and cost-per-day.
- `/api/v1/budgets` — monthly/category limits and live status.
- `/api/v1/recurring-rules` — salary, subscriptions, bills, and other schedules.
- `/api/v1/dashboard` — month/year cash-flow and category summaries.
