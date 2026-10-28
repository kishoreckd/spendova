# Database Schema

> Sections 1–18 describe the **target** model. What exists today is listed first.

## 0. Implemented schema (migration head `20261028_0014`)

One SQLAlchemy model per file in `backend/app/db/models/`; migrations in `backend/migrations/versions/`.

| Table | Purpose | Migration |
|---|---|---|
| `users` | Profile keyed by Firebase uid; currency, locale, time zone, onboarding, email verified | 0002, 0004 |
| `email_verification_codes`, `password_reset_codes` | Hashed one-time codes with attempt counts and expiry | 0004, 0007 |
| `accounts` | Bank, card, cash, investment, loan, FD, RD; opening balance and deposit terms | 0001, 0010 |
| `categories` | Default and custom, expense/income, icon, colour, monthly budget | 0001, 0005 |
| `transactions`, `ledger_entries` | Balanced postings; idempotency key; optional recurring rule link; account ids | 0001, 0009, 0011 |
| `recurring_rules` | Bills, expected income, investment plans; plan type, next due | 0003, 0008 |
| `budgets`, `budget_lines` | Monthly limits by category | 0003 |
| `goals`, `goal_contributions` | Savings goals and money added | 0003 |
| `assets` | Owned items, expected life or target cost per day | 0001, 0006 |
| `audit_logs` | Who changed what, with non-sensitive metadata (column `metadata`) | 0012 |
| `email_outbox` | Queued emails, sealed bodies, attempts, next retry, outcome | 0013 |
| `loans` | Loan/EMI terms, type, lender, paying account, linked asset and bill, status | 0014 |

Every user-owned table has `user_id` with a foreign key to `users`. SQLite enforces foreign keys
(tests and local), matching PostgreSQL.

## 1. Design goals

- PostgreSQL is the source of truth for financial data.
- Financial postings are auditable and ledger-balanced.
- Firebase supplies identity; the application database owns profiles and domain authorization.
- User ownership is explicit on every private aggregate.
- UUID primary keys avoid sequential identifier leakage.
- Soft deletion or archival preserves referenced history.
- Derived summaries can be rebuilt from immutable source records.

## 2. Shared conventions

Unless noted, tables include:

- `id uuid primary key`;
- `user_id uuid not null` for user-owned roots;
- `created_at timestamptz not null`;
- `updated_at timestamptz not null`;
- optional `deleted_at timestamptz` only where soft deletion is valid;
- `version integer not null default 1` for optimistic concurrency on mutable aggregates.

Money uses `numeric(20, 6)` plus `currency_code char(3)`. Enumerations should use constrained text or reference tables so deployments can evolve without unsafe database-enum migrations.

All foreign keys require an intentional delete action. Financial history generally uses `restrict`; disposable drafts/children may use `cascade`.

## 3. Identity and preferences

### `users`

- `firebase_uid text unique not null`;
- `email text`;
- `display_name text`;
- `photo_url text`;
- `status text not null` (`active`, `disabled`, `deletion_pending`);
- `last_login_at timestamptz`.

### `user_preferences`

- `user_id uuid primary key references users`;
- `country_code char(2)`;
- `locale text not null`;
- `time_zone text not null`;
- `base_currency char(3) not null`;
- `theme text not null`;
- `week_starts_on smallint`;
- `fiscal_year_start_month smallint`;
- `emergency_fund_floor numeric(20, 6)`;
- `ai_enabled boolean not null default false`;
- `ocr_enabled boolean not null default false`.

Constraints validate month/day values, supported currency, and non-negative reserve.

### `consent_events`

- `user_id`;
- `consent_type text`;
- `policy_version text`;
- `granted boolean`;
- `occurred_at timestamptz`;
- `context jsonb` containing non-secret UI/client metadata.

Consent is event history, not a mutable boolean alone.

## 4. Accounts

### `accounts`

