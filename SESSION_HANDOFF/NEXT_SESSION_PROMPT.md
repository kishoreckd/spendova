# Prompt for a New Session

Copy the following into the next session:

```text
Continue developing Spendova from this repository:
C:\Users\CXO\OneDrive - CXOntology Inc\expense

First read CLAUDE.md, then SESSION_HANDOFF/CURRENT_STATUS.md and NEXT_STEPS.md, then
docs/02-architecture.md and docs/03-financial-rules.md before changing code. Use the
skills in .claude/skills/ for backend, frontend, migrations, money maths, UX, email,
and the security checklist.

Current state: backend 0.8.0 with the Vaultessa-style structure, migration head
20261028_0014 (Supabase last confirmed at 0005; the GitHub migrate-database workflow
applies the rest). Backend and frontend both deploy on Vercel (no Railway); email uses
Mailpit locally and Brevo SMTP in production. 96 backend tests pass; frontend npm run check passes. Loans & EMIs are implemented end
to end. The restructure is on branch refactor/vaultessa-structure and not committed.

Conventions: features own api/<feature> calls and TanStack Query hooks; forms use
react-hook-form + zod with the shared Field, FormAlert, MoneyInput, DatePicker,
TilePicker, AccountSelect, ConfirmDialog, Button loading, and notify helpers. No
explanatory copy in the UI. Check every screen at mobile width and on desktop.

Priority: commit and deploy (backend before frontend, with the production env vars
set), real-device QA, then the insights snapshot endpoint for the finance assistant.

Never read aloud, print, commit, or expose backend/.env. Commit only when asked.
Verify changes with tests/builds and update the handoff before stopping.
```
