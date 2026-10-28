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
