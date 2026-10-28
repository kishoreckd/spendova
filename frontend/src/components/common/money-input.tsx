import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { controlProps } from "@/lib/forms";

/** Decimal-keypad amount field with the user's currency symbol in front. */
export function MoneyInput({
  id,
  symbol,
  error,
  className,
  ...props
}: React.ComponentProps<"input"> & {
  id: string;
  symbol: string;
  error?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-11 overflow-hidden rounded-lg border border-input transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 sm:h-9",
        error &&
          "border-destructive ring-3 ring-destructive/20 focus-within:border-destructive",
        className,
      )}
    >
      <span className="grid min-w-10 shrink-0 place-items-center border-r bg-muted/50 px-2.5 text-muted-foreground">
        {symbol}
      </span>
      <Input
        {...controlProps(id, error)}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        className="h-full rounded-none border-0 shadow-none focus-visible:ring-0 sm:h-full aria-invalid:ring-0"
        {...props}
      />
    </div>
  );
}
