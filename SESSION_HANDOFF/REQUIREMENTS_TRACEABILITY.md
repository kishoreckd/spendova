# Requirements Traceability

| Requirement | Current state | Primary references |
|---|---|---|
| Personal single-user finance app | Confirmed | `DECISIONS.md` |
| User-selected country/currency | Backend profile fields exist; UI integration pending | `DECISIONS.md`, `app/models.py` |
| Google sign-up/login | Backend contract exists; Firebase frontend pending | `app/api/auth.py`, `app/auth.py` |
| Manual transactions | Backend and initial sheet/API helper exist | `app/api/transactions.py`, `transaction-sheet.tsx` |
| Receipt OCR | UI placeholder only | `features/receipts/page.tsx` |
| Multiple accounts/cards | Basic multiple accounts exist; subtype logic pending | `app/api/accounts.py` |
| Loans/EMIs/investments | Planned, not fully implemented | `DATABASE_SCHEMA.md` |
| Custom categories | Backend plus frontend local store/UI exist; integration pending | `app/api/categories.py` |
| Monthly/year analytics | Backend month/year dashboard exists; frontend mocks remain | `app/api/dashboard.py` |
| Budgets | Backend implemented; frontend integration pending | `app/api/budgets.py` |
| Recurring salary/bills/subscriptions | Backend rules implemented; worker/UI integration pending | `app/api/recurring.py` |
| Purchase goals | Basic goal and contribution backend exists; target-date expansion pending | `app/api/goals.py` |
| Owned asset age/cost per day | Implemented in backend and designed in UI | `app/models.py`, `features/assets/page.tsx` |
| Replacement guidance | UI concept exists; authoritative backend assessment pending | `PRODUCT_PLAN.md` |
| Gemini insights | Planned, not implemented | `PRODUCT_PLAN.md` |
| Mobile responsiveness | Shared mobile pass completed; real devices pending | `app-shell.tsx`, `index.css` |
| shadcn component approach | Implemented | `frontend/src/components/ui/` |
| Modular routed frontend | Implemented structurally | `frontend/src/app/router.tsx` |
| PostgreSQL database | Connected through Supabase | `backend/app/database.py` |
| Schema migrations | Three Alembic migrations at head | `backend/migrations/` |
| Frontend deployment | Planned for Vercel, not deployed | `SESSION_HANDOFF/FULL_CONTEXT.md` |
| Backend deployment | Railway-ready Docker image; not deployed | `backend/Dockerfile`, `backend/README.md` |
