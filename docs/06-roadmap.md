# Roadmap

## Status (2026-10-28)

Done:

- [x] FastAPI app factory, settings that refuse unsafe production config, Alembic-only schema.
- [x] Firebase sign-in, email verification codes, forgot password by emailed code.
- [x] Per-user isolation on every table; verified-email requirement when auth is enforced.
- [x] Accounts with live balances, default/custom categories, balanced ledger, idempotent writes.
- [x] Monthly dashboard, reports, Excel statement export (now with a Loans & EMIs sheet), Excel import.
- [x] Budgets with category lines, goals and contributions, purchase planner.
- [x] Bills, expected income, and investment plans with “mark as paid”.
- [x] Assets with cost per day and replacement goals.
- [x] Loans and EMIs: EMI/rate/interest maths, schedules, graphs, pay EMI, dashboard summary.
- [x] Audit log, per-IP rate limiting, security headers.
- [x] Transactional email outbox with retries; branded Jinja templates with dark mode and previews.
- [x] Frontend restructure: `api/<feature>`, TanStack Query hooks, `components/common` and `layout`.
- [x] Docs in `docs/`, `CLAUDE.md`, and project skills in `.claude/skills/`.

## Next

1. **Finance assistant data:** a `GET /insights/snapshot` endpoint that returns one deterministic,
   privacy-reduced JSON of the user's position (see `12-loans-and-finance-assistant.md`), then the
   chat on top of it.
2. **EMI ledger split:** post principal as a transfer to a loan liability and interest/fees as
   expenses; link the loan to a `loan` account.
3. **Prepayment and foreclosure maths:** part-payment that reduces tenure or EMI, with savings shown.
4. **Credit cards:** statements, due dates, and bill payments as transfers.
5. **Notifications:** EMI and bill reminders through the outbox; the settings toggles are placeholders.
6. **Tests:** Vitest + Testing Library for forms and hooks, Playwright for sign-in → loan → pay EMI.
7. **Receipts/OCR** as editable drafts only.

## Later

Multi-currency transfers, household sharing, bank feeds, row-level security in PostgreSQL.
