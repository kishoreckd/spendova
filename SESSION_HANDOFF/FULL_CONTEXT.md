# Spendova Full Project Context

Updated: 20 October 2026 (Asia/Kolkata)

This is the sanitized master context for continuing the project in a new
session. It preserves requirements, decisions, implementation history, user
preferences, corrections, and unresolved work. Passwords, API keys, and full
connection strings are deliberately excluded.

## 1. Original product vision

The user wants a personal, mobile-first application that goes beyond a basic
expense tracker. It should help answer:

- Where did my money go this month or year?
- How much is safe to spend after bills, debt, and planned savings?
- How much must I save per day, week, and month for a future purchase?
- How long have I owned an important product, and what has it cost per day?
- Is replacing a product reasonable, based on age, condition, support, current
  finances, and alternatives?
- How much is committed to salary-related planning, subscriptions, cloud
  services, insurance, loans, EMIs, cards, and investments?

The application is personal/single-user for the first release. Family sharing
may be considered later but must not distort the current data model or UI.

## 2. Confirmed product requirements

### Locale and currency

- Country, locale, timezone, and primary currency come from user onboarding.
- The UI and calculations must adapt to those settings.
- INR is only a development/demo default, not a permanent product assumption.
- Preserve currency codes on accounts and transactions for future multi-currency
  support.

### Income and account balances

- Users may enter monthly or annual salary.
- Salary must distinguish gross versus take-home, frequency, expected pay date,
  and destination account.
- Expected salary is projected income, not actual income.
- Account balance is derived from opening balance plus cleared financial
  activity; salary itself is not an account balance.

### Transactions

- Manual transaction entry is the first-release primary workflow.
- Expense, income, and transfer are distinct types.
- Transfers must not be counted as spending or income.
- Credit-card purchases are expenses; card bill payments are transfers and must
  not double-count spending.
- Loan disbursement is a liability/account movement, not income.
- EMI payments should separate principal, interest, and fees when available.
- Investment contributions are transfers; investment fees remain expenses.
- Refunds and reversals need explicit, auditable handling.
- Monetary values use Decimal/fixed precision, never binary floating point.
- Cleared postings must balance.
- Idempotency prevents duplicate writes.

### Categories

- Provide useful default income and expense categories.
- Users can add, edit, archive, recolor, and assign icons to categories.
- Categories may have monthly budget limits.
- Every user-owned category is isolated by user ID.

### Accounts, debt, and investments

- Include cash, banks, credit cards, loans, EMIs, and investments.
- Users can add multiple cards and accounts.
- First release must show monthly commitments and spending implications.
- Account subtypes require richer backend implementation than currently exists.

### Receipt OCR

- Users can photograph or upload receipts/bills.
- OCR creates an editable draft only.
- OCR must never automatically create a cleared transaction.
- Low-confidence and mathematically inconsistent values must be highlighted.
- CSV and direct bank integrations are postponed.

### Owned assets

- Assets are manually managed by the user with name, type, purchase date,
  purchase price, currency, notes, and status.
- Show age and purchase cost per day.
- Do not force subscriptions, insurance, repairs, or other ownership costs into
  the asset record; those are ordinary expenses/categories.
- Replacement assessment is decision support, not an instruction to buy.
- The user explicitly removed the earlier “true ownership cost” emphasis from
  the asset page.

### Purchase and savings planning

- A user can define a future purchase such as a car or phone.
- Calculate remaining amount and required daily, weekly, and monthly savings.
- Account for money already saved and the target date.
- Goal contributions must be auditable and update projections.
- The current backend still models some goals by `months`; target-date support
  remains an important enhancement.

### Analytics and charts

- Reports need month, year, and arbitrary date ranges.
- Dashboard should show income, spending, cash flow, available-to-spend, budget
  health, recent transactions, and category breakdowns.
- Useful charts include cash-flow trends, category spending, budget versus
  actual, goal progress, recurring commitments, and net worth/account trends.
- Avoid filling the dashboard with decorative or redundant charts.
- Charts need tooltips/hover behavior on desktop and touch-compatible behavior
  on mobile.

### Gemini

- Gemini is optional and must be called only from the backend.
- Gemini receives minimized derived facts rather than raw sensitive financial
  history whenever possible.
- Gemini may explain patterns and produce suggestions, but deterministic code is
  authoritative for balances, budgets, and projections.
- The product must remain fully usable when Gemini is unavailable.

## 3. Authentication decisions

- Google login is sufficient for the first release.
- Phone OTP and traditional forgot-password flows were removed from first-release
  scope after clarification.
