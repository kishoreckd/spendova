# Current Implementation Status

Updated: 28 October 2026 (Asia/Kolkata)

## Repository and verification

- Repository: `https://github.com/kishoreckd/spendova.git`. Work is on branch
  `refactor/vaultessa-structure` and is **not committed yet** — review `git status` first.
- Backend 0.8.0: 96 tests pass; `ruff check`, `ruff format --check`, `pyright`, and
  `alembic check` are clean. CI (`.github/workflows/ci.yml`) runs all of these plus migrations.
- Frontend: `npm run check` passes (Prettier, Oxlint, `tsc -b`, Vite build). Oxlint reports only
  the three long-standing shadcn Fast Refresh warnings.
- Alembic head: `20261028_0014` (0012 audit logs, 0013 email outbox, 0014 loans).

## What changed on 28 October 2026

The project now follows the Vaultessa structure (see `docs/02-architecture.md`):

- **Backend layering:** `api/<feature>.py` (audit + single commit), `services/<feature>_service.py`
  (logic, never commits), `schemas/<feature>.py`, `db/models/<name>_model.py`, `core/` (application,
  config, deps, errors, security, rate_limit, schema, finance), `constants/`.
- **Errors:** envelope `data: {code, details: [{path, message}]}`; validation errors are HTTP 400 `VALIDATION_ERROR`.
- **Security:** audit log, per-IP rate limits (global + auth), security headers, production config guard.
- **Email:** transactional outbox (queued in the same transaction, sent after commit, retried,
  AES-GCM sealed); Jinja templates with dark mode; `scripts/preview_emails.py`.
- **Tests:** the database is built through the real migrations (SQLite with foreign keys on).
- **Loans & EMIs (new):** `loans` table, reducing-balance maths in `core/finance.py`, `/loans`
  endpoints (list, overview, preview, create, schedule, pay EMI, close). Each tracked loan creates a
  monthly bill in the *Loans & EMIs* category; paying posts an expense and advances progress.
  EMIs due before today are assumed paid unless the user says otherwise.
- **Frontend:** `src/api/<feature>/{api,types}.ts` + `api/client.ts`; TanStack Query hooks per
  feature (`features/<feature>/hooks.ts`, keys in `lib/query-client.ts`); window events removed;
  `components/common` and `components/layout`; large files split (planning page into tabs,
  transaction sheet, bill form, accounts page, reports analysis).
- **Loans UI:** `/loans` (in More): overview (EMIs/month, share of income, owed, interest left, due
  this month, debt-free date), loan cards with Pay EMI, add form with live EMI/interest preview
  (rate or EMI → effective rate), detail with principal-vs-interest and balance charts plus the
  schedule table, close loan. Dashboard shows an “EMIs due this month” card. Excel export has a
  Loans & EMIs sheet. Verified in light/dark at 390px and 1280px.
- **Docs:** numbered `docs/01…12`, `CLAUDE.md`, `.claude/skills/` (backend-module,
  frontend-feature, database-migration, money-math, spendova-ux, email-template, security-checklist).

## Known limits

- EMI payments post as one expense; the principal/interest split is shown, not posted.
- Notification toggles in Settings are placeholders.
- No frontend unit/E2E tests yet.

## Database and deployment state

- **The backend runs on Vercel, not Railway** (user decision, 28 Oct). `railway.json` was removed;
  `pyproject.toml` has `[tool.vercel] entrypoint = "app.main:app"`, `backend/.vercelignore` trims
  the bundle, `backend/vercel.json` schedules the email-retry cron. With `VERCEL=1` the app uses
  no connection pool and no in-process worker. See `docs/02-architecture.md#deployment-vercel--supabase`.
- Migrations: `.github/workflows/migrate-database.yml` runs `alembic upgrade head` on push to main
  (needs GitHub secret `PRODUCTION_DATABASE_URL`, Supabase session pooler 5432). Supabase was last
  confirmed at `20261020_0005`, so 0006–0014 will run on the first push.
- Email works like Vaultessa: local SMTP into Mailpit (`docker compose up -d mailpit`, inbox at
  http://127.0.0.1:8026); production Brevo SMTP. Templates: `backend/.env.example` and
  `backend/.env.production.example`. `/health/email` checks SMTP; `POST /health/email` sends a test.
- Production refuses to start unless `AUTH_REQUIRED=true`, `FIREBASE_PROJECT_ID`, 32+ character
  `OTP_SECRET` and `DATA_ENCRYPTION_KEY`, `EMAIL_DELIVERY_MODE=smtp`, and `SMTP_HOST`,
  `SMTP_USERNAME`, `SMTP_PASSWORD`, `EMAIL_FROM` are set. Also set `CRON_SECRET`.
- The local SQLite database also needs `alembic upgrade head` (the app no longer calls `create_all`).
  The user's private `backend/.env` was not changed; it may still use console email mode.
- `frontend/.env.local` currently points `VITE_API_URL` at the old production API; point it at
  `http://localhost:8000/api/v1` locally, and at the backend Vercel URL + `/api/v1` in production.
- Backend tests: 96 pass (adds email health, cron, and production-config tests).
- Frontend live on Vercel (`spendova-jet.vercel.app`); Firebase project `spendova-a6d20`.
