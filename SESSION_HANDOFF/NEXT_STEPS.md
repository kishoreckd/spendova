# Ordered Next Steps

Updated: 20 October 2026 (Asia/Kolkata)

## 1. Database release

- Rotate any database password that appeared in chat.
- Connected Supabase is at `20261020_0005`; retain `alembic upgrade head` as the Railway pre-deploy command.
- Test cross-user isolation for every financial endpoint.

## 2. End-to-end verification

- Test Google and email/password sign-in plus email verification.
- Create one account, category, transaction, asset, goal, budget, and recurring
  rule; refresh and confirm every record remains in PostgreSQL.
- Verify asset cost-per-day and reports using known test values.
- Test Android Chrome, iPhone Safari, keyboard use, dark mode, and error states.

## 3. Complete finance CRUD

- Add edit operations for accounts, assets, categories, goals, budgets, and rules.
- Derive live balances from opening balances plus ledger entries.
- Model credit limits/statements, loans/EMIs, and investment valuations.
- Add goal target dates and daily/weekly/monthly contribution requirements.
- Add transaction splits, refunds, reversals, and audit history.

## 4. Notifications and privacy

- Store notification preferences in PostgreSQL.
- Add an outbox and scheduled reminder worker.
- Configure SMTP; keep codes and financial values out of logs.
- Add account deletion and a versioned server-side export.

## 5. Deployment

- Connect `kishoreckd/spendova` to Railway, set Root Directory to `/backend`,
  configure the documented variables, and set `AUTH_REQUIRED=true`.
- Configure Railway pre-deploy command `alembic upgrade head` and healthcheck `/health`.
- Configure exact production CORS origins.
- Deploy Vite to Vercel with root directory `frontend`.
- Set `VITE_API_URL` to the Railway `/api/v1` endpoint.
- Add production domains to Firebase and run migrations as an explicit release step.

## 6. Release hardening

- Expand API authorization and abuse tests.
- Add frontend component and end-to-end tests for money workflows.
- Rehearse PostgreSQL backup/restore.
- Add dependency scanning and protected-branch rules.
- Review bundle size; Recharts and Firebase are the largest chunks.
