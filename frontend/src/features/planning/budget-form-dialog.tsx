import { useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import { addMonths, startOfMonth } from "date-fns";
import { z } from "zod";
import { MoneyInput } from "@/components/common/money-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FormAlert } from "@/components/common/form-field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories } from "@/features/categories/hooks";
import { useMoney } from "@/hooks/use-money";
import { ApiError } from "@/api/client";
import { localDateISO } from "@/lib/format";
import {
  applyServerErrors,
  controlProps,
  money,
  notifySuccess,
  requiredText,
} from "@/lib/forms";
import { useCreateBudget } from "./hooks";

const schema = z
  .object({
    name: requiredText("Name this budget", 100),
    month: z.string().min(1, "Choose a month"),
    total: money("the total limit"),
    lines: z.array(
      z.object({
        categoryId: z.string().min(1, "Choose a category"),
        limit: money("a limit"),
      }),
    ),
  })
  .superRefine((value, context) => {
    const seen = new Set<string>();
    value.lines.forEach((line, index) => {
      if (line.categoryId && seen.has(line.categoryId))
        context.addIssue({
          code: "custom",
          path: ["lines", index, "categoryId"],
          message: "Already added",
        });
      seen.add(line.categoryId);
    });
    const sum = value.lines.reduce(
      (total, line) => total + Number(line.limit || 0),
      0,
    );
    if (Number(value.total) > 0 && sum > Number(value.total))
      context.addIssue({
        code: "custom",
        path: ["total"],
        message: "Category limits add up to more than this",
      });
  });
type Values = z.input<typeof schema>;

function monthOptions(locale?: string) {
  const start = startOfMonth(new Date());
  return Array.from({ length: 14 }, (_, index) => {
    const date = addMonths(start, index - 2);
    return {
      value: localDateISO(date),
      label: date.toLocaleDateString(locale, {
        month: "long",
        year: "numeric",
      }),
    };
  });
}

export function BudgetFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const currency = useMoney();
  const createBudget = useCreateBudget();
  const categories = useCategories(open);
  const [formError, setFormError] = useState("");
  const [months] = useState(() => monthOptions(currency.locale));
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { name: "", month: months[2].value, total: "", lines: [] },
  });
  const { errors, isSubmitting } = form.formState;
  const lines = useFieldArray({ control: form.control, name: "lines" });
  const month = useWatch({ control: form.control, name: "month" });
  const expenseCategories = useMemo(
    () => categories.items.filter((item) => item.category_type === "expense"),
    [categories.items],
  );

  useEffect(() => {
    if (open) {
      const label =
        months.find((item) => item.value === months[2].value)?.label ?? "";
      form.reset({
        name: `${label.split(" ")[0]} budget`,
        month: months[2].value,
        total: "",
        lines: [],
      });
    }
  }, [open, months, form]);

  function changeOpen(next: boolean) {
    if (!next) setFormError("");
    onOpenChange(next);
  }

  async function save(input: Values) {
    setFormError("");
    const parsed = schema.parse(input);
    try {
      const budget = await createBudget.mutateAsync({
        name: parsed.name,
        month: parsed.month,
        total_limit: parsed.total,
        lines: parsed.lines.map((line) => ({
          category_id: line.categoryId,
          amount_limit: line.limit,
        })),
      });
      notifySuccess(
        `${budget.name} created`,
        currency.format(budget.total_limit, 0),
      );
      changeOpen(false);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        form.setError(
          "month",
          { message: "You already have a budget for this month" },
          { shouldFocus: true },
        );
        return;
      }
      setFormError(
        applyServerErrors(
          reason,
          form.setError,
          {
            name: "name",
            total_limit: "total",
            month: "month",
            ...(Object.fromEntries(
              input.lines.flatMap((_, index) => [
                [`lines.${index}.category_id`, `lines.${index}.categoryId`],
                [`lines.${index}.amount_limit`, `lines.${index}.limit`],
              ]),
            ) as Record<
              string,
              `lines.${number}.categoryId` | `lines.${number}.limit`
            >),
          },
          "Could not create this budget.",
        ),
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="gap-5 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">New budget</DialogTitle>
          <DialogDescription className="sr-only">
            Monthly limit and category limits
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-5"
          onSubmit={form.handleSubmit(save)}
        >
          <div className="grid gap-4 min-[420px]:grid-cols-2">
            <Field
              id="budget-month"
              label="Month"
              error={errors.month?.message}
            >
              <Controller
                control={form.control}
                name="month"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => value && field.onChange(value)}
                  >
                    <SelectTrigger
                      ref={field.ref}
                      {...controlProps("budget-month", errors.month?.message)}
                      className="w-full"
                    >
                      <SelectValue>
                        {months.find((item) => item.value === month)?.label}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field
              id="budget-total"
              label="Total limit"
              error={errors.total?.message}
            >
              <MoneyInput
                id="budget-total"
                symbol={currency.symbol}
                error={errors.total?.message}
                placeholder="e.g. 40000"
                {...form.register("total")}
              />
            </Field>
          </div>
          <Field id="budget-name" label="Name" error={errors.name?.message}>
            <Input
              {...controlProps("budget-name", errors.name?.message)}
              {...form.register("name")}
              autoComplete="off"
            />
          </Field>

          <section className="space-y-3">
            <h3 className="text-sm font-medium">
              Category limits{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </h3>
            {lines.fields.map((line, index) => {
              const lineErrors = errors.lines?.[index];
              return (
                <div
                  key={line.id}
                  className="grid grid-cols-[1fr_8rem_auto] items-start gap-2"
                >
                  <Field
                    id={`line-category-${index}`}
                    label={<span className="sr-only">Category</span>}
                    error={lineErrors?.categoryId?.message}
                  >
                    <Controller
                      control={form.control}
                      name={`lines.${index}.categoryId`}
                      render={({ field }) => (
                        <Select
                          value={field.value || null}
                          onValueChange={(value) => field.onChange(value ?? "")}
                        >
                          <SelectTrigger
                            ref={field.ref}
                            {...controlProps(
                              `line-category-${index}`,
                              lineErrors?.categoryId?.message,
                            )}
                            className="w-full"
                          >
                            <SelectValue placeholder="Category">
                              {
                                expenseCategories.find(
                                  (item) => item.id === field.value,
                                )?.name
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {expenseCategories.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>
                  <Field
                    id={`line-limit-${index}`}
                    label={<span className="sr-only">Limit</span>}
                    error={lineErrors?.limit?.message}
                  >
                    <MoneyInput
                      id={`line-limit-${index}`}
                      symbol={currency.symbol}
                      error={lineErrors?.limit?.message}
                      {...form.register(`lines.${index}.limit`)}
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-7"
                    aria-label="Remove category limit"
                    onClick={() => lines.remove(index)}
                  >
                    <X />
                  </Button>
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={lines.fields.length >= expenseCategories.length}
              onClick={() => lines.append({ categoryId: "", limit: "" })}
            >
              <Plus />
              Add category limit
            </Button>
          </section>

          <FormAlert>{formError}</FormAlert>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmitting}
              onClick={() => changeOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
