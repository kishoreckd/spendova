# Email delivery

## Emails sent

| Email | Template | Sent when |
|---|---|---|
| Verify your email | `verify_email.html` | Email/password sign-up, or “resend code” |
| Reset your password | `forgot_password.html` | `POST /auth/password-reset/request` for an existing password account |
| You sign in with Google | `google_account.html` | A reset is requested for a Google-only account |
| Password changed | `password_changed.html` | A reset completes |

Templates live in `backend/app/utils/templates/emails/` and extend `layout.html`, which carries
the brand header (inline CID logo), footer, and `dark_styles.css` for clients that honour
`prefers-color-scheme`. Every email has a plain-text part. Builders in
`services/email_templates.py` return an `EmailContent`; `render()` produces subject, text, and HTML.
Colours come from `constants/email.py` (`THEME`, `DARK_THEME`).

Preview all templates, light and dark: `python scripts/preview_emails.py` → `app/email_previews/index.html`.

## Delivery pipeline (transactional outbox)

1. `services/notifications_service.py` builds the email and calls `email_outbox_service.enqueue(db, ...)`
   in the **same database transaction** as the change it belongs to (code issued, password changed).
   The body is sealed with AES-GCM (`DATA_ENCRYPTION_KEY`) at rest.
2. After the router commits, a FastAPI background task calls `deliver(outbox_id)`.
3. If sending fails, retries use exponential backoff up to `EMAIL_OUTBOX_MAX_ATTEMPTS`:
   - locally (a long-running server) the worker loop `run_loop` checks every `EMAIL_OUTBOX_POLL_SECONDS`;
   - on Vercel (serverless, `VERCEL=1`) there is no loop; Vercel Cron calls
     `GET /cron/email-outbox` with `Authorization: Bearer <CRON_SECRET>` (schedule in `backend/vercel.json`).
   Expired codes are not sent late.
4. Once sent, failed for good, or expired, the sealed body is wiped; only metadata stays.

## Environments (same SMTP path everywhere, like Vaultessa)

| Where | Template | SMTP | Read the mail |
|---|---|---|---|
| Local | `backend/.env.example` | Mailpit `127.0.0.1:1026`, no auth, no TLS (`docker compose up -d mailpit`) | http://127.0.0.1:8026 |
| Production (Vercel) | `backend/.env.production.example` | Brevo `smtp-relay.brevo.com:587`, STARTTLS, SMTP login + SMTP key, verified sender | Real inboxes |

- `EMAIL_DELIVERY_MODE=console` is still available locally without Docker: messages print in the
  backend terminal and the API returns `development_code` so the UI can show it.
- Production refuses to start without `EMAIL_DELIVERY_MODE=smtp`, `SMTP_HOST`, `SMTP_USERNAME`,
  `SMTP_PASSWORD`, and `EMAIL_FROM`.
- `SMTP_PASSWORD` is the provider's SMTP key (Brevo) or a Google App Password (Gmail) — never a
  normal account password, and never pasted into chat or committed.

## Checking delivery

- `GET /health/email` — connects, upgrades to TLS, and logs in without sending (cached 60 s).
- `POST /health/email` with `X-Email-Test-Key: <EMAIL_TEST_API_KEY>` (32+ characters, separate from
  the SMTP password) and `{"email": "you@example.com"}` — sends one labelled test email through
  the outbox, at most one per minute.

## Security

- Codes are 6 digits, stored only as HMAC digests (`OTP_SECRET`), with attempt limits and expiry.
- Reset requests never reveal whether an account exists.
- `/auth/verification/*` and `/auth/password-reset/*` use the stricter per-IP auth rate limit.
