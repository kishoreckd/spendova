# Spendova Frontend

React 19, TypeScript, Vite, Tailwind CSS 4, shadcn (Base UI), TanStack Query,
database-backed authentication, and Recharts frontend for the Spendova personal-finance
application. Structure: `src/api/<feature>` (typed calls), `src/features/<feature>`
(pages, dialogs, query hooks), `src/components/common|layout|ui`. See
[`../docs/02-architecture.md`](../docs/02-architecture.md#frontend).

## Local development

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:5173`.

## Environment variables

Set these in `.env.local` for development and in the hosting provider's
environment-variable settings for production:

```text
VITE_API_BASE_PATH=/api/v1
BACKEND_URL=http://127.0.0.1:8000
```

Passwords are verified by the Spendova API against scrypt hashes in PostgreSQL. Access tokens
stay in memory; the server stores a hashed, rotating refresh token and issues an HttpOnly cookie.
Firebase configuration is no longer needed. Never put SMTP credentials or session-signing keys
in a `VITE_` variable.

## Deployment

Deploy this repository to Vercel. For Vercel:

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- `BACKEND_URL`: `https://<your-backend-project>.vercel.app`
- `VITE_API_BASE_PATH`: `/api/v1`

`vercel.ts` validates the backend origin, proxies same-origin `/api` requests, adds security
headers, and provides the SPA fallback required for routes such as `/reports` and `/settings`.
Changing `BACKEND_URL` and redeploying switches the API without rebuilding source code. Add the
deployed frontend origin to the backend's `CORS_ORIGINS` and `APP_URL` values.

## Verification

```powershell
npm run check          # prettier, oxlint, Vitest, TypeScript, production build
npm run test:browser   # desktop/mobile Edge; isolated port 5174, mocked auth/API
```

## Docker local stack

The browser test server uses `playwright.vite.config.ts` and test-only aliases; the normal build
and local port 5173 always use database-backed authentication. Browser tests cover historical
transaction search/pagination, confirmed voiding, report currencies, mobile overflow and Excel
preview-before-import. Unit tests cover profile races/retry, partial import recovery with stable
idempotency keys, cancellation, report boundaries and transaction form validation.

Transactions use server-side filtering and 50-row pages. Dashboard/report summaries are scoped
to the selected currency. Archived category names remain available in historical reports.
Excel imports require preview confirmation, validate account/currency matches, preserve decimal
strings, and retain failed/unprocessed rows for retry; completed rows refresh the ledger cache.

From the repository root run `docker compose up -d --build --wait`. The Node 24 development
container uses `frontend/.env.local` at runtime and serves http://localhost:5173. Rebuild after
source changes. No environment files are copied into the image. See the root README.
