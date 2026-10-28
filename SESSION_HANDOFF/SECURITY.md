# Security and Secret Handling

## Never commit or paste

- `backend/.env`
- `DATABASE_URL`
- Supabase database password
- Supabase service-role key
- Firebase administrative credentials
- Gemini API key
- Cloud provider service-account JSON

## Safe to commit

- `.env.example` files containing placeholders only.
- Firebase public web configuration, although environment variables are still
  preferred for per-environment values.
- Database migrations without secrets or production data.

## Current warning

A temporary Supabase password appeared in an earlier chat. Rotate it before
production and before treating the repository as secure. After rotation, verify
that `alembic current` returns the repository head (`20261028_0014` as of
28 October 2026).

Backend settings default to development values, but with
`ENVIRONMENT=production` the API now refuses to start unless `AUTH_REQUIRED=true`,
`FIREBASE_PROJECT_ID` is set, `OTP_SECRET` and `DATA_ENCRYPTION_KEY` are 32+
random characters (not the defaults), and `EMAIL_DELIVERY_MODE=smtp`. Changing
`DATA_ENCRYPTION_KEY` makes unsent queued emails unreadable.

## Authentication model

- Google sign-in is provided by Firebase Authentication.
- The frontend sends a Firebase ID token to FastAPI.
- FastAPI verifies the token and scopes every query to the token's user ID.
- Development-only identity headers must not be enabled in production.
- Production must set `AUTH_REQUIRED=true`.
