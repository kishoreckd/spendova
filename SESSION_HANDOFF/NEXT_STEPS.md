# Ordered Next Steps

Updated: 21 October 2026 (Asia/Kolkata)

## 1. Release the 21 October work

- Review and commit the uncommitted changes.
- Deploy the backend first so Railway runs migrations through `20261021_0011`, then the frontend.
- On a real iPhone and Android phone, check: transaction sheet, date picker,
  toasts, asset goal, budget/bill/goal dialogs, category edit, Excel export.

## 1a. Configure email and password reset

- Railway secrets: `FIREBASE_SERVICE_ACCOUNT_JSON` (Firebase console → Project
  settings → Service accounts → Generate new private key, pasted as one line),
  `EMAIL_DELIVERY_MODE=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`,
  `SMTP_PASSWORD`, `EMAIL_FROM`, and `APP_URL` (the Vercel address).
- Use a sending provider with SPF/DKIM on a domain you own so codes avoid spam.
- Add per-IP rate limiting to the public reset endpoints (only per-email
  throttling exists today).

## 2. Production safety (before real users)

- Refuse to start when `ENVIRONMENT=production` unless `AUTH_REQUIRED=true`, the
  OTP secret is changed, and SMTP is configured. Today every setting defaults
  to development, which allows `X-User-Id` impersonation and logs OTP codes.
- Rotate the database password that appeared in an earlier chat.
- Handle concurrent requests: duplicate idempotency keys and the default-category
  insert in `GET /categories` can both raise 500s.
- Validate `year`/`month` on `/dashboard`; compute "today" in the user's time zone.
- Run backend tests against PostgreSQL in CI (SQLite ignores foreign keys).

## 3. Finance model

- Transaction edit and void in the UI; transaction table with filters and
  pagination on desktop.
- Budget and commitment editing; recurring worker.
- Goal target dates instead of month counts.
- Credit card statements, amortization schedules, investment valuations, splits, refunds.

## 4. Notifications and privacy

- Persist notification preferences in PostgreSQL; outbox + reminder worker.
- Account deletion and a server-side versioned export.

## 5. Release hardening

- Frontend component and end-to-end tests for money workflows.
- Rate limiting, request IDs, monitoring, backup/restore rehearsal.
- Dependency scanning and protected-branch rules.
