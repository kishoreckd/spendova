# Product Decisions

This file records agreed product choices. Open questions remain in `01-product-plan.md`.

## Locale and currency

- The app adapts to the user's selected country, locale, time zone, and base currency.
- Formatting, category suggestions, and financial terminology follow those preferences.
- Each account and transaction retains its currency code to keep future multi-currency support possible.

## User model

- The first release is personal and single-user.
- Household sharing and collaborative budgets are out of scope for now.
- Every private database record still has explicit user ownership.

## Salary, income, and balances

- A user can enter monthly or annual salary and identify it as gross or take-home pay.
- Salary setup requires currency, pay frequency, expected pay date, and destination account before becoming recurring income.
- Annual salary is normalized for planning while preserving the original amount and frequency.
- Expected salary is projected income. It becomes actual income only when receipt is recorded or confirmed.
- Salary does not equal account balance. Balance derives from opening balance plus cleared ledger activity.
- The UI shows actual, projected, and variance values separately.

## Data entry and OCR

- Manual transaction entry is the main first-release workflow.
- Users can also photograph or upload receipts and bills.
- OCR creates an editable draft; it never commits a transaction automatically.
- Low-confidence or mathematically inconsistent fields are highlighted for review.
- CSV and direct bank integrations are postponed.

## Authentication

- Google login through Firebase Authentication is sufficient for the first release.
- Phone OTP and email/password are not first-release requirements.

## Credit, debt, and investments

- Credit cards, loans, EMIs, and investments are included in the first release.
- Credit-card purchases are expenses; credit-card bill payments are transfers and are not counted twice.
- Loan disbursement creates a liability/account movement, not income.
- EMI payments split principal, interest, and fees when details are available.
  *Current implementation (2026-10-28):* the split is calculated and shown per EMI, but the payment
  is posted as one expense; the ledger split is on the roadmap.
- Products bought on EMI and loans share one model with a type (product EMI, card EMI, personal,
  vehicle, home, education, gold, business, other). Users may enter the rate, the EMI, or both;
  with the EMI alone the effective rate is calculated.
- Investment contributions are transfers into an investment account. Fees are expenses and realized income is recorded separately.

## Documentation structure

- Product strategy and scope live in `01-product-plan.md`.
- Screens and interaction design live in `08-ux-plan.md`.
- Confirmed choices live in this file.
- Database schema, API contracts, and the implementation backlog will receive separate documents as they are designed.
