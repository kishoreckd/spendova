# Documentation Roadmap

## Completed foundations

- `PRODUCT_PLAN.md` — product vision and scope.
- `DECISIONS.md` — confirmed choices.
- `UI_UX_PLAN.md` — screen and interaction specification.
- `FINANCIAL_RULES.md` — deterministic financial definitions and formulas.
- `DATABASE_SCHEMA.md` — relational model, ownership, constraints, and migration order.
- `BRAND.md` — agreed working name, brand meaning, positioning, and visual direction.

## Next specifications

1. `API_SPEC.md`
   - endpoint contracts, authentication, validation, errors, pagination, idempotency, and versioning.
2. `DASHBOARD_SPEC.md`
   - exact cards, query definitions, formulas, datasets, filters, drill-downs, and responsive priority.
3. `OCR_PIPELINE.md`
   - capture, upload, storage, extraction, validation, review, deduplication, privacy, and retry behavior.
4. `AI_GEMINI_SPEC.md`
   - permitted use cases, redaction, structured schemas, prompt controls, budgets, evaluation, and fallback.
5. `SECURITY_PRIVACY.md`
   - threat model, Firebase token flow, authorization, encryption, retention, export, deletion, and incident controls.
6. `IMPLEMENTATION_BACKLOG.md`
   - epics, user stories, acceptance criteria, dependencies, release slices, and quality gates.
7. `WIREFRAMES.md` or visual artifacts
   - mobile-first low-fidelity layouts validated against the dashboard and transaction specifications.

## Rule for maintaining these documents

Do not duplicate normative rules. Financial formulas belong in `FINANCIAL_RULES.md`; entities and constraints belong in `DATABASE_SCHEMA.md`; screens belong in `UI_UX_PLAN.md`; API representations belong in `API_SPEC.md`. Other documents link to those sources of truth.
