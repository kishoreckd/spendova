# Ordered Next Steps

## 1. Rotate and verify secrets

- Reset the Supabase database password because the temporary password appeared
  in chat.
- Update only `backend/.env` or the deployment secret store.
- Re-run `alembic current` and `alembic upgrade head`.
- Never commit `.env`.

## 2. Verify Firebase Google authentication in the browser

- Confirm `localhost` is listed in Firebase Authentication authorized domains.
- Start FastAPI and Vite, complete one real Google sign-in, and verify the user
  row including `photo_url` in PostgreSQL.
- Add the eventual Vercel/custom domain to Firebase authorized domains.
- Add the same public Vite values to Vercel and server-only auth settings to
  Cloud Run.
- Enable Firebase Authentication's Email/Password provider.
- Local OTP delivery currently uses console/development mode. Configure SMTP
  secrets and set `EMAIL_DELIVERY_MODE=smtp` for real inbox delivery.

## 3. Build the shared frontend data layer

- Central authenticated fetch client.
- React Query provider, query keys, typed requests, mutation invalidation.
- Consistent loading skeletons, empty states, errors, and retry behavior.
- Generate or validate types against FastAPI OpenAPI.

## 4. Replace frontend mock data

Recommended order:

1. Authentication, profile, onboarding.
2. Categories and accounts.
3. Transactions and dashboard.
4. Goals and contributions.
5. Budgets and recurring rules.
6. Assets.
7. Reports.

## 5. Finish backend MVP modules

- Credit-card details, statements, and bill-payment rules.
- Loans, EMI schedules, principal/interest/fee allocation.
- Investment valuations.
- Transaction splits, refunds, and explicit reversals.
- Goal target dates and daily/weekly/monthly saving requirements.
- Recurring occurrence projection/materialization worker.
- User data export and account deletion.

## 6. Receipt OCR

- Private object storage.
- File type/size validation and duplicate hashing.
- OCR job and editable draft workflow.
- Never create a cleared transaction without user confirmation.

## 7. Gemini and notifications

- Gemini receives minimized derived facts, never database credentials.
- Deterministic code remains authoritative for financial calculations.
- Add transactional outbox and reminders.
- Application must work fully when Gemini is disabled.

## 8. Repository and CI/CD

- Initialize or correctly clone/connect the Git repository.
- Confirm `.gitignore` protects `.env`, databases, virtual environments, and
  build artifacts.
- Add path-filtered frontend/backend CI.
- Deploy backend to Cloud Run first.
- Deploy frontend to Vercel with root directory `frontend`.
- Set `VITE_API_URL` to the Cloud Run `/api/v1` URL.
- Set production CORS to the final Vercel/custom domain.

## 9. Release verification

- Backend and frontend test suites.
- Real iPhone Safari and Android Chrome testing.
- Cross-user isolation and authorization tests.
- Migration/backup/restore rehearsal.
- Accessibility and performance review.
- Secret scanning before the first public push.
