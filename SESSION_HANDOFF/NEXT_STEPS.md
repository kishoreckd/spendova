# Ordered Next Steps

Updated: 28 October 2026 (Asia/Kolkata)

## 1. Release the restructure

- Review `git status` on `refactor/vaultessa-structure`, commit, and open a PR to `main`.
- Create the backend Vercel project (Root Directory `backend`) and add every variable from
  `backend/.env.production.example`: `DATABASE_URL` (Supabase transaction pooler 6543),
  `AUTH_REQUIRED=true`, `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON`, 32+ character
  `OTP_SECRET` and `DATA_ENCRYPTION_KEY`, Brevo SMTP (`SMTP_USERNAME`, `SMTP_PASSWORD` = SMTP key,
  verified `EMAIL_FROM`), `APP_URL`, `CORS_ORIGINS`, `CRON_SECRET`, optional `EMAIL_TEST_API_KEY`.
  The API will not boot without the required ones.
- Add GitHub secret `PRODUCTION_DATABASE_URL` (Supabase session pooler 5432); merging to `main`
  then runs migrations 0006–0014.
- Point the frontend's `VITE_API_URL` at the backend Vercel URL + `/api/v1`, then redeploy it.
- Verify: `/health`, `/health/email`, a `POST /health/email` test, sign-up code, forgot password.
- Rotate the Supabase password that appeared in an earlier chat.
- Real-device QA (iPhone + Android): loan form and preview, loan detail charts, Pay EMI, Plan › Bills,
  transaction sheet, toasts.

## 2. Finance assistant foundation

- `GET /api/v1/insights/snapshot`: one deterministic JSON of income, spending, budgets, goals,
  bills, loans overview, and assets (see `docs/12-loans-and-finance-assistant.md`).
- Then the chat UI with tool calls to `/loans/preview` and the purchase planner; no model arithmetic.

## 3. Finance model

- Ledger split for EMIs (principal to a loan liability, interest/fees as expenses).
- Loan prepayment/part-payment (reduce tenure or EMI) and floating-rate changes.
- Transaction edit and void in the UI; desktop table with filters.
- Budget, bill, and loan editing; goal target dates.
- Credit card statements and bill payments.

## 4. Notifications and privacy

- EMI and bill reminders through the email outbox; persist notification preferences.
- Account deletion and a server-side export.

## 5. Release hardening

- Vitest + Testing Library for forms/hooks; Playwright for sign-in → add loan → pay EMI.
- Run backend tests against PostgreSQL in CI as well as SQLite.
- Request IDs, monitoring, backup/restore rehearsal, dependency scanning.
