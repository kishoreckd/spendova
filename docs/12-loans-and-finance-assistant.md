# Loans, EMIs, and the finance assistant

## 1. What the user gets

A person who bought an iPhone on EMI, financed a car, and took a personal loan wants answers to
four questions without opening three lender apps:

| Question | Where Spendova answers it |
|---|---|
| How much leaves my account for EMIs every month? | Loans page hero: **EMIs every month** |
| What does this loan really cost me? | Form preview and loan detail: **total interest**, **total you pay**, **effective rate** |
| When am I free of it? | Card: EMIs paid / tenure; detail: **Ends**; overview: **Debt-free by** |
| What is due now? | Dashboard card: **EMIs due this month**, overdue badge, “ends this month” |

### Adding one

Pick a type (product EMI, card EMI, personal, vehicle, home, education, gold, business, other),
name it (“iPhone 17 Pro”), enter the amount and tenure, then **either** the monthly EMI the shop
quoted **or** the bank's interest rate. The preview updates as you type:

- ₹50,000 at 12% for 12 months → EMI ₹4,442.44, interest ₹3,309, total ₹53,309.
- ₹50,000 at ₹4,600 × 12 (“no-cost EMI” style offer) → effective rate **18.67% p.a.**,
  interest ₹5,200. This is the most useful number for a buyer: it exposes the hidden rate.
- ₹40,00,000 at 8.5% for 20 years → EMI ₹34,712.93, interest ₹43.3 lakh, more than the loan itself.

If the first EMI is in the past, Spendova assumes the EMIs due before today were paid (editable).
“Remind me every month” creates a monthly bill in Plan › Bills in the *Loans & EMIs* category.

### Living with it

- **Pay EMI** (card, detail, or Plan › Bills) records the EMI as an expense from the paying
  account, moves the next due date, and updates progress. The loan closes itself after the last EMI.
- The detail view shows each year's (or month's) **principal vs interest** — early EMIs are mostly
  interest — and the **amount still owed** falling to zero, plus the full schedule table.
- **EMI share of income** compares monthly EMIs with average income of the last three full months:
  ≤ 30% comfortable, ≤ 40% stretched, above that high (Indian lenders usually cap total EMIs at 40–50%).
- Excel export includes a **Loans & EMIs** sheet.

## 2. Why this matters for the planned finance assistant

The assistant must never do arithmetic itself. Spendova computes every number deterministically
(`backend/app/core/finance.py`) and the model only explains, compares, and suggests. Everything it
needs already exists as structured data:

| Signal | Source | Lets the assistant say |
|---|---|---|
| Monthly EMI total, EMI-to-income % | `GET /loans/overview` | “EMIs take 34% of income; a new ₹8,000 EMI would push it to 42%.” |
| Effective rate per loan, remaining interest | `GET /loans` | “Prepay the 18.7% phone EMI before the 9.5% car loan.” |
| Debt-free date, loans ending this month | `GET /loans/overview` | “From December ₹4,442 a month is freed — move it into your SIP.” |
| Income, spending, cash flow by month | `GET /dashboard`, transactions | “You saved ₹18k/month on average over the last 3 months.” |
| Budgets and overspend | `GET /budgets/{id}/status` | “Food is 20% over budget for the third month.” |
| Goals and monthly amount required | `GET /goals` | “At this rate the bike goal finishes in 14 months, not 10.” |
| Cost per day and replacement goals | `GET /assets` | “Your phone now costs ₹55/day; it reaches your ₹40/day target in May.” |
| Bills, income, and investment plans | `GET /recurring-rules` | “Committed outflows this month: ₹41k of ₹95k.” |

### Typical questions it can answer well

- **“Can I afford a ₹1.2 lakh laptop on 12-month EMI?”** — run `/loans/preview` for the offer, add
  the EMI to current commitments, recompute EMI-to-income and monthly surplus, compare with goals.
- **“Should I buy now or save for it?”** — compare total interest of the EMI against months needed
  with the purchase planner at the current saving rate.
- **“How much will I have in a year?”** — average surplus × 12, plus EMIs that end during the year,
  plus planned investment contributions with their projected returns.
- **“Which loan should I close first?”** — rank by effective rate and remaining interest.

## 3. Recommended next step: one snapshot endpoint

Add `GET /api/v1/insights/snapshot` that assembles the numbers above into one JSON document
(amounts rounded, no merchant names or notes unless the user opts in). The chat sends this
snapshot plus the question to the model with a fixed system prompt:

1. Use only numbers from the snapshot; if something is missing, say so.
2. For “what if” questions, call tools (`preview_loan`, `purchase_goal`) instead of estimating.
3. Show the calculation the answer depends on; never present advice as certainty.

