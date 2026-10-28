import type { Row, Sheet } from "write-excel-file/browser";
import type { Row as ExcelRow } from "read-excel-file";
import { categoriesApi } from "@/api/categories/api";
import { transactionsApi } from "@/api/transactions/api";
import type { TransactionCreate as NewTransaction } from "@/api/transactions/types";
import { invalidateLedger } from "@/lib/query-client";
import { localDateISO } from "@/lib/format";

const columns = [
  "Date",
  "Type",
  "Amount",
  "Currency",
  "Category",
  "Source",
  "Destination",
  "Merchant",
  "Note",
] as const;

const cellText = (value: unknown) => String(value ?? "").trim();
const isoDate = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString().slice(0, 10);
  }
  const text = cellText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
};

export async function downloadTransactionTemplate(currency: string) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const header: Row = columns.map((value) => ({
    value,
    fontWeight: "bold",
    backgroundColor: "#E6F4F1",
    color: "#0B3B3C",
  }));
  const example: Row = [
    {
      value: new Date(`${localDateISO()}T12:00:00`),
      type: Date,
      format: "yyyy-mm-dd",
    },
    { value: "expense", type: String },
    { value: 1250, type: Number, format: "#,##0.00" },
    { value: currency, type: String },
    { value: "Groceries", type: String },
    { value: "HDFC Savings", type: String },
    { value: "Groceries", type: String },
    { value: "Sample merchant", type: String },
    { value: "Delete this example row before importing", type: String },
  ];
  const sheet: Sheet<Blob> = {
    sheet: "Transactions",
    data: [header, example],
    columns: [14, 12, 14, 11, 20, 22, 22, 24, 36].map((width) => ({ width })),
    stickyRowsCount: 1,
  };
  await writeXlsxFile([sheet], { fontFamily: "Calibri", fontSize: 11 }).toFile(
    "spendova-transaction-import-template.xlsx",
  );
}

export type ImportResult = { imported: number; rejected: string[] };

export async function importTransactionTemplate(
  file: File,
): Promise<ImportResult> {
  const [{ default: readXlsxFile }, categories] = await Promise.all([
    import("read-excel-file"),
    categoriesApi.list(),
  ]);
  const rows = await readXlsxFile(file);
  const actualHeaders = rows[0]?.map(cellText) ?? [];
  if (columns.some((column, index) => actualHeaders[index] !== column)) {
    throw new Error(
      "This file does not match the Spendova transaction template.",
    );
  }

  const categoryIds = new Map(
    categories.map((category) => [
      category.name.trim().toLowerCase(),
      category.id,
    ]),
  );
  const valid: Array<{ row: number; payload: NewTransaction }> = [];
  const rejected: string[] = [];

  rows.slice(1).forEach((values: ExcelRow, index: number) => {
    const row = index + 2;
    if (values.every((value) => cellText(value) === "")) return;
    const [
      dateValue,
      typeValue,
      amountValue,
      currencyValue,
      categoryValue,
      sourceValue,
      destinationValue,
      merchantValue,
      noteValue,
    ] = values;
    const occurred_on = isoDate(dateValue);
    const kind = cellText(typeValue).toLowerCase();
    const amount = Number(amountValue);
    const currency = cellText(currencyValue).toUpperCase();
    const categoryName = cellText(categoryValue).toLowerCase();
    const category_id = categoryName
      ? categoryIds.get(categoryName)
      : undefined;
    const source = cellText(sourceValue);
    const destination = cellText(destinationValue);
    const problems: string[] = [];
    if (!occurred_on) problems.push("invalid date");
    if (!(["expense", "income", "transfer"] as string[]).includes(kind))
      problems.push("invalid type");
    if (!Number.isFinite(amount) || amount <= 0)
      problems.push("invalid amount");
    if (!/^[A-Z]{3}$/.test(currency)) problems.push("invalid currency");
    if (!source) problems.push("source is required");
    if (!destination) problems.push("destination is required");
    if (categoryName && !category_id)
      problems.push(`unknown category '${cellText(categoryValue)}'`);
    if (problems.length) {
      rejected.push(`Row ${row}: ${problems.join(", ")}`);
      return;
    }
    valid.push({
      row,
      payload: {
        kind: kind as NewTransaction["kind"],
        amount: amount.toFixed(2),
        currency,
        occurred_on,
        category_id,
        source,
        destination,
        merchant: cellText(merchantValue) || undefined,
        notes: cellText(noteValue) || undefined,
      },
    });
  });

  if (rejected.length) return { imported: 0, rejected };
  if (!valid.length)
    throw new Error("The template does not contain any transaction rows.");

  let imported = 0;
  for (const entry of valid) {
    const signature = `${file.name}:${entry.row}:${JSON.stringify(entry.payload)}`;
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(signature),
    );
    const key = `xlsx-${Array.from(new Uint8Array(digest))
      .slice(0, 24)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")}`;
    await transactionsApi.create(entry.payload, key);
    imported += 1;
  }
  void invalidateLedger();
  return { imported, rejected: [] };
}
