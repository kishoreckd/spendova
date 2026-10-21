# Prompt for a New Session

Copy the following into the next session:

```text
Continue developing Spendova from this repository:
C:\Users\CXO\OneDrive - CXOntology Inc\expense

First read every file in SESSION_HANDOFF/, especially FULL_CONTEXT.md section 18
and CURRENT_STATUS.md, then DECISIONS.md, ENGINEERING_STANDARDS.md, and
FINANCIAL_RULES.md before changing code.

Current state: FastAPI 0.7.0, repository migration head 20261021_0011 (the
connected Supabase database was last confirmed at 0005; Railway's pre-deploy
alembic upgrade head applies 0006 through 0011). Backend: 32 tests pass.
Frontend npm run check passes. Frontend is live on Vercel.

Conventions: build forms with react-hook-form + zod and the shared Field,
FormAlert, MoneyInput, DatePicker, TilePicker, ConfirmDialog, Button loading,
and notifySuccess/notifyError helpers. No explanatory copy in the UI. Check
every screen at mobile width and on desktop.

Priority: commit and deploy (backend before frontend), real-device QA, then the
production safety items and finance model work in SESSION_HANDOFF/NEXT_STEPS.md.

Never read aloud, print, commit, or expose backend/.env. Preserve the monorepo,
shadcn-based UI, per-user database isolation, exact Decimal money handling, and
Alembic as the migration source of truth. Verify changes with tests/builds and
update the handoff before stopping.
```