Spendova must remain fully usable with the assistant disabled.

## 4. Known limits

- An EMI payment is one expense; principal and interest are not yet split in the ledger.
- Floating rates, part-prepayments, and moratoriums are not modelled yet (roadmap).
- Processing fee is counted in the total cost but not posted as a transaction automatically.

## Implemented finance assistant (2026-10-29)

Open **More > Finance Assistant** (`/assistant`). Local summaries, repayment priorities,
a purchase calculator and optional conversational AI are available.

- `GET /api/v1/insights/snapshot`: signed-in user, user timezone, base currency. Income/spending
  average the last three complete calendar months including zero months. Only cleared
  income/expenses count. Transfers and other currencies are excluded.
- Headroom = average income - average spending - planned goal savings. Spending already includes
  recorded EMIs, so do not subtract them twice. Headroom is **not an affordability approval**:
  new bills, unrecorded payments, investment transfers, emergency reserves and down-payment
  liquidity are not inferred. Missing income history is flagged.
- Purchase check calculates financed principal, EMI, interest, repayment, total outlay, headroom
  after the new EMI, EMI/income percentage and save-first months using Decimal. Save-first assumes
  saving all headroom from zero, constant prices and no returns. Processing fees are excluded.
- `POST /api/v1/insights/chat`: `{question, history?, scenario?, use_ai?}`. Scenario is
  `{price, down_payment, months, annual_rate}`. Amounts are decimal strings. History accepts up to
  12 user/assistant turns. Reply: `{answer, mode, snapshot, calculation}` in the standard envelope.
- AI uses the Responses API (`store=false`), at most two model calls and one validated read-only
  `check_purchase` tool per question. The model explains server numbers. No writes or market tools.
  Model text can still be wrong; the server calculation panel is authoritative.
- Optional **backend Vercel** variables: `OPENAI_API_KEY`, `FINANCE_ASSISTANT_MODEL` (default
  `gpt-4.1-mini`), `RATE_LIMIT_ASSISTANT_REQUESTS` (10 per IP/window per instance). Redeploy.
  No key in the frontend or `VITE_*`; local features work without a key.
- **Use AI** is explicit opt-in: sends question, recent chat and aggregate financial context to
  OpenAI. Snapshot excludes email, merchant names, notes, account identifiers and loan names.
  Questions can themselves contain personal data. `store=false` does not imply zero retention.
- Chats stay in page memory and clear on new chat, navigation or reload. No schema migration.
  Provider failures return generic 503 errors; retry or switch to local mode.
- Remaining scope: budget trends, asset replacement, recurring commitment forecasts, prepayment
  quotes, investment return projections and specific investment product selection.

Integration references: [Responses](https://developers.openai.com/api/reference/cli/resources/responses/methods/create)
and [function calling](https://developers.openai.com/api/docs/guides/function-calling).

## Daily limits, deposit tool and Settings (2026-11-05)

Settings > Finance assistant & email now controls the per-user daily allowance and four reminder
opt-ins. Default 20,000 tokens/day; operator maximum 100,000. 0 pauses AI. Counter/reset details
are server-derived and persist across sign-out, browser reloads, restarts and server instances.
Midnight in FINANCE_ASSISTANT_RESET_TIMEZONE (default Asia/Kolkata) starts a new day without cron.
Profile timezone changes cannot reset the AI day. Settings changes never clear prior charges.
Tokens include every provider call. Before a call the server reserves a conservative allowance;
reported total_tokens settles once. Missing usage or timeouts keep the reservation, so a large
request can be rejected with positive remaining tokens. Local summaries/calculators remain usable.

New operator settings: FINANCE_ASSISTANT_DAILY_TOKEN_LIMIT,
FINANCE_ASSISTANT_MAX_DAILY_TOKENS and FINANCE_ASSISTANT_RESET_TIMEZONE. Runtime backend only.
At most two model calls and one read-only calculation tool per question: check_purchase or
project_deposit. FD/RD questions require explicit amount, annual rate, deposit type and tenure.
The server performs Decimal maths and returns the calculation panel. Deposits recorded in Accounts
also appear anonymously in the snapshot. Maturity/interest are estimates, not a bank quotation.
Neither the agent nor scheduled jobs move money or connect to banks.

Earlier sections listing notifications as future work are superseded by the implemented opt-in
reminders in docs/11-email-delivery.md. Budget/asset conversational context and full cash-flow
forecasts remain future enhancements. Live OpenAI calls still require a backend key and opt-in.
