# Spendova Backend Implementation Plan

## Current implementation status (2026-10-20)

- Completed: modular FastAPI routers and environment-based settings.
- Completed: SQLAlchemy/PostgreSQL foundation and initial Alembic migration.
- Completed: Firebase ID-token verification, Google sign-up/login profile persistence, profile updates, and logout contract with local development mode.
- Completed: per-user isolation for accounts, categories, transactions, goals, assets, and dashboard analytics.
- Completed: default/custom categories, balanced ledger postings, idempotency, asset cost-per-day, and monthly dashboard filters.
- Completed: monthly budgets and category allocations, live budget status, recurring money rules, and auditable goal contributions.
- Verified: three-migration upgrade/rollback chain and eleven automated tests.
- Next: account subtypes, receipt/OCR pipeline, background recurring projections, notifications, and expanded reporting.

## 1. Foundation and migrations

- FastAPI application factory, settings, structured logging, request IDs, and readiness endpoints.
- PostgreSQL in shared environments and SQLite only for isolated tests.
- Alembic as the only schema-change mechanism.
- Separate API, application/service, domain, and persistence layers.

Exit gate: a clean database migrates and starts in CI.

## 2. Identity and isolation

- Firebase Google sign-in and server-side ID-token verification.
- Create or link the internal user on first login.
- Scope every operation to `user_id`; add PostgreSQL row-level security as defense in depth.
- Add export, security events, and account deletion.

Exit gate: automated cross-user access tests prove isolation.

## 3. Financial core

- Accounts, categories, transactions, splits, transfers, refunds, reversals, and immutable ledger entries.
- Exact money representation, currencies, posting dates, and idempotency keys.
- Reconciliation and archival behavior.

Exit gate: every cleared transaction balances and all aggregates are rebuildable.

## 4. Planning and commitments

- Salary and bills, cards and payments, loans and EMI schedules, budgets, goals, and purchase scenarios.
- Move ownership-cost, replacement-pressure, and goal calculations into tested domain services.
- Frontend calculations remain previews; backend results are authoritative.

Exit gate: all documented financial edge cases pass.

## 5. Attachments and OCR

- Private object storage, signed URLs, file validation, scanning hook, and retention policy.
- Asynchronous OCR with editable drafts, receipt hashes, and duplicate warnings.

Exit gate: OCR cannot create a cleared transaction without confirmation.

## 6. Analytics, notifications, and AI

- Rebuildable dashboard aggregates and drill-down endpoints.
- Transactional outbox and workers for reminders and recurring projections.
- Gemini receives minimal derived facts and schema-validates results; it never calculates balances.

Exit gate: Spendova remains fully functional when Gemini is disabled.

## 7. Production readiness

- Rate limiting, audit events, secret management, backups, restore drills, observability, privacy retention, and security scanning.
- OpenAPI contract tests, load tests, and staged deployment.

Exit gate: security, recovery, performance, accessibility, and release checklists pass.
