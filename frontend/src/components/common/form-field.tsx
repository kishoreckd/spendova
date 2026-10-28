import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "cn";
import { Label } from "@/components/ui/label";

type FieldProps = {
  /** Id of the control; links the label and error message to it. */
  id: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  /** Small control rendered beside the label, such as "Add category". */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
};

/**
 * Label, control and message stacked consistently. Pair the control with
 * `controlProps(id, error)` so assistive technology announces the error.
 */
export function Field({
  id,
  label,
  error,
  hint,
  optional,
  action,
  className,
  children,
}: FieldProps) {
  return (
    <div
      data-slot="field"
      data-invalid={error ? true : undefined}
      className={cn("min-w-0 space-y-2", className)}
    >
      <div className="flex min-h-5 items-center justify-between gap-2">
        <Label htmlFor={id} className={cn(error && "text-destructive")}>
          {label}
          {optional && (
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          )}
        </Label>
        {action}
      </div>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="flex items-start gap-1.5 text-xs font-medium text-destructive animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Banner for errors that do not belong to a single field. */
export function FormAlert({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive animate-in fade-in duration-150"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}
