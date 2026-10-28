# Financial Rules

## 1. Purpose

This document defines the deterministic financial behavior of the application. The backend implements these rules; dashboards and Gemini consume their results. AI must never redefine or override them.

Every derived value must expose:

- the calculation version;
- reporting range and user time zone;
- included and excluded records;
- currency and exchange-rate assumptions;
- whether the result is actual, projected, or estimated.

## 2. Money and numeric representation

- Persist every monetary value with an ISO 4217 currency code.
- Use PostgreSQL `numeric(20, 6)` internally. Round only at presentation or at a legally meaningful posting boundary.
- Never use binary floating point for stored money or financial calculations.
- Amounts are stored as non-negative magnitudes. Direction comes from the transaction type and ledger entry direction.
- Each currency has a configured display precision. Support exceptional currencies without assuming two decimals.
- A transaction must balance: total debits equal total credits in the transaction currency after permitted rounding.
- Store the original amount/currency and conversion amount/rate separately. Never overwrite historical values when rates change.

## 3. Dates, periods, and status

- Store timestamps in UTC and the user's IANA time-zone identifier.
- Use the user's local date for monthly/yearly grouping.
- `occurred_at` means when the financial event happened.
- `posted_at` means when it cleared/posted to an account.
- `created_at` is an audit timestamp and never drives financial reporting.
- A reporting range is half-open: `start <= occurred_at < end` after conversion from local boundaries to UTC.
- Transaction status is `draft`, `pending`, `cleared`, `void`, or `reversed`.
- Actual financial reports include `cleared` by default. Pending values appear separately unless the user explicitly includes them.
- Draft, void, and reversed originals never count in actual totals.

## 4. Transaction classes

### Expense

- Decreases an asset account or increases a liability such as a credit card.
- Counts as spending when cleared.
- Can contain one or more category splits.

### Income

- Increases an asset account or reduces a receivable.
- Counts as income when cleared.
- Salary, freelance income, interest, and dividends retain distinct categories.

### Transfer

- Moves value between user-owned accounts.
- Does not count as income or expense.
- Fees attached to a transfer are separate expense splits.

### Refund

- References an original expense when possible.
- Reduces spending for the original expense category.
- A refund greater than the remaining refundable amount requires explicit confirmation and is flagged for review.
- Reporting can show refunds by refund date or restate the original period; the default is refund-date accounting with comparative metadata.

### Balance adjustment

- Reconciles the calculated account balance to a verified external balance.
- Does not count as ordinary income or spending.
- Requires a reason, effective date, and audit record.

### Investment valuation

- Changes reported investment value without being income, spending, or cash flow.
- Contributions and withdrawals are transfers; fees are expenses; dividends/interest are income when received or reinvested.

## 5. Double-entry ledger rules

User-facing transactions create immutable ledger entries:

- asset increase: debit;
- asset decrease: credit;
- liability increase: credit;
- liability decrease: debit;
- expense recognition: debit expense category and credit funding account;
- income recognition: debit receiving account and credit income category;
- transfer: debit destination account and credit source account;
- credit-card purchase: debit expense category and credit card liability;
- credit-card payment: debit card liability and credit bank account;
- loan proceeds: debit receiving asset and credit loan liability;
- loan payment: debit principal liability plus debit interest/fee expenses and credit paying account.

The UI may hide accounting terminology, but the ledger must remain balanced and auditable.

Posted records should be corrected through reversal and replacement rather than destructive mutation. Draft records may be edited directly.

## 6. Accounts and balances

Account types:

- cash;
- checking/current;
- savings;
- wallet;
- credit card;
- loan;
- investment;
- other asset;
- other liability.

Definitions:

- `ledger_balance`: opening balance plus all cleared ledger entries through the as-of time.
- `pending_balance`: ledger balance plus pending entries.
- `available_balance`: user-entered/provider balance when available; otherwise the app may estimate it and label it clearly.
- `net_worth`: total converted asset balances minus total converted liability balances.

Opening balance is represented as a special ledger transaction dated at the account's balance-as-of time. Changing it after later activity requires confirmation and an audit event.

Archived accounts remain in historical reporting. They cannot receive new ordinary transactions.

