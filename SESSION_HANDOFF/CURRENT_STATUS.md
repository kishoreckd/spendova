# Current Implementation Status

Updated: 20 October 2026 (Asia/Kolkata)

## Repository and verification

- Repository: `https://github.com/kishoreckd/spendova.git`.
- Default branch: `main`; first verified full-project commit: `61b2990`.
- GitHub Actions runs frontend lint/build and backend migrations/tests/type checks.
- Secrets, local databases, environments, dependencies, and build output are ignored.
- Frontend production build passes.
- Backend clean Alembic upgrade passes; 12 tests pass with one dependency warning.
- Pyright checks all backend application and test modules with 0 errors/warnings.
- Oxlint has no errors and three non-blocking shadcn Fast Refresh warnings.

## Backend

FastAPI application version `0.6.0`, SQLAlchemy 2, Psycopg 3, PostgreSQL, and Alembic. Alembic is
the only production schema authority.

Implemented:

- Firebase identity verification and Google/email user synchronization.
- Six-digit email verification with expiry, throttling, attempt limits, and hashes.
- User profile, onboarding, photo, locale, currency, and timezone.
- Accounts, categories, transactions and balanced ledger postings.
- Goals/contributions, assets, budgets, recurring rules, and dashboard aggregation.
- Transaction idempotency and consistent JSON response envelopes.

Database state:

- Connected Supabase was upgraded to revision `20261020_0005` on 20 October 2026.
- Code and database head are both `20261020_0005`.
- Migration `0005` adds foreign-key ownership constraints from user-scoped
  financial tables to `users.id` with cascading cleanup.
- Railway must run `alembic upgrade head` as its pre-deploy command on every release.

## Frontend

React 19, TypeScript, Vite, Tailwind, shadcn-derived Base UI, React Router,
Firebase, date-fns, Lucide, and Recharts.

Implemented:

- Responsive authentication, verification, onboarding, protected routes, profile pictures.
- Public sample dashboard at `/demo`; authenticated screens do not insert samples.
- Database-backed dashboard, transactions, accounts, assets, categories,
  budgets, goals, and recurring commitments.
- Visual category icon picker with 22 Lucide options.
- Reports with 3/6/12-month cash flow, category share, daily spending, average,
  peak day, comparisons, net cash flow, and savings rate.
- Asset UX centered on original amount, exact age, days used, and cost per day.
- Settings, data export, security, sign-out, responsive navigation, and dark mode.

Important behavior:

- Assets and Accounts previously used `localStorage`; both now use authenticated APIs.
- Browser-only records are not automatically copied and may need re-entry once.
- Receipt scanning was removed from current scope/navigation.
- Notification toggles persist locally; scheduled delivery needs a backend worker.

## Services and deployment

- Firebase project `spendova-a6d20` has Google, web app, and Analytics configured.
- Supabase PostgreSQL remains the database.
- The monorepo is retained: Railway uses root `/backend`; Vercel uses root `frontend`.
- The Railway-ready Docker image builds successfully and listens on injected `PORT`.
- Railway backend and Vercel frontend deployment are not completed.
- Production requires `AUTH_REQUIRED=true`, managed secrets, exact CORS origins,
  Firebase authorized domains, and SMTP delivery.
