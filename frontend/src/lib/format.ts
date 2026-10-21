/** Today's date in the viewer's own time zone as YYYY-MM-DD. */
export function localDateISO(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Parses a YYYY-MM-DD value as a local calendar date, never as UTC midnight. */
export function parseISODate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(
  value: string,
  locale?: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
) {
  return parseISODate(value).toLocaleDateString(locale, options);
}

export function formatMoney(
  value: number | string,
  currency: string,
  locale?: string,
  fractionDigits?: number,
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits ?? 2,
  }).format(Number(value));
}

export function currencySymbol(currency: string, locale?: string) {
  return (
    new Intl.NumberFormat(locale, { style: "currency", currency })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency
  );
}
