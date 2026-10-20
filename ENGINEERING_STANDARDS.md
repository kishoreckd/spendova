# Spendova Engineering Standards

These rules are release gates, not optional preferences.

## Structure

- Organize frontend code by feature: auth, accounts, transactions, planning, and assets.
- Keep shared shadcn primitives in `components/ui`; business logic must stay outside it.
- Keep route components thin and target fewer than 250 lines per authored component.
- Put deterministic financial calculations in pure, independently tested functions.
- Access HTTP only through typed service/query modules.

## Quality gates

- TypeScript strict build, lint, and formatting checks must pass.
- Unit tests are required for financial calculations and validation.
- Integration tests are required for queries and mutations.
- Mobile and desktop E2E tests must cover authentication, accounts, transactions, budgets, goals, and assets.
- Accessibility checks must cover labels, focus, keyboard use, reduced motion, contrast, and screen-reader names.
- Route-level code splitting and a bundle budget are required before production.

## Financial and data safety

- Use decimal values or integer minor units for persisted money.
- Derive balances from immutable balanced ledger entries.
- Treat transfers separately from income and expenses.
- Require idempotency for financial writes.
- Scope every record and query to the authenticated user.
- Never store full card numbers, passwords, tokens, or Gemini keys in frontend storage.
- OCR and AI may create drafts or explanations, never automatic cleared transactions.

## Frontend audit — 2026-09-30

Passed: strict TypeScript build, shadcn primitives, responsive shell, deterministic planning functions, and production compilation.

Required before production:

Completed in the first architecture pass: `App.tsx` is now a minimal router provider, navigation uses real URLs, the application shell is shared, and major routes are lazy-loaded. The main bundle is below the 500 kB warning threshold.

Remaining requirements:

The transitional `product-pages.tsx` module has been removed. Authentication, dashboard, transactions, planning, reports, accounts, categories, assets, receipts, settings, profile, and More now have independent route modules and production chunks.

Remaining requirements:

1. Replace prototype `localStorage` financial records with authenticated API queries and mutations.
2. Add Vitest/Testing Library, MSW integration tests, and Playwright E2E tests.
3. Add error boundaries and route-level empty, error, and offline states.
4. Complete accessibility and real-device visual QA.

The frontend is a validated interactive prototype, not yet a production release.
