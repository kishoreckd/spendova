# Spendova — Personal Finance & Life Purchase Planner

## 1. Product vision

Spendova is more than an expense tracker. It is a personal financial decision system that helps a user:

- record income, expenses, transfers, refunds, and recurring transactions;
- understand spending by day, week, month, year, category, merchant, and account;
- plan purchases such as a car, phone, holiday, or home;
- estimate when an owned product may need replacement;
- build savings plans and track progress toward them;
- receive explainable, privacy-conscious insights powered by Gemini;
- use the product comfortably from a mobile phone first, while retaining a strong desktop experience.

The product should answer four questions quickly:

1. Where did my money go?
2. What can I safely spend now?
3. When can I afford a future purchase?
4. Which purchases or subscriptions should I reconsider?

## 2. Recommended technical direction

### Recommended: hybrid architecture

- Frontend: React, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, TanStack Query, React Hook Form, Zod, Recharts.
- Mobile delivery: responsive Progressive Web App initially; consider Capacitor later for app-store packaging and native notifications.
- API: Python with FastAPI, Pydantic, SQLAlchemy, and Alembic.
- Database: PostgreSQL.
- Authentication: Firebase Authentication with Google sign-in for the first release. Other sign-in methods can be added later if needed.
- Background work: Celery or a lighter task queue only when recurring imports, reminders, and AI jobs require it.
- AI: Gemini called only from the backend. Never expose the API key in the React bundle.
- Storage: object storage for receipts and product documents; store only metadata and secure object references in PostgreSQL.

Why this is preferable to an all-Firebase implementation: transactions, split transactions, budgets, category history, recurring schedules, and time-series analytics are relational. PostgreSQL provides clearer constraints, reporting, migrations, and portability. Firebase remains useful for authentication, push notifications, and optional event-driven features.

### Alternative: Firebase-only MVP

Use React + Firebase Auth + Firestore + Cloud Functions + Storage. This is faster for a small private MVP, but reporting queries, aggregates, migrations, and financial consistency will become more complex. Choose it only if speed of first release is more important than long-term reporting flexibility.

## 3. Product modules

### Authentication and account security

- Sign in with Google.
- Session/device list and sign out from all devices.
- Optional PIN or biometric app lock when packaged as a mobile app.
- Export account data and delete account.
- Recovery codes if multi-factor authentication is added.

### Accounts

- Cash, bank account, credit card, wallet, investment, and loan account types.
- Opening balance, currency, institution, icon/color, and archived state.
- Transfers between accounts must not count as expenses.
- Credit-card payment must be modeled as a transfer, not a second expense.
- Manual accounts first; bank integrations can be a later phase.
- Salary is recurring income, not an account balance. A balance comes from an opening balance plus cleared ledger activity.
- Users may enter monthly or annual gross/net salary. The app normalizes it for planning and creates a recurring income rule only after the user confirms its meaning, frequency, and destination account.
- Projected salary and income actually received must always be shown separately.

### Categories

Default expense categories:

- Food & Dining
- Groceries
- Housing/Rent
- Utilities
- Transport
- Shopping
- Health
- Insurance
- Education
- Entertainment
- Travel
- Subscriptions
- Personal Care
- Gifts/Donations
- Taxes/Fees
- EMI/Debt Payment
- Other

Default income categories:

- Salary
- Freelance/Business
- Interest/Dividends
- Refund
- Gift
- Other Income

Users can create, edit, reorder, archive, color, and icon categories. Support parent and child categories, but keep the mobile picker shallow. Categories referenced by transactions should be archived rather than deleted.

### Transactions

- Expense, income, transfer, refund, and balance adjustment.
- Amount, currency, date/time, account, category, merchant/payee, notes, tags, location, receipt, and payment method.
- Split one transaction across multiple categories.
- Recurring transactions with expected date, frequency, end date, and reminder.
- Pending versus cleared state.
- Duplicate detection.
- Search and compound filters.
- CSV import/export and future bank-statement import.
- Quick-add templates for frequently repeated entries.
- Offline draft capture with sync/conflict handling.
- Receipt/bill image capture and upload.
- OCR-assisted drafts for merchant, date, total, tax, currency, and line items. The user reviews and confirms every OCR draft before it becomes a transaction.
- Preserve OCR confidence and source-field provenance so uncertain values can be highlighted.

### Dashboard and analytics

The default dashboard should show:

- current-month spending and income;
- available-to-spend estimate;
- comparison with the previous equivalent period;
- budget usage;
- savings-goal progress;
- upcoming bills;
- recent transactions;
- one actionable insight, not an overwhelming feed.

Analytics views:

