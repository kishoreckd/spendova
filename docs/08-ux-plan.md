# UI/UX Plan

## 1. Experience principles

- Design mobile-first for fast, one-handed entry.
- Make actual money, projected money, pending data, and AI suggestions visually distinct.
- Every dashboard number must open the transactions or calculation behind it.
- Never communicate financial state using color alone.
- Reveal advanced functions progressively so the default experience remains calm.
- Compose a finance-specific design system from shadcn/ui primitives.

## 2. Responsive application shell

### Mobile navigation

Use a fixed bottom bar with five destinations:

1. `Home`
2. `Transactions`
3. `Add`
4. `Plan`
5. `More`

The prominent central `Add` action opens a shadcn `Drawer`. Complex or multi-step forms use full pages.

### Tablet and desktop navigation

- Replace the bottom bar with shadcn `Sidebar`.
- Use a top bar for the page title, date range, global search, notifications, and profile.
- Flow dashboard cards from one column on phones to two on tablets and a 12-column desktop grid.
- Let wide screens improve comparison rather than stretch content.

## 3. Onboarding

### Welcome and login

- Product value statement.
- `Continue with Google` primary button.
- Privacy and terms links.
- Components: `Card`, `Button`, `Separator`.

### Regional setup

- Country, base currency, locale/date format, and time zone.
- Detect sensible defaults but allow editing.
- Components: searchable `Combobox`, `Select`, `Button`.

### Income setup

- Monthly or annual salary.
- Gross or take-home salary.
- Amount and currency.
- Pay frequency: monthly, twice monthly, every four weeks, biweekly, weekly, or custom.
- Expected pay date and destination account.
- Preview the original salary, normalized monthly planning income, and next expected payment.
- Explain that expected salary is projected until received.
- Components: `RadioGroup`, `Input`, `Select`, `Calendar`, `Alert`.

### Account setup

- Suggested types: cash, bank, credit card, loan, and investment.
- Name, currency, opening/current balance, and balance date.
- Explicitly confirm opening balances because they affect later totals.

### Preferences and finish

- Choose a suggested category set.
- Optional monthly budget and emergency-fund floor.
- Separate consent controls for receipt OCR and Gemini insights.
- Finish with a configuration summary and actions for `Go to dashboard` or `Add first expense`.

Onboarding must be resumable. Optional fields can be skipped without silently storing zero.

## 4. Home dashboard

### Header

- Greeting, selected reporting period, notifications, and profile.
- Date range uses shadcn `Popover` and `Calendar` with week, month, year, and custom presets.

### Financial overview

The hero card shows:

- available to spend;
- actual income received;
- actual spending;
- projected remaining income;
- net cash flow;
- comparison with the previous equivalent period.

Projected salary must use a distinct label/style and never be included in available cash without explanation.

### Spending trend

- Week, month, year, and custom controls.
- Daily/monthly expense line or area chart.
- Optional previous-period comparison.
- Tapping a point opens its filtered transactions.
- Components: shadcn chart wrapper with Recharts, `Tabs`, `Tooltip`, `Skeleton`.

### Category breakdown

- Donut chart plus a ranked text list.
- Amount, percentage, and change from comparison period.
- Selecting a category opens its underlying transactions.
- Always provide a text/table alternative for accessibility.

### Commitments

- Upcoming credit-card amount due.
- Next EMI and loan payments.
- Recurring bills before the next salary date.
- Reserved amount versus currently unfunded amount.

### Budget health

- Overall progress.
- Three categories closest to their limits.
- Labeled states: `On track`, `Watch`, and `Exceeded` using icon, text, and color.

### Goals and assets

- Top savings goal with progress, monthly requirement, and predicted completion date.
- Asset reviews appear only for scheduled reviews, warranty events, or notable repair costs.
- Use neutral wording such as `Review recommended`, not pressure to replace something.

### AI insight

- Show at most one concise Gemini-assisted insight on Home.
- Include supporting numbers, generation time, `Why am I seeing this?`, feedback, and dismiss actions.
- The dashboard remains fully useful when AI is disabled or unavailable.

### Recent transactions

- Five latest items with merchant, category, account, status, and amount.
- Mobile swipe may expose edit/duplicate; destructive actions require confirmation.

### Dashboard states

- New user: guided checklist instead of meaningless zero charts.
- Loading: shape-matched `Skeleton` components.
- Partial error: each card retries independently.
- Offline: last synchronization time and pending drafts.
- No income configured: setup prompt that does not block expense tracking.

## 5. Transaction experience

### Quick-add drawer

Field order:

1. Expense, income, or transfer.
2. Large amount input and currency.
3. Category.
4. Account, or source and destination accounts for transfers.
5. Merchant/payee.
6. Date, defaulting to now.
7. Optional note, tags, receipt, split, and recurrence.

Keep `Save` sticky above the safe area and preserve accidental drawer closures as drafts.

### Receipt/bill OCR

1. Select camera or gallery.
2. Crop, rotate, and review image quality.
3. Upload and display processing progress.
4. Show an editable transaction draft beside or below the receipt.
5. Highlight low-confidence merchant, date, total, tax, currency, and line items.
6. Warn if line items plus tax do not match the detected total.
7. Commit only after user confirmation.

Suggested components: `Drawer`, file input, `Progress`, `Skeleton`, `Alert`, `Form`, `Badge`, `Accordion`, `Dialog`.

### Transaction list

- Mobile: cards grouped by date with sticky date headings.
- Desktop: shadcn `DataTable`.
- Search merchant, notes, tags, categories, and amounts.
- Filter `Sheet` for date, type, category, account, status, currency, and amount range.
- Show active filters as removable `Badge` elements.
- Recalculate visible totals for the current filters.

