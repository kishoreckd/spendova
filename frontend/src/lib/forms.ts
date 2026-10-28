import { toast } from "sonner";
import { z } from "zod";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "@/api/client";
import { localDateISO } from "@/lib/format";

/**
 * Feedback conventions used by every form:
 * - field problems appear under the field (client rules first, server rules after submit);
 * - problems that are not about one field appear in a FormAlert beside the submit button;
 * - completed saves and page-level actions are confirmed with a toast.
 */

const MONEY_PATTERN = /^\d{1,15}(\.\d{1,2})?$/;

/** A required amount kept as a decimal string, e.g. "1250.50". */
export const money = (label = "an amount") =>
  z
    .string()
    .trim()
    .min(1, `Enter ${label}`)
    .transform((value) => value.replace(/,/g, ""))
    .refine(
      (value) => MONEY_PATTERN.test(value),
      "Use numbers only, with up to 2 decimals",
    )
    .refine((value) => Number(value) > 0, "Must be more than zero");

/** Same as `money` but may be left empty, or be zero when `allowZero` is set. */
export const optionalMoney = ({ allowZero = false } = {}) =>
  z
    .string()
    .trim()
    .transform((value) => value.replace(/,/g, ""))
    .refine(
      (value) => !value || MONEY_PATTERN.test(value),
      "Use numbers only, with up to 2 decimals",
    )
    .refine(
      (value) => !value || allowZero || Number(value) > 0,
      "Must be more than zero",
    );

export const requiredText = (message: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, message)
    .max(max, `Keep this under ${max} characters`);

export const pastOrToday = (message = "Choose a date") =>
  z
    .string()
    .min(1, message)
    .refine(
      (value) => value <= localDateISO(),
      "This date can't be in the future",
    );

/** Accessibility wiring for a control rendered inside `<Field id={id}>`. */
export function controlProps(id: string, error?: string) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  } as const;
}

export function errorMessage(reason: unknown, fallback: string) {
  if (reason instanceof Error && reason.message) return reason.message;
  return fallback;
}

/**
 * Copies server validation messages onto matching form fields.
 * `fieldMap` keys are API paths ("lines.0.amount_limit") or just the last segment ("amount_limit").
 * Returns the message to show in a FormAlert when no field claimed it.
 */
export function applyServerErrors<T extends FieldValues>(
  reason: unknown,
  setError: UseFormSetError<T>,
  fieldMap: Partial<Record<string, Path<T>>>,
  fallback: string,
) {
  if (reason instanceof ApiError) {
    let matched = false;
    for (const [path, message] of Object.entries(reason.fieldErrors)) {
      const field = fieldMap[path] ?? fieldMap[path.split(".").at(-1) ?? path];
      if (field) {
        setError(field, { type: "server", message }, { shouldFocus: !matched });
        matched = true;
      }
    }
    if (matched) return "";
  }
  return errorMessage(reason, fallback);
}

export function notifySuccess(message: string, description?: string) {
  toast.success(message, { description });
}

export function notifyError(reason: unknown, title: string) {
  toast.error(title, {
    description: errorMessage(reason, "Please try again."),
    duration: 6000,
  });
}
