import { auth } from "@/lib/firebase";

const API_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1"
).replace(/\/$/, "");

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
  { method = "GET", body, idempotencyKey }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const token = await auth.currentUser?.getIdToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      0,
      "NETWORK",
      "Spendova can't be reached right now. Check your connection and try again.",
    );
  }
  if (response.status === 204) return undefined as T;

  const envelope = (await response
    .json()
    .catch(() => null)) as ApiEnvelope<T> | null;
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

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
