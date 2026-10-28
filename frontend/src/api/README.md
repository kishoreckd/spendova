# API layer

- `client.ts` — `apiFetch` adds the Firebase ID token, unwraps the `{status, message, data}`
  envelope, and throws `ApiError` with `status`, `code`, and per-field `fieldErrors`.
- `<feature>/api.ts` — typed calls for one backend router; `<feature>/types.ts` — its contracts.

Rules: money is sent as decimal strings, writes that must not repeat pass an idempotency key,
and components never call `fetch` directly. Wrap calls in TanStack Query hooks inside the
feature folder (`features/<feature>/hooks.ts`).
