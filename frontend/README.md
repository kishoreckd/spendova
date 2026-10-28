# Spendova Frontend

React 19, TypeScript, Vite, Tailwind CSS 4, shadcn (Base UI), TanStack Query,
Firebase Authentication, and Recharts frontend for the Spendova personal-finance
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
VITE_API_URL=http://localhost:8000/api/v1
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

Firebase's browser configuration is expected to be visible to the browser;
security comes from Firebase Authentication, authorized domains, backend token
verification, and database authorization. Never put database credentials,
Firebase Admin credentials, SMTP passwords, or other server secrets in a
`VITE_` variable.

## Deployment

Deploy this repository to Vercel or Firebase Hosting. For Vercel:

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- `VITE_API_URL`: `https://<your-backend-project>.vercel.app/api/v1`

`vercel.json` provides the SPA fallback required for routes such as `/reports`
and `/settings`. Add the deployed frontend hostname to Firebase Authentication's
authorized domains and to the backend's `CORS_ORIGINS` value.

## Verification

```powershell
npm run check   # prettier, oxlint, TypeScript, production build
```
