# Prompt for a New Session

Copy the following into the next session:

```text
Continue developing Spendova from this repository:
C:\Users\CXO\OneDrive - CXOntology Inc\expense

First read every file in SESSION_HANDOFF/, especially FULL_CONTEXT.md, then read DECISIONS.md,
ENGINEERING_STANDARDS.md, FINANCIAL_RULES.md, and the relevant implementation
plan before changing code.

Current state: FastAPI 0.5.0 is connected to Supabase PostgreSQL and Alembic is
at 20261020_0003 head. Backend tests pass (11) when run from backend/. The React
frontend builds and is mobile-responsive, but most screens still use mock data.

Priority: integrate Firebase Google authentication and create the shared typed,
authenticated React Query API layer, then replace mocks in the order documented
in SESSION_HANDOFF/NEXT_STEPS.md.

Never read aloud, print, commit, or expose backend/.env. Preserve the monorepo,
shadcn-based UI, mobile-first behavior, per-user database isolation, exact
Decimal money handling, and Alembic as the migration source of truth. Verify all
changes with tests/builds and update the handoff status before stopping.
```
