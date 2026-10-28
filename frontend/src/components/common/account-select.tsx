import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";
import type { AccountItem } from "@/api/accounts/types";
import { Field } from "@/components/common/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { controlProps } from "@/lib/forms";

/** Account dropdown bound to a react-hook-form field holding the account id. */
export function AccountSelect<T extends FieldValues>({
  id,
  label,
  name,
  accounts,
  control,
  error,
  optional,
  noneLabel,
}: {
  id: string;
  label: string;
  name: Path<T>;
  /** Undefined while loading. */
  accounts: AccountItem[] | undefined;
  control: Control<T>;
  error?: string;
  optional?: boolean;
  /** When set, offers an empty choice with this label. */
  noneLabel?: string;
}) {
  // Base UI shows the raw value unless given a label, so map the id to its name here.
  const selectedLabel = (value: string) => {
    const account = accounts?.find((item) => item.id === value);
    if (account) return `${account.name} · ${account.currency}`;
    if (accounts === undefined) return "Loading…";
    return noneLabel ?? "Choose account";
  };

  return (
    <Field id={id} label={label} error={error} optional={optional}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select
            value={field.value || (noneLabel ? "none" : null)}
            onValueChange={(value) => {
              field.onChange(!value || value === "none" ? "" : value);
              field.onBlur();
            }}
            disabled={accounts === undefined}
          >
            <SelectTrigger
              ref={field.ref}
              {...controlProps(id, error)}
              className="w-full"
            >
              <SelectValue>{selectedLabel(field.value)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {noneLabel && <SelectItem value="none">{noneLabel}</SelectItem>}
              {accounts?.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name} · {item.currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </Field>
  );
}
