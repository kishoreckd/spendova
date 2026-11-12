# Spendova


> Resuming in a new session? Start with [`SESSION_HANDOFF/START_HERE.md`](SESSION_HANDOFF/START_HERE.md)
> and [`CLAUDE.md`](CLAUDE.md).

Spendova is a mobile-first personal finance app: accounts and ledger-backed transactions, budgets,
goals, bills and expected income, assets with cost per day, and loans/EMIs with full interest
schedules. React + shadcn frontend, FastAPI + PostgreSQL backend, Firebase Authentication.

## Repository layout

| Path | What | Deploys to |
|---|---|---|
| `frontend/` | React 19 + Vite app | Vercel (Root Directory `frontend`) |
| `backend/` | FastAPI API (serverless) | Vercel (Root Directory `backend`) + Supabase PostgreSQL |
| `docs/` | Product, architecture, rules, data model, API, roadmap | — |
| `.claude/skills/` | Project conventions for AI-assisted work | — |

## Run locally

```powershell
# API (in backend/) — http://localhost:8000/api/v1, docs at /docs
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload

# Web (in frontend/) — http://localhost:5173
npm run dev
```

Full setup, checks, and rules: [docs/07-dev-guide.md](docs/07-dev-guide.md). `docker compose up --build`
runs the API with PostgreSQL.

## Documentation

1. [Product plan](docs/01-product-plan.md)
2. [Architecture](docs/02-architecture.md)
3. [Financial rules](docs/03-financial-rules.md)
4. [Data model](docs/04-data-model.md)
5. [API specification](docs/05-api-spec.md)
6. [Roadmap](docs/06-roadmap.md)
7. [Developer guide](docs/07-dev-guide.md)
8. [UX plan](docs/08-ux-plan.md)
9. [Brand](docs/09-brand.md)
10. [Decisions](docs/10-decisions.md)
11. [Email delivery](docs/11-email-delivery.md)
12. [Loans, EMIs, and the finance assistant](docs/12-loans-and-finance-assistant.md)

## Run locally with Docker

With Docker Desktop running, from the repository root:

```powershell
docker compose up -d --build --wait
```

- App: http://localhost:5173
- Swagger: http://localhost:8000/docs
- Health: http://localhost:8000/health
- Local mail inbox: http://localhost:8026

Compose runs the Vite development frontend, FastAPI, PostgreSQL and Mailpit. It applies
Alembic migrations before the API starts. The database is private to the Docker network and
persists in the `spendova_db` volume. Existing non-Docker database records are not copied.
All published ports bind to localhost. Production deployment remains on Vercel.

The frontend receives public Firebase settings from `frontend/.env.local`. The backend receives
runtime settings from `backend/.env`; neither file is copied into an image. Compose overrides
the database, local URLs and SMTP delivery so this stack uses its own database and Mailpit.
Firebase authentication is enabled; sign in with your existing Firebase account. The local
profile is created in the Docker database. Optional AI uses the backend runtime key if configured.

```powershell
docker compose ps
docker compose stop
docker compose up -d --wait
```

Rebuild with `docker compose up -d --build --wait` after source changes. `docker compose down`
removes containers while retaining database data. Avoid `docker compose down -v` unless you
intend to permanently delete the local Docker database. Do not run the native frontend/backend
on ports 5173/8000 at the same time as this stack.

## Finance assistant and reminder settings

Settings > Finance assistant & email saves the daily AI token allowance and opt-in reminder
preferences. Defaults: 20,000 tokens per user/day; 0 pauses AI. The allowance renews at midnight
Asia/Kolkata and is shared across devices/instances. Ambiguous failed calls can retain a token
reservation. Backend OPENAI_API_KEY enables AI; local summaries and calculations work without it.

FD/RD accounts show server-calculated maturity and interest estimates; the assistant has FD/RD
and purchase/EMI calculation tools. All estimates use explicit user terms. For scheduled email,
enable the desired preferences: bills/EMIs, deposit maturity, budget thresholds or weekly review.
Docker delivers to Mailpit. Vercel's protected mail cron runs reminders and retries via Brevo.
See docs/11-email-delivery.md and docs/12-loans-and-finance-assistant.md for assumptions and setup.
