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
that `alembic current` returns the repository head (`20261020_0006` as of
21 October 2026).

All backend settings default to development values. A production deployment
must set `ENVIRONMENT=production`, `AUTH_REQUIRED=true`, a long random
`OTP_SECRET`, and `EMAIL_DELIVERY_MODE=smtp` with SMTP credentials; otherwise any
caller can act as any user through `X-User-Id`, and verification codes are
printed to logs.

## Authentication model

- Google sign-in is provided by Firebase Authentication.
- The frontend sends a Firebase ID token to FastAPI.
- FastAPI verifies the token and scopes every query to the token's user ID.
- Development-only identity headers must not be enabled in production.
- Production must set `AUTH_REQUIRED=true`.