- spending trend line for selectable ranges;
- income versus expense bars;
- category breakdown donut/treemap;
- cumulative spend curve;
- calendar heatmap;
- merchant and subscription ranking;
- monthly cash-flow table;
- net-worth trend when account balances are supported;
- budget variance: planned versus actual;
- rolling averages and year-over-year comparison;
- custom range and comparison range.

Every chart should allow users to tap a point/segment and open the filtered transactions behind it. Charts are explanations, not decorative images.

### Budgets

- Monthly overall budget.
- Category budgets.
- Fixed, flexible, and rollover budget types.
- Threshold alerts at configurable percentages.
- Planned versus actual view.
- Copy last month's budget.
- Exclude transfers and optionally exclude one-time expenses.

### Assets and replacement planning

Track owned products such as phones, laptops, appliances, vehicles, and furniture:

- name, category, brand/model;
- purchase date and price;
- warranty expiry;
- expected useful-life range;
- condition and usage intensity;
- maintenance/repair history and cost;
- resale-value estimate entered by the user;
- receipt and warranty attachment;
- desired replacement product and estimated replacement cost.

Replacement analysis must not simply say that an old product should be replaced. It should calculate and explain:

- age versus typical useful-life range;
- repair cost versus replacement cost;
- recent reliability or condition supplied by the user;
- current savings-goal readiness;
- cost per month/year of ownership;
- an outcome such as `keep`, `monitor`, `repair`, or `consider replacement`;
- confidence and assumptions.

For an iPhone bought in 2017, the app can identify its age and ask about battery health, performance, repair history, security/software support, and replacement budget. The final recommendation should remain a decision aid, not an automatic instruction to buy.

### Purchase and savings planner

Inputs:

- goal name and type;
- target price and target date;
- current savings allocated to the goal;
- expected price inflation;
- optional trade-in/resale value;
- priority and flexibility of date;
- financing assumptions, deposit, interest, fees, and loan term;
- contribution frequency.

Outputs:

- required weekly/monthly contribution;
- earliest affordable date at the current saving rate;
- funding gap;
- effect on emergency funds and other goals;
- cash-purchase versus finance comparison;
- scenario comparison: cheaper option, later date, larger deposit, or higher contribution.

The planner must distinguish "I can make the payment" from "I can afford this safely." Define a configurable emergency-fund floor and avoid recommending that it be consumed.

### Notifications and reminders

- upcoming recurring bills;
- budget threshold crossed;
- savings contribution due;
- warranty about to expire;
- planned replacement review date;
- unusual or duplicate transaction;
- weekly/monthly digest.

Allow per-notification control, quiet hours, and email/push/in-app preferences.

## 4. Mobile-first information architecture

Detailed screen layouts, dashboard states, interactions, and shadcn/ui mappings are maintained separately in [UI_UX_PLAN.md](./UI_UX_PLAN.md). This section is only the product-level navigation summary.

Use a five-item bottom navigation:

1. Home
2. Transactions
3. Add (prominent central action)
4. Plan
5. More

`Plan` contains budgets, savings goals, purchase scenarios, and owned assets. `More` contains accounts, categories, insights, reports, imports/exports, and settings. On desktop, convert this structure to a left sidebar.

Primary mobile screens:

- onboarding and authentication;
- dashboard;
- quick-add transaction sheet;
- full transaction form;
- transaction list and filters;
- analytics/report detail;
- budgets;
- goals and purchase scenarios;
- assets and replacement review;
- account/category management;
- notification center;
- settings, security, export, and delete account.

Mobile interaction rules:

- minimum 44px touch targets;
- amount keypad optimized for one-handed entry;
- bottom sheets for quick actions and short pickers;
- full pages for complex forms;
- sticky save/submit controls;
- optimistic updates with visible sync state;
- never rely on hover;
- charts must support tap and accessible summaries;
- support safe-area insets, reduced motion, dark mode, and screen readers.

## 5. shadcn/ui component mapping

- App navigation: `Sidebar`, `NavigationMenu`, `DropdownMenu`, `Breadcrumb`.
- Mobile navigation: custom bottom bar using shadcn primitives and Lucide icons.
- Quick add: `Drawer` on mobile and `Dialog` on desktop.
- Forms: `Form`, `Input`, `Select`, `Combobox`, `Calendar`, `Popover`, `Textarea`, `Checkbox`, `RadioGroup`, and `Switch`.
- Money entry: custom numeric input composed with `Input`; store values as integer minor units or decimal in the backend, never binary floating point.
- Transactions: `Card` on mobile and `DataTable` on desktop.
- Filters: `Command`, `Popover`, `Badge`, `Sheet`.
- Analytics: shadcn chart wrappers with Recharts, plus textual summaries.
- Status and progress: `Progress`, `Badge`, `Alert`, `Tooltip`.
- Feedback: `Sonner`, `AlertDialog`, `Skeleton`, and actionable empty states.
- Date range: `Calendar` with preset ranges.
- Tabs: `Tabs` for overview/details/history, but avoid deeply nested tabs.

