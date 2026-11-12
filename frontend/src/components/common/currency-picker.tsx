import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CurrencyPicker({
  value,
  currencies,
  onChange,
}: {
  value: string;
  currencies: string[];
  onChange: (currency: string) => void;
}) {
  return (
    <Select value={value} onValueChange={(next) => next && onChange(next)}>
      <SelectTrigger aria-label="Currency" className="w-28">
        <SelectValue>{value}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {[...new Set([value, ...currencies])].sort().map((code) => (
          <SelectItem key={code} value={code}>
            {code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
