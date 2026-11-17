import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function monthDate(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function monthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function MonthPicker({
  id,
  value,
  onChange,
  max,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  max?: string;
  className?: string;
}) {
  const selected = useMemo(() => monthDate(value), [value]);
  const maxMonth = max ? monthDate(max) : undefined;
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(selected);
  const label = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(selected);

  function choose(date: Date) {
    onChange(monthValue(date));
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setVisibleMonth(selected);
      }}
    >
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              "h-11 w-full justify-start gap-2 px-3 font-normal sm:h-9",
              className,
            )}
          />
        }
      >
        <CalendarDays className="text-muted-foreground" />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto gap-0 p-0">
        <Calendar
          mode="single"
          month={visibleMonth}
          onMonthChange={setVisibleMonth}
          onSelect={(date) => date && choose(date)}
          disabled={
            maxMonth
              ? {
                  after: new Date(
                    maxMonth.getFullYear(),
                    maxMonth.getMonth() + 1,
                    0,
                  ),
                }
              : undefined
          }
          captionLayout="dropdown"
          startMonth={new Date(selected.getFullYear() - 10, 0)}
          endMonth={maxMonth ?? new Date(selected.getFullYear() + 10, 11)}
          className="[--cell-size:--spacing(9)]"
        />
        <div className="flex justify-end gap-2 border-t p-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => choose(new Date())}
          >
            This month
          </Button>
          <Button type="button" size="sm" onClick={() => choose(visibleMonth)}>
            Use month
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
