# API specification

Base URL: `/api/v1` (health check at `/health`). Interactive docs at `/docs` outside production.
Every response uses the envelope in [02-architecture.md](./02-architecture.md#response-envelope).
Money is a decimal string; dates are `YYYY-MM-DD`. All routes except `/health`, `/auth/password-reset/*`
need a Firebase ID token; data routes also need a verified email when auth is enforced.

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
| GET / POST | `/categories` | List (first call seeds defaults) / create |
| PATCH / DELETE | `/categories/{id}` | Edit / archive |
| GET | `/transactions` | `limit` ≤ 200, `offset`, `from_date`, `to_date`, `account_id`, `category_id` |
| POST | `/transactions` | Create (Idem). Optional `recurring_rule_id` advances that bill |
| DELETE | `/transactions/{id}` | Void (keeps history) |
| GET | `/dashboard` | `year`, `month`, `account_id`: income, spending, cash flow, categories |

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