- Firebase Authentication is the selected identity provider.
- One Google flow acts as sign-up for a new identity and login for a returning
  identity.
- React obtains a Firebase ID token and sends it to FastAPI using a Bearer header.
- FastAPI verifies the token and scopes every private query to the token user ID.
- Development currently allows a local identity header when `AUTH_REQUIRED` is
  false. Production must set `AUTH_REQUIRED=true`.
- Firebase is integrated into React for Google and email/password authentication.
- Google identities are already verified by Firebase and do not enter the custom
  email-code screen. Email/password sign-up uses the FastAPI verification-code flow.
- Google profile name, email, UID, and photo URL are synchronized to PostgreSQL.

## 4. Naming and brand history

Names considered included PocketPlan, Spendova, Monevo, and other money-oriented
variants. The final name is **Spendova**.

Brand exploration included:

- Flowing S path.
- Modular data ribbon.
- Dollar/S concepts.
- Midnight/aqua and indigo/violet palettes.

The accepted direction is based on:

```text
assets/brand/spendova-refinements/01-flowing-s-midnight-aqua.png
```

Final assets exist under `assets/brand/spendova-final/` and are copied into
`frontend/public/brand/`. They include:

- Full light and dark logos.
- Icon-only light and dark assets.
- Master icon.
- Favicons.
- Apple touch icon.
- Light, dark, and neutral PWA icons.

The icon-only S represents the brand on mobile and compact surfaces. The wordmark
is used when space permits.

## 5. UI and UX direction

- Mobile-first, but equally usable on desktop.
- shadcn-style components are the component-system reference.
- React, TypeScript, Tailwind CSS, Lucide icons, and Recharts are used.
- Desktop uses a sidebar; mobile uses bottom navigation.
- The active route must be visibly tracked.
- Profile access appears in the header.
- Loading uses skeleton/shimmer states.
- Animations should be polished, restrained, and respect reduced-motion settings.
- Interactions should feel appropriate on both iOS and Android.
- The mobile bottom navigation is sufficient for primary sections; secondary
  destinations live under More.
- The application must not be one giant component or one rendered page. Routes
  and feature pages are split under `frontend/src/features/`.

Mobile improvements already completed include:

- 44px mobile touch targets.
- Top and bottom safe-area support.
- Dynamic viewport-height dialogs and bottom sheets.
- Narrow form layouts below 400px.
- Mobile chart sizing.
- Horizontal overflow protection.
- Accessible icon-button labels.
- Responsive sign-in/onboarding layouts.
- Reduced-motion handling.

Real iPhone Safari and Android Chrome QA is still required before release.

## 6. Repository and code organization decisions

Use one monorepo. One repository does not mean one deployment.

Current structure:

```text
expense/
├── frontend/                 React/Vite application
├── backend/                  FastAPI application
├── assets/                   source brand assets
├── SESSION_HANDOFF/          continuation context
├── compose.yaml
├── PRODUCT_PLAN.md
├── UI_UX_PLAN.md
├── DATABASE_SCHEMA.md
├── FINANCIAL_RULES.md
└── other engineering docs
```

The frontend and backend maintain separate dependencies, environment variables,
tests, builds, and deployments.

The active filesystem path is:

```text
C:\Users\CXO\OneDrive - CXOntology Inc\expense
```

The obsolete path `C:\Users\CXO\Music\expense` does not exist, although some
tool tracebacks may display cached source paths.

The local folder currently has no `.git` directory. The user identified the
intended GitHub repository as `kishoreckd/spendova`, but repository initialization
or reconnection is still required.

## 7. Frontend implementation history

The frontend was initially perceived as a single-page implementation. It was
subsequently divided into router-driven feature pages:

- Dashboard.
- Transactions.
- Planning.
- Reports.
- More.
- Accounts.
- Assets.
- Categories.
- Receipts.
- Settings.
- Profile.
- Sign-in and onboarding.

Shared application shell, navigation, UI primitives, transaction sheet, loading
screen, profile component, account page, and purchase calculator exist.

The frontend currently passes formatting, lint/build/type checks, with three
non-blocking shadcn Fast Refresh warnings. Most pages still use mock data. Only
transaction creation has an initial API helper. React Query is installed but the
full authenticated data layer is not implemented.

## 8. Backend reference project analysis

The user provided this prior FastAPI project as an architectural reference:

```text
C:\Users\CXO\Downloads\org-chart-backend-master (1)\org-chart-backend-master
```

Useful concepts taken from it:

