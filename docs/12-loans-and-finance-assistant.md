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