- `user_id`;
- `account_type text not null`;
- `name text not null`;
- `institution_name text`;
- `currency_code char(3) not null`;
- `nature text not null` (`asset` or `liability`);
- `include_in_net_worth boolean not null default true`;
- `include_in_liquid_funds boolean not null default false`;
- `color text`;
- `icon text`;
- `status text not null` (`active`, `archived`, `closed`);
- `opened_on date`;
- `closed_on date`;
- `metadata jsonb not null default '{}'`.

Unique active account names per user are desirable but should allow reuse after archival. Nature must agree with supported account type unless explicitly overridden for `other`.

### `account_balance_snapshots`

- `account_id uuid not null references accounts`;
- `user_id`;
- `balance numeric(20, 6) not null`;
- `currency_code char(3) not null`;
- `as_of_at timestamptz not null`;
- `source text not null` (`user`, `reconciliation`, `provider`, `calculated`);
- `is_verified boolean not null`;
- `source_reference text`.

Index `(account_id, as_of_at desc)`. Snapshots support reconciliation and historical diagnostics; they do not replace ledger entries.

### `credit_card_details`

- `account_id uuid primary key references accounts`;
- `credit_limit numeric(20, 6)`;
- `billing_day smallint`;
- `payment_due_day smallint`;
- `apr numeric(9, 6)`;
- `last_four char(4)`;
- `provider_metadata jsonb`.

Never store full card numbers, CVV, PIN, or online banking credentials.

### `credit_card_statements`

- `account_id`, `user_id`;
- `period_start date`, `period_end date`;
- `statement_balance numeric(20, 6)`;
- `minimum_due numeric(20, 6)`;
- `due_date date`;
- `status text`;
- `source text`.

Unique `(account_id, period_end)`.

## 5. Categories and tags

### `categories`

- `user_id` nullable only for immutable system templates;
- `category_type text not null` (`income`, `expense`);
- `parent_id uuid references categories`;
- `name text not null`;
- `icon text`, `color text`;
- `sort_order integer not null`;
- `is_system_template boolean not null default false`;
- `archived_at timestamptz`.

Prevent cycles in the parent graph and restrict nesting depth in application validation. A user transaction cannot reference another user's category.

### `tags`

- `user_id`;
- `name text not null`;
- `color text`;
- `archived_at timestamptz`.

Unique normalized active tag name per user.

## 6. Transaction and ledger core

### `transactions`

- `user_id`;
- `transaction_type text not null`;
- `status text not null`;
- `occurred_at timestamptz not null`;
- `posted_at timestamptz`;
- `description text`;
- `merchant_name text`;
- `notes text`;
- `original_amount numeric(20, 6) not null`;
- `original_currency char(3) not null`;
- `reporting_amount numeric(20, 6)`;
- `reporting_currency char(3)`;
- `exchange_rate_id uuid`;
- `source text not null` (`manual`, `ocr`, `recurring`, `import`, `system`);
- `external_reference text`;
- `parent_transaction_id uuid references transactions` for refund/reversal relationships;
- `recurring_occurrence_id uuid`;
- `idempotency_key text`;
- `calculation_version text`.

Checks require positive magnitude, consistent reporting amount/currency pairs, and posted time for cleared transactions. Unique `(user_id, idempotency_key)` when present.

### `ledger_entries`

- `transaction_id uuid not null references transactions`;
- `user_id`;
- `account_id uuid references accounts`;
- `category_id uuid references categories`;
- `entry_side text not null` (`debit`, `credit`);
- `amount numeric(20, 6) not null`;
- `currency_code char(3) not null`;
- `memo text`;
- `sequence integer not null`.

Exactly one of `account_id` and `category_id` is usually present, with controlled exceptions for system clearing accounts. Unique `(transaction_id, sequence)`. A deferred constraint/posting service must verify balanced totals before a transaction reaches `cleared`.

### `transaction_splits`

This is a user-facing projection of category allocation and may be generated from ledger entries:

- `transaction_id`, `user_id`;
- `category_id`;
- `amount numeric(20, 6)`;
- `currency_code char(3)`;
- `notes text`;
- `sequence integer`.

