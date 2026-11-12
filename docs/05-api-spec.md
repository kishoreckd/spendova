# API specification

Base URL: `/api/v1` (health check at `/health`). Interactive docs at `/api/docs` and `/docs`;
production access requires explicit protected-docs configuration (see below).
Every response uses the envelope in [02-architecture.md](./02-architecture.md#response-envelope).
Money is a decimal string; dates are `YYYY-MM-DD`. All routes except `/health`, `/auth/password-reset/*`
need a Spendova access token; data routes also need a verified email when auth is enforced.

`Idem` = send an `Idempotency-Key` header; a repeat with the same key returns the original result.

## Authentication and profile

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/google` | Create or update the profile after any Firebase sign-in |
| GET / PATCH | `/auth/me` | Read or update profile (currency, locale, time zone, onboarding) |
| POST | `/auth/verification/send` | Email a 6-digit verification code (rate limited) |
| POST | `/auth/verification/confirm` | Confirm the code, marks the email verified |
| POST | `/auth/logout` | 204; the client signs out of Firebase |
| POST | `/auth/password-reset/request` | Email a reset code (no account enumeration) |
| POST | `/auth/password-reset/verify` | Exchange email + code for a short-lived reset token |
| POST | `/auth/password-reset/complete` | Set the new password through Firebase Admin |

## Money

| Method | Path | Purpose |
|---|---|---|
| GET / POST | `/accounts` | List (with `current_balance`) / create |
| DELETE | `/accounts/{id}` | Archive |
| GET / POST | `/categories` | List (first call seeds defaults; optional `include_archived=true` for history) / create |
| PATCH / DELETE | `/categories/{id}` | Edit / archive |
| GET | `/transactions` | `limit` ≤ 200, `offset`, `from_date`, `to_date`, `account_id`, `category_id`, literal case-insensitive `search`, `kind`, `status`, `currency` |
| POST | `/transactions` | Create (Idem). Optional `recurring_rule_id` advances that bill |
| DELETE | `/transactions/{id}` | Void (keeps history) |
| GET | `/dashboard` | `year`, `month`, `account_id`, `currency`: income, spending, cash flow, categories |

## Planning

| Method | Path | Purpose |
|---|---|---|
| GET / POST | `/recurring-rules` | Bills, expected income, investment plans |
| POST | `/recurring-rules/{id}/pay` | Record this occurrence as a transaction and schedule the next (Idem) |
| DELETE | `/recurring-rules/{id}` | Stop |
| GET / POST | `/budgets` | Monthly budgets with category lines |
| GET | `/budgets/{id}/status` | Spent and remaining per line |
| DELETE | `/budgets/{id}` | Delete |
| GET / POST | `/goals` | Savings goals with monthly amount required |
| POST | `/goals/{id}/contributions` | Add money to a goal |
| DELETE | `/goals/{id}` | Delete |
| GET / POST | `/assets` | Owned items with cost per day and replacement goal |
| PATCH / DELETE | `/assets/{id}` | Edit / archive |

## Loans and EMIs

| Method | Path | Purpose |
|---|---|---|
| GET | `/loans` | Active loans with full summary; `include_closed=true` adds closed ones |
| GET | `/loans/overview` | Monthly EMI total, owed, interest left, due/ending this month, debt-free date, EMI-to-income % |
| POST | `/loans/preview` | Summary + schedule for unsaved terms (live form preview) |
| POST | `/loans` | Create. Needs `annual_interest_rate`, `emi_amount`, or both |
| GET | `/loans/{id}/schedule` | Every EMI: due date, interest, principal, balance, paid |
| POST | `/loans/{id}/payments` | Pay the next EMI as an expense from the paying account (Idem) |
| POST | `/loans/{id}/close` | Close (e.g. foreclosure) and stop the reminder |

Loan terms: `principal`, `tenure_months` (1–480), `first_due_on`, `processing_fee`, and the rate
and/or EMI. With only the EMI, the effective annual rate is solved for and
`summary.rate_is_estimated` is true. `installments_paid_before` defaults to EMIs due before today.

## Operations (outside `/api/v1`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness, database reachability, whether email is configured |
| GET | `/health/email` | SMTP connect + login check, no email sent |
| POST | `/health/email` | Send one test email; header `X-Email-Test-Key`, body `{email, message?}`; 1/minute |
| GET | `/cron/email-outbox` | Retry due emails; `Authorization: Bearer <CRON_SECRET>` (Vercel Cron) |

## Audit

| Method | Path | Purpose |
|---|---|---|
| GET | `/audit` | Your own activity log, newest first; `limit`, `cursor` |

## Finance assistant

`GET /api/v1/insights/snapshot` and `POST /api/v1/insights/chat` are authenticated, read-only.
See `12-loans-and-finance-assistant.md` for contracts, privacy and configuration.

## Preferences and AI quota

`GET /api/v1/preferences` returns daily_token_limit, max_daily_tokens, tokens_used,
tokens_remaining, resets_at, reset_timezone, ai_available, and the email opt-ins bills,
deposits, budgets and weekly. Authenticated verified user only.
`PUT /api/v1/preferences` accepts daily_token_limit and all four boolean preferences. Unknown
fields are rejected, server maximum enforced, changes audited. 0 pauses AI without blocking local
calculators. `POST /insights/chat` returns 429 with code AI_DAILY_LIMIT when a reservation would
exceed the user's allowance. Network/provider errors return generic 503; reservations may remain.
Account reads include deposit_projection (contributed, estimated_maturity, estimated_interest,
basis). A missing interest rate gives null estimates. The assistant snapshot includes anonymous
deposit projections; the optional project_deposit tool calculates unsaved FD/RD terms.
## Swagger contract

Interactive docs: `/api/docs` and `/docs`; OpenAPI JSON: `/api/openapi.json` and `/openapi.json`;
ReDoc: `/redoc`. The JSON schema remains a standard OpenAPI document, without the API envelope.
All documented JSON API responses include `status`, `message`, and `data`; errors use the shared
`ApiErrorEnvelope` schema, request validation returns 400, and 204 responses remain bodyless.
The SessionBearer security scheme enables Swagger's Authorize button. Optional documentation
login/logout endpoints `/api/docs/login` and `/api/docs/logout` are deliberately excluded from
the public schema. See `02-architecture.md` for configuration and session behavior.

## Local authentication

- `POST /auth/register`: `{name,email,password}` ? 201 with `{access_token,expires_in_seconds,account,development_code}`.
- `POST /auth/login`: `{email,password}` ? the same account/session payload (200).
- `POST /auth/refresh`: rotates the HttpOnly refresh cookie ? `{access_token,expires_in_seconds}`.
- `POST /auth/logout`: revokes the browser session and expires its cookie (204).
- `/auth/verification/send`, `/auth/verification/confirm` and `/auth/password-reset/*` retain their
  existing contracts and deliver codes through the outbox (Brevo in production, Mailpit locally).
- Protected routes validate both the signed access token and its current, unexpired database session.
  Verified email remains required for financial routes. The old `/auth/google` is omitted from
  Swagger and rejected when authentication is enforced; it remains only for development test fixtures.
