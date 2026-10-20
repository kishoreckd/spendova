# Prompt for a New Session

Copy the following into the next session:

```text
Continue developing Spendova from this repository:
C:\Users\CXO\OneDrive - CXOntology Inc\expense

First read every file in SESSION_HANDOFF/, especially FULL_CONTEXT.md, then read DECISIONS.md,
ENGINEERING_STANDARDS.md, FINANCIAL_RULES.md, and the relevant implementation
plan before changing code.

Current state: FastAPI application version 0.6.0 is connected to Supabase PostgreSQL.
The connected database and repository are both at migration 20261020_0005.
Backend tests pass (12), Pyright is clean, the Docker image builds, and frontend
lint/build pass. Firebase
Google and email/password authentication are integrated. Dashboard,
transactions, accounts, assets, categories, planning data, and reports use the
authenticated API; sample data is isolated to the public /demo page.

Priority: deploy the backend to Railway using root /backend, run real end-to-end browser verification, then
complete edit CRUD, ledger-derived balances, notification persistence, and
Railway/Vercel deployment as ordered in SESSION_HANDOFF/NEXT_STEPS.md.

Never read aloud, print, commit, or expose backend/.env. Preserve the monorepo,
shadcn-based UI, mobile-first behavior, per-user database isolation, exact
Decimal money handling, and Alembic as the migration source of truth. Verify all
changes with tests/builds and update the handoff status before stopping.
```