Split totals must match the categorization-required amount.

### `transaction_tags`

- `transaction_id`;
- `tag_id`;
- primary key `(transaction_id, tag_id)`.

### `transaction_links`

- `from_transaction_id`;
- `to_transaction_id`;
- `link_type text` (`transfer_pair`, `refund_of`, `reversal_of`, `replacement_of`, `payment_for`, `goal_contribution`);
- primary key over both IDs and type.

## 7. Recurring income and expenses

### `recurring_rules`

- `user_id`;
- `rule_type text`;
- `name text`;
- `amount`, `currency_code`;
- `source_account_id`, `destination_account_id`, `category_id`;
- `frequency text`;
- `interval_count integer`;
- `schedule_data jsonb` for weekday/month-day/custom rules;
- `start_date date`, `end_date date`;
- `next_occurrence_date date`;
- `auto_post boolean not null default false`;
- `status text`;
- `gross_or_net text` for salary rules;
- `original_period text`;
- `normalized_monthly_amount numeric(20, 6)`.

### `recurring_occurrences`

- `recurring_rule_id`, `user_id`;
- `expected_at timestamptz`;
- `expected_amount`, `currency_code`;
- `status text` (`expected`, `matched`, `skipped`, `overdue`, `cancelled`);
- `matched_transaction_id uuid`;
- `match_confidence numeric(5, 4)`;
- unique `(recurring_rule_id, expected_at)`.

This separation prevents projected salary or bills from being mistaken for posted transactions.

## 8. Loans and investments

### `loan_details`

- `account_id uuid primary key`;
- `original_principal`, `currency_code`;
- `annual_interest_rate numeric(9, 6)`;
- `rate_type text`;
- `start_date date`;
- `term_count integer`;
- `payment_frequency text`;
- `lender_payment_amount numeric(20, 6)`;
- `calculated_payment_amount numeric(20, 6)`;
- `calculation_version text`.

### `loan_schedule_entries`

- `loan_account_id`, `user_id`;
- `installment_number integer`;
- `due_date date`;
- `opening_principal`, `principal_due`, `interest_due`, `fees_due`, `closing_principal`;
- `status text`;
- `transaction_id uuid`;
- `schedule_version integer`;
- unique `(loan_account_id, schedule_version, installment_number)`.

Posted/actual splits remain in the ledger; schedule rows are projections.

### `investment_valuations`

- `account_id`, `user_id`;
- `value numeric(20, 6)`;
- `currency_code`;
- `valued_at timestamptz`;
- `source text`;
- `is_estimated boolean`.

Index `(account_id, valued_at desc)`.

Optional later tables: `securities`, `holdings`, `trades`, and `tax_lots`. Do not introduce them until holding-level tracking is selected.

## 9. Budgets and goals

### `budgets`

- `user_id`;
- `name text`;
- `period_type text`;
- `period_start date`, `period_end date`;
- `currency_code`;
- `rollover_policy text`;
- `status text`;
- `rules jsonb` containing explicit inclusion options.

### `budget_lines`

- `budget_id`, `user_id`;
- `category_id uuid` nullable for overall budget;
- `amount numeric(20, 6)`;
- `warning_threshold numeric(7, 4)`;
- unique `(budget_id, category_id)` with special handling for the null overall line.

### `goals`

- `user_id`;
- `name text`;
- `goal_type text`;
- `target_amount`, `currency_code`;
- `target_date date`;
- `current_allocated_amount numeric(20, 6)`;
- `priority smallint`;
- `status text`;
- `protected boolean`;
- `assumptions jsonb`;
- `calculation_version text`.

### `goal_allocations`

- `goal_id`, `user_id`;
- `transaction_id uuid` nullable;
- `amount`, `currency_code`;
- `allocated_at timestamptz`;
- `allocation_type text` (`contribution`, `withdrawal`, `adjustment`);
- `notes text`.