Create design tokens for semantic colors such as income, expense, transfer, warning, and goal progress. Do not communicate financial state using color alone.

## 6. Core data model

All user-owned records include `id`, `user_id`, `created_at`, `updated_at`, and optional `deleted_at`.

### Main entities

- `users`: profile, locale, time zone, base currency, financial preferences.
- `accounts`: type, name, institution, currency, opening balance, archived state.
- `categories`: type, parent ID, name, icon, color, sort order, system/default flag.
- `transactions`: type, account ID, amount, currency, exchange rate, occurred date, merchant, status, notes.
- `transaction_splits`: transaction ID, category ID, amount.
- `tags` and `transaction_tags`.
- `attachments`: owner/entity ID, object reference, media type, metadata.
- `recurring_rules`: template data, cadence, next date, end condition.
- `budgets` and `budget_lines`.
- `goals`: target amount/date, current allocated amount, priority, status.
- `goal_contributions`: goal ID, source transaction ID, amount, date.
- `purchase_scenarios`: target, financing and inflation assumptions, computed snapshot.
- `assets`: purchase details, useful-life assumptions, condition, replacement target.
- `asset_events`: maintenance, repair, warranty, inspection, or condition change.
- `insights`: type, generated date, supporting facts, recommendation, confidence, expiry.
- `notification_preferences` and `notifications`.
- `audit_events`: security-sensitive and financial mutations.

### Essential financial rules

- Store money using PostgreSQL `numeric` or integer minor units with a currency code.
- Keep transaction history; prefer corrections/reversals over silent destructive edits.
- A transfer has two linked ledger effects and no expense category.
- Store dates in UTC and retain the user's time zone for grouping.
- Define category behavior over time so renaming a category does not break reports.
- Aggregates are derived from source transactions; cached summaries must be rebuildable.
- Every query must be scoped to the authenticated user.

## 7. API surface

Suggested route groups:

- `/auth/session` for backend verification of Firebase tokens.
- `/me` and `/me/preferences`.
- `/accounts`.
- `/categories`.
- `/transactions`, `/transactions/imports`, `/transactions/export`.
- `/recurring-rules`.
- `/budgets`.
- `/goals` and `/goals/{id}/projections`.
- `/assets` and `/assets/{id}/replacement-analysis`.
- `/analytics/summary`, `/analytics/timeseries`, `/analytics/categories`, `/analytics/merchants`.
- `/insights` and `/insights/{id}/feedback`.
- `/notifications` and `/notification-preferences`.

Use cursor pagination for long transaction lists, idempotency keys for transaction creation/imports, and explicit versioning before exposing the API externally.

## 8. Gemini integration

Good uses:

- turn deterministic analytics into a concise explanation;
- categorize a merchant with user confirmation;
- summarize spending changes;
- ask follow-up questions for an asset replacement review;
- produce purchase-plan scenarios from already calculated numbers;
- parse receipt text after extraction, subject to user consent.

Gemini should not be the financial calculator or source of truth. Calculate totals, projections, loan schedules, budget variance, and replacement scores in tested backend code. Send only the minimum facts necessary to Gemini and require structured JSON output validated against a schema.

Safety and privacy controls:

- keep the key in backend secrets;
- never send passwords, auth tokens, full card/account numbers, or unnecessary receipt contents;
- redact personal identifiers and merchant details when possible;
- obtain opt-in consent for AI analysis;
- show what facts support each suggestion;
- label AI-generated content and allow feedback/dismissal;
- impose rate, cost, and token limits;
- cache insights and set an expiry date;
- provide a complete non-AI experience if the service fails.

## 9. Analytics definitions to settle early

- Spending = cleared expense transactions minus qualifying refunds.
- Income excludes account transfers and opening-balance adjustments.
- Savings rate = `(income - spending) / income`, with zero-income handling.
- Available to spend = liquid balance minus upcoming committed bills minus protected emergency reserve, optionally adjusted for remaining budget.
- Net cash flow = income minus expense for the selected period.
- Budget variance = budgeted amount minus actual qualifying expense.
- Goal projection uses explicit contribution, return, inflation, and fee assumptions.

Display definitions in tooltips/help so numbers are trustworthy.

## 10. Security and privacy baseline

