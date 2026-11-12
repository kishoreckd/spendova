import {
  clearSession,
  getAccessToken,
  getSessionEpoch,
  setAccessToken,
} from "@/lib/session";

const API_URL = (import.meta.env.VITE_API_BASE_PATH ?? "/api/v1").replace(
  /\/$/,
  "",
);
if (!API_URL.startsWith("/") || API_URL.startsWith("//")) {
  throw new Error(
    "VITE_API_BASE_PATH must be a same-origin path such as /api/v1",
  );
}

export class ApiError extends Error {
  readonly status: number;
  /** Stable machine code from the server, e.g. NOT_FOUND or VALIDATION_ERROR. */
  readonly code: string;
  /** Server validation messages keyed by request field path, e.g. "name" or "lines.0.amount_limit". */
  readonly fieldErrors: Record<string, string>;

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

type ErrorData = {
  code?: string;
  details?: Array<{ path?: string; message?: string }>;
};

export type ApiEnvelope<T> =
  | { status: "success"; message: string; data: T }
  | { status: "error"; message: string; data: ErrorData | null };

type RequestOptions = {
  skipRefresh?: boolean;
  signal?: AbortSignal;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Makes retried writes safe: the server returns the original result for a repeated key. */
  idempotencyKey?: string;
};

function fieldErrorsFrom(data: ErrorData | null | undefined) {
  return Object.fromEntries(
    (data?.details ?? [])
      .filter((item) => item.path && item.message)
      .map((item) => [item.path as string, item.message as string]),
  );
}

/** Calls the Spendova API and unwraps the `{status, message, data}` envelope. */
export async function apiFetch<T>(
  path: string,
  {
    method = "GET",
    body,
    idempotencyKey,
    signal,
    skipRefresh = false,
  }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const requestEpoch = getSessionEpoch();
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const token = getAccessToken();
  signal?.throwIfAborted();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      signal,
      credentials: "include",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (reason) {
    if (signal?.aborted) throw reason;
    throw new ApiError(
      0,
      "NETWORK",
      "Spendova can't be reached right now. Check your connection and try again.",
    );
  }
  if (
    response.status === 401 &&
    !skipRefresh &&
    !path.startsWith("/auth/login") &&
    !path.startsWith("/auth/register") &&
    !path.startsWith("/auth/refresh") &&
    !path.startsWith("/auth/password-reset")
  ) {
    if (getSessionEpoch() !== requestEpoch)
      throw new ApiError(
        401,
        "SESSION_CHANGED",
        "The signed-in account changed. Please try again.",
      );
    await refreshAccessToken();
    signal?.throwIfAborted();
    return apiFetch<T>(path, {
      method,
      body,
      idempotencyKey,
      signal,
      skipRefresh: true,
    });
  }
  if (response.status === 204) return undefined as T;

  const envelope = (await response
    .json()
    .catch(() => null)) as ApiEnvelope<T> | null;
  signal?.throwIfAborted();
  if (!response.ok || envelope?.status === "error") {
    const data = envelope?.status === "error" ? envelope.data : null;
    throw new ApiError(
      response.status,
      data?.code ?? "INTERNAL",
      envelope?.message ??
        (response.status >= 500
          ? "Spendova is temporarily unavailable. Please try again shortly."
          : "The request could not be completed. Please try again."),
      fieldErrorsFrom(data),
    );
  }
  if (!envelope || envelope.status !== "success") {
    throw new ApiError(
      response.status,
      "INTERNAL",
      "Unexpected response from Spendova.",
    );
  }
  return envelope.data;
}

let refreshing: Promise<void> | null = null;
export function refreshAccessToken(): Promise<void> {
  if (refreshing) return refreshing;
  const epoch = getSessionEpoch();
  const run = async () => {
    try {
      if (getSessionEpoch() !== epoch) throw new Error("Session changed");
      const data = await apiFetch<{ access_token: string }>("/auth/refresh", {
        method: "POST",
        skipRefresh: true,
      });
      if (getSessionEpoch() !== epoch) throw new Error("Session changed");
      setAccessToken(data.access_token);
    } catch (reason) {
      if (
        reason instanceof ApiError &&
        reason.status === 401 &&
        getSessionEpoch() === epoch
      )
        clearSession();
      throw reason;
    }
  };
  refreshing = (
    typeof navigator !== "undefined" && navigator.locks
      ? navigator.locks.request("spendova-refresh", run)
      : run()
  ).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function waitForRefresh() {
  await refreshing?.catch(() => undefined);
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