Current allocation is cached for speed but must be reproducible from allocations.

### `purchase_scenarios`

- `goal_id uuid` nullable, `user_id`;
- `name text`;
- `input_snapshot jsonb`;
- `result_snapshot jsonb`;
- `classification text`;
- `calculation_version text`;
- `calculated_at timestamptz`.

Snapshots make past scenario results explainable after formulas change.

## 10. Assets and replacement planning

### `owned_assets`

- `user_id`;
- `name`, `asset_type`, `brand`, `model`;
- `purchase_date date`;
- `purchase_price`, `currency_code`;
- `warranty_expires_on date`;
- `expected_life_months_min`, `expected_life_months_max`;
- `usage_intensity text`;
- `condition text`;
- `estimated_resale_value numeric(20, 6)`;
- `replacement_cost numeric(20, 6)`;
- `replacement_goal_id uuid`;
- `status text`.

### `asset_events`

- `asset_id`, `user_id`;
- `event_type text` (`maintenance`, `repair`, `inspection`, `condition`, `warranty`, `support`);
- `occurred_on date`;
- `cost numeric(20, 6)`;
- `currency_code`;
- `notes text`;
- `transaction_id uuid` nullable.

### `replacement_assessments`

- `asset_id`, `user_id`;
- `input_snapshot jsonb`;
- `signal_snapshot jsonb`;
- `result text`;
- `reason_codes jsonb`;
- `calculation_version text`;
- `assessed_at timestamptz`;
- `next_review_on date`.

## 11. Attachments and OCR

### `attachments`

- `user_id`;
- `storage_key text unique not null`;
- `original_filename text`;
- `media_type text`;
- `byte_size bigint`;
- `sha256 char(64)`;
- `status text` (`uploading`, `ready`, `quarantined`, `deleted`);
- `encrypted boolean`;
- `retention_until timestamptz`.

### `attachment_links`

- `attachment_id`;
- `entity_type text`;
- `entity_id uuid`;
- `purpose text`;
- primary key `(attachment_id, entity_type, entity_id, purpose)`.

Use an allowlist of entity types and verify entity ownership in the service layer.

### `ocr_jobs`

- `attachment_id`, `user_id`;
- `provider text`;
- `status text`;
- `provider_request_id text`;
- `started_at`, `completed_at`;
- `error_code text`;
- `attempt_count integer`;
- `extractor_version text`.

### `ocr_results`

- `ocr_job_id uuid unique`;
- `raw_result_encrypted jsonb` or secure object reference;
- `normalized_fields jsonb`;
- `field_confidence jsonb`;
- `validation_warnings jsonb`;
- `suggested_transaction_id uuid` nullable;
- `review_status text`;
- `reviewed_at timestamptz`.

Retention for raw OCR/provider responses should be shorter than retained user receipts unless the user explicitly needs it.

## 12. Exchange rates, insights, and notifications

### `exchange_rates`

- `base_currency`, `quote_currency`;
- `rate numeric(24, 12)`;
- `rate_at timestamptz`;
- `source text`;
- `kind text` (`spot`, `transaction`, `manual`);
- unique `(base_currency, quote_currency, rate_at, source)`.

### `insights`

- `user_id`;
- `insight_type text`;
- `title`, `summary`;
- `supporting_facts jsonb`;
- `model_provider`, `model_name`, `prompt_version`;
- `input_fingerprint text`;
- `confidence numeric(5, 4)`;
- `status text`;
- `generated_at`, `expires_at`;
- `dismissed_at`.

Do not store raw prompts containing unnecessary personal data.

### `insight_feedback`

- `insight_id`, `user_id`;
- `rating text`;
- `reason_code text`;
- `comment text`;
- `created_at`.

### `notifications`

- `user_id`;
- `notification_type text`;
- `title`, `body`;
- `entity_type`, `entity_id`;
- `channel text`;
- `scheduled_for`, `sent_at`, `read_at`;
- `status text`;
- `deduplication_key text`.

