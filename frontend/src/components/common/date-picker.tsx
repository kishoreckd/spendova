import { useState } from "react";
import type { Ref } from "react";
import { subDays } from "date-fns";
import { CalendarDays, ChevronDown } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMoney } from "@/hooks/use-money";
import { localDateISO, parseISODate } from "@/lib/format";

type DatePickerProps = {
  id: string;
  /** YYYY-MM-DD, or an empty string when nothing is chosen. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  /** Earliest and latest selectable dates as YYYY-MM-DD. */
  min?: string;
  max?: string;
  /** Adds Today / Yesterday shortcuts for everyday entries. */
  quickPicks?: boolean;
  invalid?: boolean;
  describedBy?: string;
  triggerRef?: Ref<HTMLButtonElement>;
};

export function DatePicker({
  id,
  value,
  onChange,
  onBlur,
  placeholder = "Pick a date",
  min,
  max,
  quickPicks,
  invalid,
  describedBy,
  triggerRef,
}: DatePickerProps) {
  const format = useMoney();
  const [open, setOpen] = useState(false);
  const selected = value ? parseISODate(value) : undefined;
  const minDate = min ? parseISODate(min) : undefined;
  const maxDate = max ? parseISODate(max) : undefined;
  // Refreshed whenever the calendar opens, so "Today" stays right past midnight.
  const [today, setToday] = useState(() => new Date());
  const disabled = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ];

  function choose(date: Date | undefined) {
    onChange(date ? localDateISO(date) : "");
    setOpen(false);
    onBlur?.();
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setToday(new Date());
        else onBlur?.();
      }}
    >
      <PopoverTrigger
        render={
          <Button
            ref={triggerRef}
            id={id}
            type="button"
            variant="outline"
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(
              "h-11 w-full justify-start gap-2 px-3 text-base font-normal sm:h-8 sm:px-2.5 md:text-sm",
              !selected && "text-muted-foreground",
            )}
          />
        }
      >
        <CalendarDays className="text-muted-foreground" />
        <span className="flex-1 truncate text-left">
          {selected
            ? format.date(value, {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : placeholder}
        </span>
        <ChevronDown className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto gap-0 p-0">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={choose}
          defaultMonth={selected ?? minDate ?? maxDate ?? today}
          disabled={disabled.length ? disabled : undefined}
          captionLayout="dropdown"
          startMonth={minDate ?? new Date(today.getFullYear() - 30, 0)}
          endMonth={maxDate ?? new Date(today.getFullYear() + 10, 11)}
          className="[--cell-size:--spacing(10)] sm:[--cell-size:--spacing(8)]"
        />
        {quickPicks && (
          <div className="flex gap-2 border-t p-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="flex-1"
              onClick={() => choose(today)}
            >
              Today
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="flex-1"
              onClick={() => choose(subDays(today, 1))}
            >
              Yesterday
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
