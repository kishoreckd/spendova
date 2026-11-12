import type { Row, Sheet } from "write-excel-file/browser";
import type { Row as ExcelRow } from "read-excel-file";
import { accountsApi } from "@/api/accounts/api";
import { getSessionEpoch } from "@/lib/session";
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

export type ImportEntry = { row: number; payload: NewTransaction };
export type ImportPreview = { entries: ImportEntry[]; rejected: string[] };
export type ImportResult = {
  imported: number;
  rejected: string[];
  remaining: ImportEntry[];
};

export async function prepareTransactionImport(
  file: File,
): Promise<ImportPreview> {
  const [{ default: readXlsxFile }, categories, accounts] = await Promise.all([
    import("read-excel-file"),
    categoriesApi.list(),
    accountsApi.list(),
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
      `${category.category_type}:${category.name.trim().toLowerCase()}`,
      category.id,
    ]),
  );
  const valid: ImportEntry[] = [];
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
    const amountText = cellText(amountValue);
    const amount =
      /^\d+(\.\d{1,2})?$/.test(amountText) && /[1-9]/.test(amountText)
        ? amountText
        : "";
    const currency = cellText(currencyValue).toUpperCase();
    const categoryName = cellText(categoryValue).toLowerCase();
    const category_id = categoryName
      ? categoryIds.get(`${kind}:${categoryName}`)
      : undefined;
    const source = cellText(sourceValue);
    const destination = cellText(destinationValue);
    const findAccount = (name: string) =>
      accounts.filter(
        (account) =>
          account.name.trim().toLowerCase() === name.toLowerCase() &&
          account.currency === currency,
      );
    const sourceMatches = findAccount(source);
    const destinationMatches = findAccount(destination);
    const sourceAccount =
      sourceMatches.length === 1 ? sourceMatches[0] : undefined;
    const destinationAccount =
      destinationMatches.length === 1 ? destinationMatches[0] : undefined;
    const problems: string[] = [];
    if ((kind === "expense" || kind === "transfer") && !sourceAccount)
      problems.push(
        "choose an unambiguous source account matching the currency",
      );
    if ((kind === "income" || kind === "transfer") && !destinationAccount)
      problems.push(
        "choose an unambiguous destination account matching the currency",
      );
    if (kind === "transfer" && sourceAccount?.id === destinationAccount?.id)
      problems.push("transfer accounts must differ");
    if (!categoryName && kind !== "transfer")
      problems.push("category is required");
    const parsedDate = new Date(`${occurred_on}T12:00:00Z`);
    if (
      !occurred_on ||
      !Number.isFinite(parsedDate.valueOf()) ||
      parsedDate.toISOString().slice(0, 10) !== occurred_on
    )
      problems.push("invalid date");
    if (!(["expense", "income", "transfer"] as string[]).includes(kind))
      problems.push("invalid type");
    if (!amount) problems.push("invalid amount");
    if (!/^[A-Z]{3}$/.test(currency)) problems.push("invalid currency");
    if (!source) problems.push("source is required");
    if (!destination) problems.push("destination is required");
    if (categoryName && !category_id)
      problems.push(`unknown category '${cellText(categoryValue)}'`);
    if (problems.length) {
      rejected.push(`Row ${row}: ${problems.join(", ")}`);
      return;
    }
    if (cellText(merchantValue).length > 160) {
      rejected.push(`Row ${row}: merchant is too long`);
      return;
    }
    if (cellText(noteValue).length > 500) {
      rejected.push(`Row ${row}: note is too long`);
      return;
    }
    valid.push({
      row,
      payload: {
        kind: kind as NewTransaction["kind"],
        amount: `${amount.split(".")[0]}.${(amount.split(".")[1] ?? "").padEnd(2, "0")}`,
        currency,
        occurred_on,
        category_id,
        source,
        destination,
        source_account_id:
          kind === "expense" || kind === "transfer"
            ? sourceAccount?.id
            : undefined,
        destination_account_id:
          kind === "income" || kind === "transfer"
            ? destinationAccount?.id
            : undefined,
        merchant: cellText(merchantValue) || undefined,
        notes: cellText(noteValue) || undefined,
      },
    });
  });

  if (!valid.length && !rejected.length)
    throw new Error("The template does not contain any transaction rows.");
  return { entries: valid, rejected };
}

export async function importPreparedTransactions(
  entries: ImportEntry[],
  batchId: string,
): Promise<ImportResult> {
  const sessionId = getSessionEpoch();
  let imported = 0;
  try {
    for (const entry of entries) {
      const signature = `${batchId}:${entry.row}:${JSON.stringify(entry.payload)}`;
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(signature),
      );
      const key = `xlsx-${Array.from(new Uint8Array(digest))
        .slice(0, 24)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")}`;
      try {
        if (getSessionEpoch() !== sessionId)
          throw new Error("The signed-in account changed. Import stopped.");
        await transactionsApi.create(entry.payload, key);
      } catch (reason) {
        return {
          imported,
          rejected: [
            `Row ${entry.row}: ${reason instanceof Error ? reason.message : "Import failed"}`,
          ],
          remaining: entries.slice(imported),
        };
      }
      imported += 1;
    }
    return { imported, rejected: [], remaining: [] };
  } finally {
    await invalidateLedger();
  }
}

export async function importBatchId(entries: ImportEntry[]): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(entries)),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