Unique `(user_id, deduplication_key)` when present.

### `notification_preferences`

- `user_id`, `notification_type`, `channel`;
- `enabled boolean`;
- `quiet_hours_start`, `quiet_hours_end`;
- `time_zone text`;
- primary key `(user_id, notification_type, channel)`.

## 13. Audit and operational tables

### `audit_events`

- `user_id` nullable for system events;
- `actor_type`, `actor_id`;
- `action text`;
- `entity_type`, `entity_id`;
- `occurred_at`;
- `request_id`, `ip_hash`, `user_agent_summary`;
- `before_snapshot jsonb`, `after_snapshot jsonb` with sensitive-field redaction.

Audit records are append-only and have a defined retention policy.

### `idempotency_records`

- `user_id`;
- `key text`;
- `request_hash text`;
- `response_status integer`;
- `response_body jsonb`;
- `expires_at timestamptz`;
- unique `(user_id, key)`.

### `outbox_events`

- `aggregate_type`, `aggregate_id`;
- `event_type`;
- `payload jsonb`;
- `occurred_at`, `published_at`;
- `attempt_count`, `last_error`.

The transactional outbox supports reliable reminders, projections, and analytics updates without coupling them to request completion.

## 14. Ownership and row isolation

- Every query for a user-owned record includes authenticated `user_id`.
- Child writes validate that all parent records belong to the same user.
- PostgreSQL row-level security is recommended as defense in depth, with the request user ID set transaction-locally.
- Background jobs carry an explicit user/tenant context and never run unrestricted domain queries.
- System category templates are read-only and copied or referenced through controlled logic.

## 15. Important indexes

- `transactions (user_id, occurred_at desc, id desc)`;
- `transactions (user_id, status, occurred_at desc)`;
- `transactions (user_id, merchant_name)` using suitable normalized/trigram search later;
- `ledger_entries (account_id, transaction_id)`;
- `ledger_entries (category_id, transaction_id)`;
- `recurring_occurrences (user_id, status, expected_at)`;
- `notifications (user_id, status, scheduled_for)`;
- `owned_assets (user_id, status)`;
- `asset_events (asset_id, occurred_on desc)`;
- `attachments (user_id, sha256)`;
- `audit_events (user_id, occurred_at desc)`.

Add indexes from measured query plans rather than indexing every column. Partial indexes for active/non-deleted records are preferred where useful.

## 16. Database invariants

The posting service and database constraints must ensure:

1. Cleared transactions are balanced.
2. Cross-user foreign-key relationships are impossible through service validation and composite ownership constraints where practical.
3. Original monetary amount is positive and currency is present.
4. Transfer source and destination differ.
5. Category type matches the financial entry type.
6. Split totals equal the categorized transaction amount.
7. A reversed transaction cannot be reversed twice.
8. Refund totals do not exceed the original without explicit reviewed override.
9. Archived/closed accounts cannot accept ordinary new postings.
10. Projected recurring occurrences do not affect actual balances.
11. OCR data cannot create a cleared transaction without confirmation.
12. Cached goal balances and analytic summaries remain rebuildable.

## 17. Migration order

1. Users, preferences, and consent.
2. Accounts, categories, and tags.
3. Transactions, ledger entries, splits, links, and idempotency.
4. Recurring rules and occurrences.
5. Credit-card, loan, and investment extensions.
6. Budgets, goals, and scenarios.
7. Assets and assessments.
8. Attachments and OCR.
9. Insights, notifications, audit, and outbox.
10. Reporting views/materialized summaries after real query patterns exist.

## 18. Open schema decisions

- Whether first-release investments need individual holdings or only account valuations.
- Whether user-entered transactions may post immediately or require a brief editable pending state.
- Default refund reporting: refund-date only or optional original-period restatement.
- Exact row-level security implementation with the chosen connection-pool strategy.
- OCR raw-result retention duration.
- Whether reporting aggregates begin as SQL views or application queries before materialization.