## 7. Salary and recurring income

Salary input requires:

- amount;
- currency;
- whether the amount is gross or take-home;
- period/frequency;
- expected pay rule;
- destination account;
- effective start date;
- optional end date.

Normalization:

- weekly monthly equivalent = amount × 52 / 12;
- biweekly monthly equivalent = amount × 26 / 12;
- every four weeks monthly equivalent = amount × 13 / 12;
- twice-monthly equivalent = amount × 2;
- monthly equivalent = amount;
- annual monthly equivalent = amount / 12.

Normalized values are planning estimates, not posted income. Each expected pay event is a projection until matched to or confirmed as an actual income transaction.

Verification means user confirmation or matching with an imported/recorded deposit. It does not mean employer verification in the first release.

Gross salary must not be used as available cash. If gross salary is entered without deductions, use it only for gross-income analytics and request take-home pay for affordability calculations.

## 8. Credit cards

- A credit card is a liability account.
- Card purchases count once as expenses on purchase/posted date according to reporting configuration.
- Card payments are transfers from an asset account to the card liability.
- Cash advances are transfers or liability movements plus separate fees, not ordinary income.
- Interest, annual charges, late fees, and foreign transaction fees are expenses.
- Statement data includes cycle start/end, statement balance, minimum due, due date, and payment status.
- Available credit = credit limit − current outstanding, with issuer-specific exceptions clearly labeled.
- Utilization = eligible outstanding / credit limit; do not compute if the limit is missing or zero.
- The system must warn against double-counting if a manually entered payment resembles an existing transfer.

## 9. Loans and EMIs

Loan setup includes principal, currency, annual rate, rate type, start date, term, payment frequency, fee treatment, and repayment method.

For a standard amortizing loan with periodic rate `r`, number of payments `n`, and principal `P`:

`payment = P × r × (1 + r)^n / ((1 + r)^n - 1)`

When `r = 0`, `payment = P / n`.

Rules:

- Treat the calculated schedule as estimated until reconciled with lender statements.
- Each payment splits into principal, interest, and fees.
- Principal reduction is not an expense; interest and fees are expenses.
- Late payments, variable rates, prepayments, and rounding can regenerate future schedule rows without rewriting actual posted payments.
- Store lender-provided EMI separately from calculated EMI and show variance.
- Monthly commitment calculations include payments due in the selected month, not simply one average payment.

## 10. Investments

First-release scope:

- contributions and withdrawals;
- user-entered or imported valuations;
- cash income such as dividends or interest;
- realized fees and taxes;
- optional simple holdings without tax-lot advice.

Definitions:

- net contributions = contributions − withdrawals;
- simple gain/loss = current value − net contributions;
- simple return percentage = gain/loss / net contributions when net contributions > 0.

Label simple return as not time-weighted. Do not imply investment advice or calculate a return when inputs are incomplete.

## 11. Categories, splits, and tags

- Income and expense categories are distinct types.
- A transaction split total must equal the transaction amount, excluding separately represented transfer legs and fees.
- Categories in historical transactions are archived, not hard-deleted.
- Category renaming updates presentation without changing historical identity.
- Tags are descriptive and do not affect financial classification.
- “EMI” may be a UI grouping, but principal must not be categorized as an expense.

## 12. Core metrics

For a selected range and base currency:

- `actual_income = sum(cleared income) − income reversals`.
- `actual_spending = sum(cleared expenses) − qualifying refunds`.
- `net_cash_flow = cash inflows − cash outflows`, excluding internal transfers when viewing the whole portfolio.
- `operating_surplus = actual_income − actual_spending`.
- `savings_rate = operating_surplus / actual_income × 100` when actual income > 0; otherwise show unavailable.
- `average_daily_spend = actual_spending / elapsed local days`, not total calendar days for an in-progress period.
- `budget_remaining = budget − qualifying actual spending`.
- `projected_month_end_spending` uses a versioned method and must be labeled estimated.

Transfers disappear at portfolio level but remain visible as flows within an individual account.

## 13. Available-to-spend

The default formula is:

`available_to_spend = eligible_liquid_balance + confirmed_income_before_horizon − committed_outflows_before_horizon − protected_reserve − goal_reservations`

