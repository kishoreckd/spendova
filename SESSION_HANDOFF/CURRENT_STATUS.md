# Current Implementation Status

Updated: 21 October 2026 (Asia/Kolkata)

## Repository and verification

- Repository: `https://github.com/kishoreckd/spendova.git`, branch `main`.
- Frontend `npm run check` passes (Prettier, Oxlint, `tsc -b`, Vite build).
  Oxlint reports only the three long-standing shadcn Fast Refresh warnings.
- Backend: 32 tests pass; Pyright previously reported 0 errors and 0 warnings.
- Alembic has one linear head: `20261021_0011`.
- The 21 October work is not yet committed. Review `git status` before committing.

## Backend (FastAPI 0.7.0)

Implemented:

- Firebase identity verification, Google/email user sync, six-digit email codes.
- Profile, onboarding, locale, currency, and time zone.
- Accounts, categories (create, edit, archive), transactions with balanced postings.
  Transactions and recurring rules reference accounts by owned IDs; readable
  source/destination names remain snapshots. Duplicate account names are safe.
- Live account balances derive from opening balance plus transactions. Loans,
  fixed deposits, and recurring deposits include finance details and projections.
- Goals with contributions; assets with create, edit, archive.
- Asset replacement goal: optional expected life in months **or** target cost per
  day (never both; enforced by schema, endpoint, and a database check constraint).
  `replacement_goal` returns target cost per day, days needed, reached-on date,
  days remaining, progress percent, and reached flag. Logic lives in
  `app/domain.py` (`replacement_goal`, `cost_per_day`, `days_owned`, `add_months`).
- Budgets: create, delete, and status with total and per-category spent/remaining.
  Budget lines accept expense categories only.
- Recurring bills, income, and investments: create, list, stop, mark paid/received,
  create the transaction, and advance the next due date.
- Forgot password (`app/api/password_reset.py`): `request` â†’ emailed 6-digit code
  (identical response for unknown emails, mail sent in background, 60 s silent
  throttle), `verify` â†’ single-use reset token (5 attempts, code spent on success),
  `complete` â†’ Firebase Admin sets the password, revokes other sessions, and sends a
  "password changed" email. Google-only accounts receive a "sign in with Google" email.
  Requires `FIREBASE_SERVICE_ACCOUNT_JSON`; without it, production returns 503 and
  development can test the first two steps only.
- Branded HTML + plain-text emails in `app/email_templates.py` (verification,
  reset code, Google notice, password changed); `app/email.py` supports SMTP on
  587 (STARTTLS) and 465 (TLS) and refuses console delivery in production.
- Migration head is `20261021_0011` (account-ID references).

Database state:

- Code head: `20261021_0011`.
- Connected Supabase was last confirmed at `20261020_0005`. Migrations `0006`
  through `0011` must run before the new backend serves traffic; Railway's pre-deploy
  `alembic upgrade head` does this. **Deploy the backend before the frontend.**

## Frontend

Shared building blocks (use these for any new form):

- `components/ui/field.tsx` â€” `Field` (label, inline error, optional marker) and `FormAlert`.
- `lib/forms.ts` â€” zod helpers (`money`, `optionalMoney`, `requiredText`,
  `pastOrToday`), `controlProps`, `applyServerErrors`, `notifySuccess`, `notifyError`.
- `components/ui/button.tsx` â€” `loading` prop (spinner, disabled, `aria-busy`).
- `components/tile-picker.tsx` â€” tiles (categories) or chips (asset/account types)
  with inline "+ New".
- `components/date-picker.tsx` â€” shadcn Popover + Calendar, min/max, Today/Yesterday.
- `components/money-input.tsx`, `components/confirm-dialog.tsx`.
- `hooks/use-money.ts` â€” currency/locale formatting from the profile.
- `app/page-actions.tsx` â€” renders page buttons into the shell header.
- Toasts: Sonner, mounted in `App.tsx`; top-right on desktop, full-width top on mobile.

Feedback conventions: forms use `noValidate` + react-hook-form + zod; field errors
appear under the field after blur or submit; non-field errors use `FormAlert`;
successful saves and page-level actions show a toast.

Screens:

- Transaction dialog: centered on desktop and full-screen on mobile; category
  quick-create, account-ID transfers, commitment linking, date picker, and
  "Save & add another".
- Plan: budgets (create, per-category progress, delete), goals (add money, delete),
  purchase planner that saves a real goal, bills (create, due labels, monthly
  total, stop).
- Assets: replacement goal with live preview, progress, edit, custom types, confirm removal.
- Categories: Expense/Income tabs, tap to edit, live preview, archive from edit dialog.
- Accounts: multiple bank/card/cash/loan/FD/RD/investment accounts, live balances,
  deposit maturity projections, net worth, and archive confirmation.
- Transactions: grouped by day with category icons, search, skeleton loading.
- Reports: loading state, uses all transactions (paginated), compact mobile metrics.
- Settings: Excel (.xlsx, 8 sheets) and JSON export, theme (light/dark/auto),
  notification toggles marked "Coming soon", sign out.
- Explanatory copy was removed app-wide at the user's request. Keep new UI terse.
- Dark mode persists via `next-themes`; the dashboard greets the signed-in user.

## Services and deployment

- Frontend is live on Vercel (`spendova-jet.vercel.app`).
- Railway backend uses root `/backend`; production requires `AUTH_REQUIRED=true`,
  `ENVIRONMENT=production`, managed secrets, exact CORS origins, SMTP delivery.
- Firebase project `spendova-a6d20`; Supabase PostgreSQL.
