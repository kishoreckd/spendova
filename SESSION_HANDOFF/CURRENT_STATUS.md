# Current Implementation Status

## Backend

FastAPI version: `0.5.0`.

Implemented API areas:

- Firebase Google-token verification boundary and local development identity.
- Google sign-up/login profile persistence, current profile, updates, logout.
- Accounts: create, list, archive.
- Categories: eight seeded defaults plus custom categories and archival.
- Transactions: list/filter, balanced postings, idempotency, voiding.
- Goals: creation, listing, deletion, contributions, recalculation.
- Assets: manual ownership records, age, purchase cost per day, archival.
- Budgets: monthly totals, category allocations, live remaining amount.
- Recurring rules: salary, income, bills, subscriptions, transfers.
- Dashboard: month/year income, spending, cash flow, category totals.

Database and migrations:

- SQLAlchemy 2 and Psycopg 3.
- Alembic is the migration source of truth.
- Supabase PostgreSQL connection is working.
- Current database revision: `20261020_0004 (head)`.
- GitHub/Supabase native migration integration was intentionally not installed;
  it expects `supabase/migrations`, which would duplicate Alembic ownership.

Verification:

- Backend tests pass when run from `backend/`: 11 passed.
- One non-blocking Starlette/AnyIO deprecation warning remains.
- Running pytest from the repository root currently fails imports; run it from
  `backend/` or add root-level test configuration later.

## Frontend

Implemented as React 19, TypeScript, Vite, Tailwind CSS, shadcn-derived UI,
React Router, React Query dependency, and Recharts.

Pages exist for:

- Sign-in and onboarding.
- Dashboard.
- Transactions.
- Planning and purchase-goal calculations.
- Reports.
- Accounts/cards.
- Assets.
- Categories.
- Receipt scanning UI.
- Profile, settings, and more navigation.

Mobile work completed:

- Desktop sidebar and mobile bottom navigation.
- Mobile-safe 44px controls.
- iOS safe-area support.
- Dynamic viewport-height sheets/dialogs.
- Narrow-form collapse below 400px.
- Responsive charts and headings.
- Reduced-motion support and accessible navigation labels.
- Light/dark brand assets.

Frontend verification:

- `npm run check` passes formatting, TypeScript, and production build.
- Oxlint reports three pre-existing shadcn Fast Refresh warnings only.

Integration status:

- Firebase Google sign-in, persistent auth state, protected routes, and logout
  are implemented.
- Email/password sign-in and sign-up use Firebase, followed by a FastAPI
  six-digit email-verification flow with expiry, resend throttling, attempt
  limiting, HMAC-hashed codes, and backend enforcement for financial routes.
- The authenticated API client attaches fresh Firebase ID tokens to FastAPI
  requests.
- Google sign-in creates or updates the PostgreSQL user using the verified UID,
  email, display name, and Google profile photo.
- Onboarding persists region/currency, first account, optional recurring monthly
  income, and completion status.
- Firebase Analytics is initialized only for production builds and currently
  records a privacy-safe login/onboarding event without financial values or PII.
- Transaction creation uses the authenticated API helper.
- The authenticated dashboard now loads the signed-in user's totals, category
  spending, and recent transactions from FastAPI; its former static dataset is
  available only through the public `/demo` preview.
- Most screens still use mock/static data.
- React Query integration and broader typed API coverage are not complete.

## Infrastructure and repository

- Supabase PostgreSQL: connected and migrated.
- Firebase project `spendova-a6d20`: Google provider, web app, and Analytics
  configured. Local frontend/backend environment variables are present.
- Cloud Run backend deployment: not completed.
- Vercel frontend deployment: not completed.
- The local folder is currently not initialized as a Git repository; `git
  status` reports that no `.git` directory exists.
- Intended GitHub repository name shown by the user: `kishoreckd/spendova`.

## Google database decision

Google Cloud Run has a useful free tier for FastAPI, but Google Cloud SQL does
not provide a comparable permanent free PostgreSQL database for this design.
Firestore has a free tier, but replacing PostgreSQL would weaken relational
reporting, constraints, ledger consistency, and migrations. Keep Supabase
PostgreSQL for the MVP and host FastAPI on Cloud Run.