- Separate routes, schemas, services, configuration, and auth utilities.
- Google login flow.
- Environment-driven configuration.

Problems deliberately not copied:

- MongoDB for a relational financial domain.
- Wildcard CORS.
- New database client construction per request.
- Duplicated models.
- Logging raw access/share tokens.
- Weak ownership isolation.
- Non-expiring share tokens.
- Large route modules and embedded persistence logic.
- Lack of migrations and meaningful automated tests.

Spendova therefore uses PostgreSQL, SQLAlchemy, Alembic, explicit user scoping,
and modular FastAPI routers.

## 9. Backend implementation history

The first backend baseline contained accounts, transactions, double-entry ledger
entries, goals, dashboard totals, a Dockerfile, and five tests.

It was refactored and expanded into:

- `app/config.py`: Pydantic settings and environment parsing.
- `app/auth.py`: Firebase ID-token verification and development identity.
- `app/database.py`: SQLAlchemy engine and sessions.
- `app/models.py`: persisted entities.
- `app/schemas.py`: API validation/read models.
- `app/domain.py`: financial domain calculations.
- `app/api/`: modular routers.

Implemented routers:

- `auth.py`
- `accounts.py`
- `categories.py`
- `transactions.py`
- `goals.py`
- `assets.py`
- `budgets.py`
- `recurring.py`
- `dashboard.py`

Implemented migrations:

- `20261018_0001_initial_core.py`
- `20261018_0002_users.py`
- `20261020_0003_planning.py`
- `20261020_0004_email_verification.py`
- `20261020_0005_user_ownership.py`

The connected database and repository migration head are both
`20261020_0005`. Railway must retain `alembic upgrade head` as a pre-deploy step.

Backend tests currently pass: 12 tests when executed from `backend/`.

## 10. Database decision and connection history

PostgreSQL was selected because financial records need relational constraints,
transactions, joins, aggregates, migrations, reporting, and ledger consistency.

Supabase PostgreSQL is currently connected. The connection uses Psycopg 3 and a
Supabase pooler. Pydantic configuration now:

- Accepts comma-separated `CORS_ORIGINS` without requiring JSON syntax.
- Automatically upgrades a copied `postgresql://` URI to
  `postgresql+psycopg://`.

Connection troubleshooting history:

1. `CORS_ORIGINS` initially failed because Pydantic attempted JSON decoding
   before the validator. `NoDecode` was added.
2. The generic PostgreSQL URI was normalized to the Psycopg dialect.
3. Special characters in the temporary password caused part of the password to
   be parsed as the hostname. Percent encoding fixed the URL.
4. The Session Pooler host resolved successfully.
5. Alembic reported the Supabase database at migration head.

Never copy the actual URL or password into handoff files, source code, or chat.

## 11. Supabase/GitHub integration decision

The user explored installing Supabase's GitHub application. It was intentionally
avoided for now because:

- Spendova already uses Alembic as its migration source of truth.
- Supabase's native GitHub integration expects `supabase/migrations`.
- Maintaining both would create competing migration histories.
- Automatic PR preview databases require additional workflow/cost considerations.

Supabase is used as hosted PostgreSQL only. FastAPI connects through
`DATABASE_URL`. Alembic performs schema changes.

## 12. Hosting and deployment decisions

Recommended production topology:

```text
Vercel
  frontend root: frontend/
  framework: Vite
  build: npm run build
  output: dist
  VITE_API_URL: Railway API URL + /api/v1

Railway
  backend root: backend/
  builds backend/Dockerfile
  pre-deploy: alembic upgrade head
  healthcheck: /health
  secrets/environment configured outside Git

Supabase
  PostgreSQL database

Firebase
  Google Authentication
```

Vercel can deploy only `frontend/` from the monorepo by setting the Root
Directory. React Router requires an SPA rewrite to `index.html`; add or verify
`frontend/vercel.json` before deployment.

Railway is the selected Python hosting platform. The monorepo remains the source
of truth: Railway uses `/backend`, while Vercel uses `frontend`. Separate
repositories were considered but rejected because deployments can remain
independent without losing atomic full-stack changes. Firestore is not
recommended for this relational finance model. Keep Supabase PostgreSQL unless
cost or requirements change materially.

## 13. Environment-variable policy

Stable defaults may remain in Python:

- Application name.
- Application version.
- Safe local-development defaults.

Environment-specific values belong in `backend/.env` locally and deployment
secrets remotely:

- Environment name.
- Database URL.
- CORS origins.
- Authentication-required flag.
- Firebase project ID.
- Gemini key and future provider secrets.

Rules:

