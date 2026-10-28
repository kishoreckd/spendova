# Requirements Traceability

Updated: 28 October 2026

| Requirement | Current state | Primary references |
|---|---|---|
| Personal single-user finance app | Confirmed | `docs/10-decisions.md` |
| User-selected country/currency | Onboarding + profile; UI formats with profile currency/locale | `hooks/use-money.ts`, `features/profile/page.tsx` |
| Google and email sign-in | Firebase; email verification codes via FastAPI | `features/auth/`, `app/api/auth.py` |
| Forgot password by emailed code | Implemented; outbox delivery, branded templates | `app/api/password_reset.py`, `docs/11-email-delivery.md` |
| Manual transactions | Expense, income, account-to-account transfer | `features/transactions/transaction-sheet.tsx`, `app/api/transactions.py` |
| Transaction edit/void UI | Not implemented (API void exists) | `app/api/transactions.py` |
| Receipt OCR | Removed from current scope | — |
| Multiple accounts/cards | Owned account IDs and transaction-derived balances | `features/accounts/`, `app/api/accounts.py` |
| Loans and products on EMI | Types, rate or EMI (effective rate), schedule, totals, pay EMI, overview, dashboard card, charts | `features/loans/`, `app/api/loans.py`, `app/core/finance.py` |
| FD/RD/investments | Account details, recurring contributions, projections | `features/accounts/`, `features/planning/` |
| Custom categories | Create, edit, archive, quick create from pickers | `features/categories/` |
| Monthly analytics | Dashboard and reports from real data | `features/dashboard/`, `features/reports/` |
| Budgets | Create, delete, total and per-category status | `features/planning/budgets-tab.tsx`, `app/api/budgets.py` |
| Recurring commitments | Bills, income, investments; mark paid posts a transaction and advances due date | `features/planning/commitments-tab.tsx`, `app/api/recurring.py` |
| Purchase goals | Planner saves goals; contributions | `features/planning/`, `app/api/goals.py` |
| Asset cost per day and replacement goal | Implemented | `app/core/finance.py`, `features/assets/` |
| Data export | Excel statement incl. Loans & EMIs sheet; Excel import | `features/settings/excel-export.ts` |
| Form validation and feedback | Inline field errors, loading buttons, toasts | `lib/forms.ts`, `components/common/form-field.tsx` |
| Audit and rate limiting | Audit log for mutations, per-IP limits | `app/services/audit_service.py`, `app/core/rate_limit.py` |
| Finance assistant | Data available; snapshot endpoint and chat planned | `docs/12-loans-and-finance-assistant.md` |
| Mobile responsiveness | Checked at 390px and desktop; real-device QA pending | `components/layout/app-shell.tsx` |
| Schema migrations | One linear Alembic chain; head `20261028_0014`; `alembic check` in CI | `backend/migrations/` |
| Frontend deployment | Live on Vercel | `frontend/vercel.json` |
| Backend deployment | Vercel serverless FastAPI; migrations via GitHub Actions; email-retry cron; production config guard | `backend/pyproject.toml`, `backend/vercel.json`, `.github/workflows/migrate-database.yml` |
| Email delivery | Mailpit locally, Brevo SMTP in production; SMTP health check and test send | `backend/.env*.example`, `app/api/health.py`, `docs/11-email-delivery.md` |
