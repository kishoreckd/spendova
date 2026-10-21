import { useMemo } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { currencySymbol, formatDate, formatMoney } from "@/lib/format";

/** Money and date formatting in the signed-in user's currency and locale. */
export function useMoney() {
  const { profile } = useAuth();
  const currency = profile?.base_currency ?? "INR";
  const locale = profile?.locale || undefined;
  return useMemo(
    () => ({
      currency,
      locale,
      symbol: currencySymbol(currency, locale),
      format: (value: number | string, fractionDigits?: number) =>
        formatMoney(value, currency, locale, fractionDigits),
      date: (value: string, options?: Intl.DateTimeFormatOptions) =>
        formatDate(value, locale, options),
    }),
    [currency, locale],
  );
}
