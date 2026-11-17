import type { TransactionFilters } from "@/api/transactions/types";
import { DatePicker } from "@/components/common/date-picker";
import { Field } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { useAccounts } from "@/features/accounts/hooks";
import { useCategories } from "@/features/categories/hooks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function FilterSelect({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value?: string;
  choices: Array<{ id: string; name: string }>;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <Field id={`filter-${label}`} label={label}>
      <Select
        value={value ?? "all"}
        onValueChange={(next) =>
          onChange(!next || next === "all" ? undefined : next)
        }
      >
        <SelectTrigger id={`filter-${label}`} className="w-full">
          <SelectValue>
            {choices.find((item) => item.id === value)?.name ?? "All"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          {choices.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function TransactionFilterBar({
  filters,
  onChange,
}: {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
}) {
  const accounts = useAccounts();
  const categories = useCategories();
  const set = (key: keyof TransactionFilters, value: string | undefined) =>
    onChange({ ...filters, [key]: value });
  return (
    <div className="grid grid-cols-2 gap-3 rounded-xl border bg-card p-3 sm:grid-cols-3 lg:grid-cols-4">
      <Field id="filter-from" label="From">
        <DatePicker
          id="filter-from"
          value={filters.from ?? ""}
          max={filters.to}
          onChange={(value) => set("from", value || undefined)}
        />
      </Field>
      <Field id="filter-to" label="To">
        <DatePicker
          id="filter-to"
          value={filters.to ?? ""}
          min={filters.from}
          onChange={(value) => set("to", value || undefined)}
        />
      </Field>
      <FilterSelect
        label="Account"
        value={filters.accountId}
        choices={accounts.data ?? []}
        onChange={(value) => set("accountId", value)}
      />
      <FilterSelect
        label="Category"
        value={filters.categoryId}
        choices={categories.items}
        onChange={(value) => set("categoryId", value)}
      />
      <FilterSelect
        label="Type"
        value={filters.kind}
        choices={[
          { id: "expense", name: "Expense" },
          { id: "income", name: "Income" },
          { id: "transfer", name: "Transfer" },
        ]}
        onChange={(value) => set("kind", value)}
      />
      <FilterSelect
        label="Status"
        value={filters.status}
        choices={[
          { id: "cleared", name: "Cleared" },
          { id: "pending", name: "Pending" },
          { id: "voided", name: "Voided" },
        ]}
        onChange={(value) => set("status", value)}
      />
      <FilterSelect
        label="Currency"
        value={filters.currency}
        choices={[
          ...new Set((accounts.data ?? []).map((item) => item.currency)),
        ]
          .sort()
          .map((code) => ({ id: code, name: code }))}
        onChange={(value) => set("currency", value)}
      />
      <Button variant="ghost" className="self-end" onClick={() => onChange({})}>
        Clear filters
      </Button>
    </div>
  );
}
