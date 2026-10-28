# Developer guide

## Run locally

```powershell
# Backend (in backend/)
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
Copy-Item .env.example .env          # never commit .env
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload    # http://localhost:8000

# Frontend (in frontend/)
npm ci
Copy-Item .env.example .env.local    # VITE_API_URL=http://localhost:8000/api/v1
npm run dev                          # http://localhost:5173
```

With `AUTH_REQUIRED=false` the backend treats requests without a token as a local development
user; the frontend still signs in with Firebase, which creates the profile via `POST /auth/google`.
Email codes print to the backend console when `EMAIL_DELIVERY_MODE=console`. Preview every email
template with `python scripts/preview_emails.py` (writes `app/email_previews/`).

## Quality gates (CI runs all of these)

| Where | Command |
|---|---|
| backend | `python -m ruff check .` · `python -m ruff format --check .` · `pyright` |
| backend | `python -m alembic upgrade head` · `python -m alembic check` (models match migrations) |
| backend | `python -m pytest` (the test database is built by running the migrations) |
| frontend | `npm run check` (prettier, oxlint, `tsc -b`, production build) |

## Structure rules

- Backend: `api/` routes audit and commit; `services/` hold logic and never commit; `schemas/`
  per feature; one model per file in `db/models/`; pure maths in `core/finance.py`.
- Frontend: features own their pages, dialogs, and `hooks.ts`; HTTP only through `api/<feature>`;
  shared app components in `components/common`; shadcn primitives in `components/ui` stay generic.
- Aim for components under ~250 lines; split dialogs, tabs, schemas, and maths into their own files.

## Financial and data safety

- Money is a decimal string on the wire and `Decimal` in Python — never a float in storage.
- Balances derive from balanced ledger entries; transfers are neither income nor expense.
- Financial writes take an `Idempotency-Key`.
- Every query is scoped to the signed-in user; another user's record is a 404.
- Secrets stay in environment variables. Nothing secret goes in a `VITE_*` variable, the repo, or chat.

## UI rules

Mobile first (check at 360–400px and desktop), shadcn components, inline field errors (no native
browser bubbles), loading state on every submit, toasts for outcomes, and no explanatory copy in
the UI. See `08-ux-plan.md` and the `spendova-ux` skill.