- Commit `.env.example`, never `.env`.
- Never put server secrets in `VITE_*` variables.
- Only browser-safe configuration belongs in frontend Vite variables.
- Rotate the temporary Supabase password before production because it appeared
  in chat.

## 14. Current gaps and unfinished scope

### Critical integration gaps

- Firebase Google authentication is implemented but still needs one interactive
  browser verification with a real Google account.
- Firebase email/password screens and the backend six-digit email verification
  flow are implemented. Firebase Email/Password must be enabled in the console,
  and SMTP must be configured before codes are delivered to real inboxes.
- Authenticated dashboard, transactions, accounts, assets, categories, budgets,
  goals, recurring commitments, and report calculations are API-backed.
- `/demo` is the only intended sample-data experience.
- A shared authenticated fetch client exists; React Query integration is still
  pending.
- Edit CRUD is incomplete for several resources, and loading/error behavior still
  needs automated browser coverage.

### Backend domain gaps

- Credit-card detail and statement tables/endpoints.
- Loans and EMI schedules.
- Investment valuations.
- Transaction splits, refunds, and explicit reversal records.
- Recurring occurrence worker/materialization.
- Rich target-date purchase scenarios.
- Notification/outbox processing.
- Server-side large export and account deletion. A client-side data export exists.
- Audit-event persistence.

### OCR/AI gaps

- Private receipt storage.
- OCR job processing and editable drafts.
- Duplicate receipt detection.
- Gemini schema validation, privacy minimization, and feedback.

### Production gaps

- Configure branch protection and required CI checks.
- Railway deployment.
- Vercel deployment.
- Firebase production settings.
- Rate limiting, structured request IDs, monitoring, backups, and restore drill.
- Full end-to-end and real-device QA.

## 15. User collaboration preferences inferred from the project

- The user prefers implementation over prolonged planning once a direction is
  selected.
- They repeatedly ask for deeper analysis and confirmation that the work follows
  industry standards.
- They care strongly about mobile responsiveness and polished UI behavior.
- They prefer shadcn components and reusable shared components.
- They do not want all logic or screens placed in one file.
- They expect the assistant to verify work with builds/tests rather than merely
  claiming completion.
- Completion status must be reported honestly; do not call the whole product
  finished while mocks and integrations remain.

## 16. Resume protocol

At the start of a new session:

1. Switch to the active OneDrive repository path.
2. Read all files in `SESSION_HANDOFF/`.
3. Read the relevant source-of-truth product/engineering documents.
4. Do not read or print `backend/.env`.
5. Run backend tests from `backend/`.
6. Run frontend `npm run check`.
7. Confirm Alembic revision without printing the database URL.
8. Apply migration 0005, verify real browser workflows, and follow NEXT_STEPS.md
   unless the user changes priority.
9. Update this handoff after material implementation changes.

## 17. Latest implementation and repository history

On 20 October 2026:

- The monorepo was initialized and pushed to
  `https://github.com/kishoreckd/spendova.git` on `main`.
- Commit `61b2990` is the first verified full-project snapshot.
- GitHub Actions CI was added for frontend lint/build and backend migrations/tests.
- A secret/staged-file audit confirmed local environment files, databases,
  dependencies, and build output were not committed.
- Assets and Accounts were migrated from `localStorage` to authenticated FastAPI
  endpoints and PostgreSQL tables.
- Migration `20261020_0005_user_ownership.py` added user foreign keys.
- Categories received a visual Lucide icon picker and UUID/name display was fixed.
- Reports were replaced with decision-oriented cash-flow, category, and daily
  spending analytics using cleared transactions; transfers are excluded.
- Asset calculation is purchase price divided by actual days owned. The page was
  redesigned to prioritize this daily value with compact, responsive summaries.
- Future asset purchase dates are rejected in both the browser and backend.
- Search-icon overlap was corrected, and the receipt scanner was removed from
  current navigation and transaction entry.
- Backend static analysis is configured in `backend/pyrightconfig.json` and CI.
  SQLAlchemy result typing, a nullable budget aggregate, response-header types,
  and exception-handler signatures were corrected. Pyright reports 0 errors and
  0 warnings across `app/` and `tests/`.
- The Supabase database was upgraded to Alembic revision `20261020_0005`.
- Railway deployment support was added to the backend Dockerfile: migrations
  are included in the image and Uvicorn binds to Railway's injected `PORT`.
- The monorepo deployment layout was retained. Railway must use `/backend`, and
  Vercel must use `frontend`; `frontend/vercel.json` supplies SPA rewrites.
