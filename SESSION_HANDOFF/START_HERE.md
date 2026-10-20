# Spendova Session Handoff

Updated: 20 October 2026 (Asia/Kolkata)

This folder contains the context required to resume Spendova development in a
new Codex session. For the complete history and rationale, read
`FULL_CONTEXT.md`. Then read `CURRENT_STATUS.md`, `REQUIREMENTS_TRACEABILITY.md`,
and `NEXT_SESSION_PROMPT.md`.

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
FastAPI backend (Railway)
            |
            v
Supabase hosted PostgreSQL

Firebase Authentication -> Google sign-in and ID tokens
```

Keep frontend and backend in one monorepo but deploy them independently.

## Source-of-truth documents

- `PRODUCT_PLAN.md`: product scope and delivery phases.
- `UI_UX_PLAN.md`: screens, navigation, and interaction design.
- `DECISIONS.md`: confirmed product choices.
- `DATABASE_SCHEMA.md`: target data model.
- `FINANCIAL_RULES.md`: accounting and calculation rules.
- `ENGINEERING_STANDARDS.md`: implementation quality standards.
- `BACKEND_IMPLEMENTATION_PLAN.md`: backend progress and remaining work.
- `BRAND.md`: Spendova visual identity.

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