Where:

- eligible liquid balance excludes investments, restricted accounts, and unavailable credit;
- confirmed income includes actual cleared income and optionally high-confidence scheduled take-home income, shown separately;
- committed outflows include upcoming bills, EMIs, loan/card payments, and approved recurring expenses;
- protected reserve is the configured emergency-fund floor;
- goal reservations are funds explicitly allocated to active goals.

Provide conservative and projected variants. Never silently count gross salary, credit limits, or unconfirmed income as spendable money.

## 14. Budgets

- A budget has a period, amount, currency, scope, rollover behavior, and qualifying transaction rules.
- Transfers, loan principal, investment contributions, balance adjustments, void items, and drafts are excluded.
- Interest, fees, and ordinary card purchases are included.
- Refunds reduce budget consumption by default.
- Rollover may be disabled, positive-only, or positive-and-negative.
- Threshold states default to `on_track` below 75%, `watch` from 75% through 100%, and `exceeded` above 100%; users may configure thresholds.
- Budget pace compares actual spending with elapsed-period proportion, but fixed bills can be optionally excluded from pace warnings.

## 15. Goals and purchase affordability

Goal inputs include target amount/date, current allocation, contribution schedule, expected inflation, return assumption, and fees.

For a zero-return simple goal:

`required_periodic_contribution = max(0, future_target − current_allocation) / remaining_periods`

Future target with annual inflation `i` and years `t`:

`future_target = current_price × (1 + i)^t`

Affordability must evaluate:

- emergency reserve after purchase;
- required contribution versus disposable cash flow;
- existing debt and monthly commitments;
- effect on higher-priority goals;
- upfront and total financed cost;
- user-provided target-date flexibility.

Outputs are `on_track`, `possible_with_tradeoffs`, `not_currently_safe`, or `insufficient_data`, with reasons and assumptions. These are planning classifications, not professional financial advice.

## 16. Asset replacement rules

Inputs include age, useful-life range, condition, usage intensity, repair history/cost, warranty, security/software support, resale value, replacement price, and available goal funds.

The deterministic engine calculates component signals such as:

- age ratio = age / expected useful life;
- trailing repair-cost ratio = recent repair costs / replacement cost;
- readiness ratio = allocated replacement funds / expected replacement cost;
- reliability, support, safety, and condition questionnaire scores.

Rules return one of:

- `keep`;
- `monitor`;
- `repair`;
- `consider_replacement`;
- `insufficient_data`.

No single age threshold forces replacement. Safety-critical answers can raise urgency but must show the exact reason. Gemini may explain the result but cannot change it.

## 17. Multi-currency rules

- A user has one reporting/base currency but accounts retain native currencies.
- Every conversion records source, timestamp/date, rate, and direction.
- Historical reports use stored transaction rates by default.
- Balance summaries may use latest available rates and must display the valuation timestamp.
- Exchange-rate gains/losses are separate from spending unless explicitly realized and classified.
- Missing rates produce partial totals with a visible warning; never assume 1:1.

## 18. Reconciliation, duplicates, and corrections

- Reconciliation compares a verified external balance at a date against the ledger balance.
- Differences can be resolved by finding missing/duplicate entries or creating an explained adjustment.
- Duplicate detection uses amount, currency, account, time window, merchant, reference, and receipt hash. It flags; it does not auto-delete.
- Posted corrections create a reversal linked to the original plus a replacement transaction.
- Hard deletion is restricted to unposted drafts and privacy-erasure workflows.

## 19. Required edge-case tests

- leap years, month ends, daylight-saving transitions, and non-UTC time zones;
- currencies with zero, two, three, or unusual display decimals;
- partial and excess refunds;
- cross-currency transfers and transfer fees;
- card purchase followed by payment without duplicate expense;
- loan payment split and early prepayment;
- missing salary, gross-only salary, irregular pay, and skipped pay event;
- zero income and negative cash-flow periods;
- archived accounts/categories with historical records;
- pending to cleared transitions;
- reversed and replaced transactions;
- OCR totals that disagree with extracted line items;
- missing exchange rates and stale investment valuations.

