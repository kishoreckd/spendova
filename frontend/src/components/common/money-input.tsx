import { cn } from "cn";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
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
    <InputGroup
      className={cn(
        "overflow-hidden",
        error &&
          "border-destructive ring-3 ring-destructive/20 focus-within:border-destructive",
        className,
      )}
    >
      <InputGroupInput
        {...controlProps(id, error)}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        {...props}
      />
      <InputGroupAddon
        className="min-w-10 border-r bg-muted/50 px-2.5"
        align="inline-start"
      >
        {symbol}
      </InputGroupAddon>
    </InputGroup>
  );
}