### Transaction detail

- Amount, type, account, category/splits, receipt, timestamps, and sync status.
- Links to related transfer, refund, EMI, recurring rule, or goal contribution.
- Contextual edit, duplicate, refund, reverse, and delete actions.

## 6. Analytics and reports

### Overview

- Persistent date and comparison controls.
- Income, expense, cash flow, savings rate, and average daily spending metrics.
- Trend, category, merchant, cash-flow, and calendar-heatmap sections.

### Drill-down behavior

Selecting a chart element must update a visible filter summary and reveal the supporting transactions. Store filters in the URL for sharing/bookmarking within the signed-in app.

### Month view

- Daily cumulative spending against budget pace.
- Category breakdown.
- Fixed commitments versus discretionary spending.
- Expected remaining income and upcoming obligations.

### Year view

- Monthly income versus expense bars.
- Net cash-flow line.
- Category movement across months.
- Highest and lowest spending months.
- Recurring versus discretionary split.
- Year-over-year comparison when prior data exists.

## 7. Credit, debt, and investments

### Credit-card detail

- Outstanding and statement balances, due date, and available credit.
- Purchases in the current statement cycle.
- Minimum-due versus full-payment warning.
- `Record payment` creates a transfer from a bank account.

### Loan detail

- Original and outstanding principal, rate, tenure, and next due date.
- Principal versus interest/fees paid.
- Repayment schedule and progress.
- Clearly labeled prepayment estimate.

### EMI view

- Active EMIs with monthly amount, remaining payments, next date, and remaining commitment.
- Calendar and list modes.
- Commitments feed both the dashboard and affordability calculations.

### Investment overview

- Total contributions and latest known/user-provided value.
- Show gain/loss only when valuation data is reliable.
- Contributions are transfers, not expenses, while their effect on liquid cash remains visible.
- Do not provide investment recommendations in the first release.

## 8. Planning area

The Plan landing page contains budgets, savings goals, purchase planning, assets/replacement reviews, and monthly commitments.

### Purchase planner

- Item, price, target date, and priority.
- Current allocated savings, expected trade-in, inflation, and protected emergency reserve.
- Cash versus financing assumptions.
- Results: monthly saving required, earliest safe date, funding gap, commitment impact, and alternative scenarios.
- `Slider` is for exploration; numeric fields remain available for precision.

### Goal detail

- Accessible progress value.
- Contribution history.
- Current versus required saving rate.
- Completion projection.
- Pause, edit, contribute, and link-transaction actions.

### Asset detail

- Product facts, age, warranty, maintenance timeline, and ownership cost.
- Condition questionnaire and linked replacement goal.
- Explainable `Keep`, `Monitor`, `Repair`, or `Consider replacement` result.

## 9. Categories and settings

### Categories

- Income and expense tabs.
- Reorder, add, edit, icon, color, parent, and budget behavior.
- Provide accessible alternatives to drag-and-drop ordering.
- Archive categories referenced by transactions instead of deleting them.
- Country-specific defaults are suggestions, not irreversible rules.

### Settings

- Profile and regional preferences.
- Accounts and starting balances.
- Categories and tags.
- Income schedule.
- Notifications and quiet hours.
- AI and OCR privacy controls.
- Security and active sessions.
- Export and account deletion.
- Theme and accessibility.

## 10. shadcn/ui component map

- Navigation: `Sidebar`, `NavigationMenu`, `Breadcrumb`, `DropdownMenu`.
- Mobile overlays: `Drawer`, `Sheet`, `Dialog`, `AlertDialog`.
- Forms: `Form`, `Input`, `Select`, `Combobox`, `Calendar`, `Popover`, `Textarea`, `Checkbox`, `RadioGroup`, `Switch`.
- Data: `Card`, `Table`/`DataTable`, `Accordion`, `ScrollArea`.
- Search/filtering: `Command`, `Popover`, `Badge`.
- Feedback: `Sonner`, `Alert`, `Progress`, `Skeleton`, `Tooltip`.
- Organization: `Tabs`, `Separator`, `Collapsible`.
- Analytics: shadcn chart composition backed by Recharts.
- Icons: Lucide with visible labels for ambiguous actions.

Create reusable composed components: `MoneyInput`, `AccountPicker`, `CategoryPicker`, `DateRangePicker`, `FinancialMetric`, `TransactionRow`, `ChartCard`, and `EmptyState`.

## 11. Visual and accessibility system

- Neutral surfaces with restrained semantic accents.
- Semantic tokens for income, expense, transfer, debt, warning, success, projected, and pending.
- Tabular numerals for financial values.
- Comfortable density on mobile and optional compact desktop tables.
- Light, dark, and system themes.
- WCAG-compatible contrast, keyboard focus, reduced motion, and screen-reader labels.
- Minimum 44px touch targets and mobile safe-area support.
- Never display more decimal precision than the currency supports unless required.

## 12. UI delivery sequence

1. Tokens, responsive shell, and navigation.
2. Google authentication and onboarding.
3. Quick-add transaction and transaction list/detail.
4. Receipt OCR review flow.
5. Dashboard with real data states and drill-down.
6. Credit-card, loan, EMI, and investment screens.
7. Analytics month/year/custom-range views.
8. Budgets, goals, and purchase planner.
9. Assets and replacement review.
10. Settings, accessibility, offline behavior, and responsive polish.

Each screen must cover populated, empty, loading, error, offline, and permission-denied states where applicable.
