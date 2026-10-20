# Spendova

> Resuming this project in a new session? Start with
> [`SESSION_HANDOFF/START_HERE.md`](SESSION_HANDOFF/START_HERE.md).

Spendova is now an executable mobile-first personal finance application with a React/shadcn frontend and FastAPI foundation.

## Run the application

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. To run the API and PostgreSQL together, use `docker compose up --build` from the project root. API documentation is then available at `http://localhost:8000/docs`.

## Verify

Run `npm run build` in `frontend`, and `py -m pytest` in `backend` after installing `backend/requirements.txt`.

Planning is separated by concern:

- [PRODUCT_PLAN.md](./PRODUCT_PLAN.md) — vision, architecture, product behavior, and delivery phases.
- [UI_UX_PLAN.md](./UI_UX_PLAN.md) — dashboards, screens, interactions, responsive behavior, and shadcn/ui mapping.
- [DECISIONS.md](./DECISIONS.md) — confirmed choices and financial behavior decisions.
- [FINANCIAL_RULES.md](./FINANCIAL_RULES.md) — authoritative calculations, ledger behavior, and edge cases.
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) — relational entities, constraints, ownership, and indexes.
- [DOCUMENTATION_ROADMAP.md](./DOCUMENTATION_ROADMAP.md) — completed and upcoming specifications.
- [BRAND.md](./BRAND.md) — name meaning, positioning, messaging, and future logo direction.

The proposed product is a mobile-first personal finance and purchase-planning application built with React, TypeScript, shadcn/ui, FastAPI, PostgreSQL, Firebase Authentication, and an optional privacy-controlled Gemini insight layer.
