# Spendova Session Handoff

Updated: 28 October 2026 (Asia/Kolkata)

This folder contains the context required to resume Spendova development in a
new session. Read `../CLAUDE.md` (rules, layout, commands, skills) first, then
`CURRENT_STATUS.md`, `NEXT_STEPS.md`, and `REQUIREMENTS_TRACEABILITY.md`. For the
complete history and rationale, read `FULL_CONTEXT.md`.

## Repository location

The active workspace is:

```text
C:\Users\CXO\OneDrive - CXOntology Inc\expense
```

The older configured path `C:\Users\CXO\Music\expense` no longer exists. If a
new session starts there, switch to the OneDrive path before running commands.

## Product summary

Spendova is a personal, mobile-first finance application. It covers expenses,
income, accounts, credit, loans, investments, budgets, recurring payments,
savings goals, owned assets, receipt OCR, reporting, and optional Gemini
insights. It uses the finalized Spendova midnight/aqua brand.

## Agreed architecture

```text
React/Vite frontend (Vercel)
            |
            v
FastAPI backend (Vercel serverless function)
            |
            v
Supabase hosted PostgreSQL

Firebase Authentication -> Google sign-in and ID tokens
```

Keep frontend and backend in one monorepo but deploy them independently.

## Source-of-truth documents

All in `docs/`, numbered:

- `01-product-plan.md`: product scope and delivery phases.
- `02-architecture.md`: backend and frontend layout, request lifecycle, envelope.
- `03-financial-rules.md`: accounting and calculation rules (incl. loans/EMIs).
- `04-data-model.md`: implemented tables (section 0) and the target model.
- `05-api-spec.md`: every endpoint.
- `06-roadmap.md`: done and next.
- `07-dev-guide.md`: setup, quality gates, structure and UI rules.
- `08-ux-plan.md`: screens, navigation, and interaction design.
- `09-brand.md`: Spendova visual identity.
- `10-decisions.md`: confirmed product choices.
- `11-email-delivery.md`: templates and the outbox.
- `12-loans-and-finance-assistant.md`: loans/EMIs for users and the planned assistant.

## Essential commands

Backend:

```powershell
cd "C:\Users\CXO\OneDrive - CXOntology Inc\expense\backend"
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m alembic current
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Frontend:

```powershell
cd "C:\Users\CXO\OneDrive - CXOntology Inc\expense\frontend"
npm run check
npm run dev
```

## Important safety note

Do not print, inspect in chat, or commit `backend/.env`. A temporary database
password appeared in the previous chat and must be rotated before production.
This handoff deliberately contains no passwords, keys, or connection strings.
