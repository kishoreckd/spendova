import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { PurchaseScenario } from "@/api/insights/types";
import { Field } from "@/components/common/form-field";
import { MoneyInput } from "@/components/common/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { controlProps } from "@/lib/forms";
const decimal = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a number with up to 2 decimals");
const schema = z
  .object({
    price: decimal.refine(
      (v) => Number(v) > 0 && Number(v) <= 1e9,
      "Enter a price between 0.01 and 1 billion",
    ),
    down_payment: decimal,
    months: z
      .string()
      .regex(/^\d+$/, "Enter whole months")
      .refine(
        (v) => Number(v) >= 1 && Number(v) <= 480,
        "Choose 1 to 480 months",
      ),
    annual_rate: decimal.refine(
      (v) => Number(v) <= 100,
      "Choose a rate from 0 to 100",
    ),
  })
  .refine((v) => Number(v.down_payment) < Number(v.price), {
    path: ["down_payment"],
    message: "Must be less than the price",
  });
type Values = z.infer<typeof schema>;
export function PurchaseCheck({
  onSubmit,
  pending,
  symbol,
}: {
  onSubmit: (scenario: PurchaseScenario) => Promise<void>;
  pending: boolean;
  symbol: string;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      price: "",
      down_payment: "0",
      months: "12",
      annual_rate: "0",
    },
  });
  return (
    <form
      noValidate
      onSubmit={handleSubmit((v) =>
        onSubmit({ ...v, months: Number(v.months) }),
      )}
      className="grid gap-4 min-[480px]:grid-cols-2"
    >
      <Field id="purchase-price" label="Price" error={errors.price?.message}>
        <MoneyInput
          id="purchase-price"
          symbol={symbol}
          error={errors.price?.message}
          {...register("price")}
        />
      </Field>
      <Field
        id="purchase-down"
        label="Down payment"
        error={errors.down_payment?.message}
      >
        <MoneyInput
          id="purchase-down"
          symbol={symbol}
          error={errors.down_payment?.message}
          {...register("down_payment")}
        />
      </Field>
      <Field
        id="purchase-months"
        label="Tenure (months)"
        error={errors.months?.message}
      >
        <Input
          {...controlProps("purchase-months", errors.months?.message)}
          inputMode="numeric"
          {...register("months")}
        />
      </Field>
      <Field
        id="purchase-rate"
        label="Annual interest (%)"
        error={errors.annual_rate?.message}
      >
        <Input
          {...controlProps("purchase-rate", errors.annual_rate?.message)}
          inputMode="decimal"
          {...register("annual_rate")}
        />
      </Field>
      <Button
        type="submit"
        loading={pending}
        className="min-[480px]:col-span-2"
      >
        Check purchase
      </Button>
    </form>
  );
}
