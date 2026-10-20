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

A temporary Supabase password appeared in the previous chat. Rotate it before
production and before treating the repository as secure. After rotation, verify
that `alembic current` still returns `20261020_0003 (head)`.

## Authentication model

- Google sign-in is provided by Firebase Authentication.
- The frontend sends a Firebase ID token to FastAPI.
- FastAPI verifies the token and scopes every query to the token's user ID.
- Development-only identity headers must not be enabled in production.
- Production must set `AUTH_REQUIRED=true`.