- Verify Firebase ID tokens on every protected API request.
- Apply per-user row ownership in application code and database policies where possible.
- Encrypt transport and managed storage; keep secrets outside source control.
- Use signed, expiring URLs for private attachments.
- Rate-limit authentication-adjacent and AI endpoints.
- Maintain audit records for exports, imports, deletes, and security changes.
- Back up the database and test restoration.
- Support data export and permanent deletion.
- Avoid storing bank credentials directly; use a regulated aggregator if bank sync is introduced.
- Add dependency, static-analysis, and secret-scanning checks to CI.

## 11. Delivery workplan

### Phase 0: discovery and foundations

- Confirm target country, base currency, locales, account types, and whether the app is single-user or eventually multi-user.
- Write precise definitions for expense, income, transfer, refund, available-to-spend, and savings rate.
- Produce low-fidelity mobile flows and a design-token sheet.
- Create a threat model and privacy/data-retention rules.
- Establish repository structure, CI, formatting, linting, testing, and environments.

Exit: approved information architecture, core schema, analytics definitions, and clickable screen flow.

### Phase 1: usable expense MVP

- Firebase authentication with Google login.
- Accounts and default/custom categories.
- Add/edit/delete/list transactions.
- Transfer and refund handling.
- Credit cards, loans, EMIs, and investment contribution tracking with correct cash-flow treatment.
- Receipt/bill upload with an OCR-generated draft and mandatory user review.
- Dashboard summary and monthly category chart.
- Mobile navigation, quick-add flow, responsive desktop shell, dark mode.
- Basic CSV export.

Exit: a user can reliably record and review one month of finances on mobile.

### Phase 2: planning and recurring money

- Recurring transactions and reminders.
- Budgets and threshold alerts.
- Savings goals and contribution tracking.
- Purchase affordability scenarios.
- Expanded reports, custom ranges, comparisons, and drill-down.
- PWA installation and offline transaction drafts.

Exit: the app supports regular financial planning, not only record keeping.

### Phase 3: ownership lifecycle

- Asset/product inventory.
- Warranty and maintenance events.
- Deterministic replacement score and review questionnaire.
- Replacement savings goal linkage.
- Receipt/warranty attachment storage.

Exit: the app can provide an explainable keep/repair/replace review.

### Phase 4: AI-assisted insights

- Privacy opt-in and redaction layer.
- Gemini structured-output gateway.
- Spending summary and anomaly explanations.
- Suggested categorization with confirmation.
- Asset-review narrative and purchase-scenario explanation.
- Insight feedback, cache, quotas, and failure fallback.

Exit: AI adds understandable advice without controlling financial calculations.

### Phase 5: scale and polish

- Import workflows and duplicate reconciliation.
- Advanced multi-currency reporting, valuation refresh, and reconciliation; currency-aware storage exists from the first release.
- Native wrapper/push notifications if PWA limitations matter.
- Accessibility audit, performance tuning, backup/restore drills.
- Optional household/shared budgeting using explicit roles and permissions.
- Optional bank-data integration based on country/provider.

## 12. Testing strategy

- Unit tests for money arithmetic, recurrence, transfers, refunds, savings projections, loan schedules, date boundaries, and replacement scoring.
- API integration tests proving strict user isolation.
- Component tests for forms, validation, and responsive states.
- End-to-end mobile flows: sign up, create account, record expense, transfer money, set budget, create goal, and view report.
- Property-based tests for ledger invariants where practical.
- Visual checks for common mobile widths, desktop, dark mode, empty/loading/error/offline states.
- Accessibility testing with keyboard and screen-reader semantics.
- AI contract tests using fixed structured fixtures; do not depend on live Gemini responses in normal CI.

## 13. Confirmed decisions and remaining questions

Confirmed choices are recorded in [DECISIONS.md](./DECISIONS.md).

1. Is offline transaction entry a launch requirement?
2. Which notifications are essential, and should they use email, push, or both?
3. What emergency-fund or debt rule defines an affordable purchase?
4. Should AI receive merchant names, notes, and receipt text, or only anonymized aggregates?
5. Should salary planning use take-home pay only, or also model gross salary, tax, and deductions?
6. Should investments track contributions and current value only, or individual holdings and performance?

## 14. Recommended first vertical slice

Build one complete path before adding many screens:

1. Sign in with Google.
2. Create a cash/bank account.
3. Seed default categories.
4. Add an expense from a mobile drawer.
5. Persist it through the FastAPI service into PostgreSQL.
6. Show it in the transaction list.
7. Update the monthly summary and category chart.
8. Tap the chart category to view its underlying transactions.

This slice validates authentication, ownership, money representation, core UI patterns, API boundaries, database design, and analytics in one small release.

## 15. Explicit non-goals for the first release

- automatic investment advice;
- autonomous purchases or money transfers;
- tax filing;
- bank credential storage;
- predictive credit scoring;
- complex household permissions;
- AI-generated totals or financial calculations;
- every possible chart before core data quality is proven.
