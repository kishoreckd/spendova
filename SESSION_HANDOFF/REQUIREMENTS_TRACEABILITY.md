# Requirements Traceability

Updated: 21 October 2026

| Requirement | Current state | Primary references |
|---|---|---|
| Personal single-user finance app | Confirmed | `DECISIONS.md` |
| User-selected country/currency | Onboarding + profile; UI formats with profile currency/locale | `hooks/use-money.ts`, `profile-page.tsx` |
| Google and email sign-in | Implemented with Firebase; email codes via FastAPI | `features/auth/`, `app/api/auth.py` |
| Manual transactions | Implemented: expense, income, account-to-account transfer | `transaction-sheet.tsx`, `app/api/transactions.py` |
| Transaction edit/void UI | Not implemented (API void exists) | `app/api/transactions.py` |
| Receipt OCR | Removed from current scope | — |
| Multiple accounts/cards | Implemented; owned account IDs and transaction-derived balances | `enhanced-accounts-page.tsx`, `app/api/accounts.py` |
| Loans/FD/RD/investments | Account details, balances, recurring contributions, projections implemented; amortization pending | `enhanced-accounts-page.tsx`, `app/models.py` |
| Custom categories | Create, edit, archive, quick create from pickers | `features/categories/` |
| Monthly analytics | Dashboard and reports from real data | `features/dashboard/`, `features/reports/` |
| Budgets | Create, delete, total and per-category status | `features/planning/`, `app/api/budgets.py` |
| Recurring commitments | Bills, income and investments; confirmation posts transaction and advances due date | `bill-form-dialog.tsx`, `app/api/recurring.py` |
| Purchase goals | Planner saves goals; contributions; target dates pending | `purchase-goal-calculator.tsx`, `app/api/goals.py` |
| Asset age and cost per day | Implemented | `app/domain.py`, `features/assets/` |
| Asset replacement goal | Expected life or target cost per day; progress and date | `app/domain.py::replacement_goal` |
| Data export | Excel (.xlsx, 8 sheets) and JSON, all records | `lib/excel-export.ts` |
| Form validation and feedback | Inline field errors, loading buttons, toasts on all forms | `lib/forms.ts`, `components/ui/field.tsx` |
| Gemini insights | Planned | `PRODUCT_PLAN.md` |
| Mobile responsiveness | Mobile pass done; real-device QA pending | `app-shell.tsx` |
| Schema migrations | One linear Alembic chain; head `20261021_0011` | `backend/migrations/` |
| Frontend deployment | Live on Vercel | `frontend/vercel.json` |
| Backend deployment | Railway-ready Docker image | `backend/Dockerfile` |
