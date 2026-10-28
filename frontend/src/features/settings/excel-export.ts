import type { Cell, Row, Sheet } from "write-excel-file/browser";
import { accountsApi } from "@/api/accounts/api";
import type { SpendovaUser } from "@/api/auth/types";
import { categoriesApi } from "@/api/categories/api";
import { loansApi } from "@/api/loans/api";
import { transactionsApi } from "@/api/transactions/api";
import { localDateISO, parseISODate } from "@/lib/format";

const MONEY_FORMAT = "#,##0.00";
const DATE_FORMAT = "dd mmm yyyy";

const header = (labels: string[]): Row =>
  labels.map((value) => ({
    value,
    fontWeight: "bold",
    backgroundColor: "#E6F4F1",
    color: "#0B3B3C",
  }));
const text = (value?: string | null): Cell =>
  value ? { value, type: String } : null;
const amount = (value?: string | number | null): Cell =>
  value === null || value === undefined || value === ""
    ? null
    : { value: Number(value), type: Number, format: MONEY_FORMAT };
const whole = (value?: number | null): Cell =>
  value === null || value === undefined ? null : { value, type: Number };
const day = (value?: string | null): Cell =>
  value
    ? { value: parseISODate(value), type: Date, format: DATE_FORMAT }
    : null;

function sheet(
  name: string,
  labels: string[],
  rows: Row[],
  widths: number[],
): Sheet<Blob> {
  return {
    sheet: name,
    data: [header(labels), ...rows],
    columns: widths.map((width) => ({ width })),
    stickyRowsCount: 1,
  };
}

export type StatementRange = {
  from?: string;
  to: string;
  label: string;
};

/** Builds and downloads an Excel bank statement for the requested period. */
export async function downloadExcelExport(
  profile: SpendovaUser,
  range: StatementRange,
) {
  const [
    accounts,
    categories,
    allTransactions,
    loans,
    { default: writeXlsxFile },
  ] = await Promise.all([
    accountsApi.list(),
    categoriesApi.list(),
    transactionsApi.listAll(),
    loansApi.list(true),
    import("write-excel-file/browser"),
  ]);
  const transactions = allTransactions.filter(
    (item) =>
      (!range.from || item.occurred_on >= range.from) &&
      item.occurred_on <= range.to,
  );
  const categoryName = new Map(categories.map((item) => [item.id, item.name]));
  const total = (kind: string) =>
    transactions
      .filter((item) => item.kind === kind && item.status === "cleared")
      .reduce((sum, item) => sum + Number(item.amount), 0);

  const sheets: Sheet<Blob>[] = [
    sheet(
      "Summary",
      ["Item", "Value"],
      [
        [text("Name"), text(profile.display_name)],
        [text("Email"), text(profile.email)],
        [text("Currency"), text(profile.base_currency)],
        [text("Exported on"), day(localDateISO())],
        [text("Statement period"), text(range.label)],
        [
          text("From"),
          range.from ? day(range.from) : text("First transaction"),
        ],
        [text("To"), day(range.to)],
        [text("Transactions"), whole(transactions.length)],
        [text("Total income"), amount(total("income"))],
        [text("Total spending"), amount(total("expense"))],
        [text("Accounts"), whole(accounts.length)],
        [
          text("Active loans"),
          whole(loans.filter((item) => item.status === "active").length),
        ],
        [
          text("Loan balance outstanding"),
          amount(
            loans.reduce(
              (sum, item) => sum + Number(item.summary.outstanding_principal),
              0,
            ),
          ),
        ],
      ],
      [22, 34],
    ),
    sheet(
      "Transactions",
      [
        "Date",
        "Type",
        "Amount",
        "Signed amount",
        "Currency",
        "Category",
        "From",
        "To",
        "Merchant",
        "Note",
        "Status",
      ],
      transactions.map((item) => [
        day(item.occurred_on),
        text(item.kind),
        amount(item.amount),
        amount(
          item.kind === "expense"
            ? -Number(item.amount)
            : item.kind === "income"
              ? item.amount
              : 0,
        ),
        text(item.currency),
        text(item.category_id ? categoryName.get(item.category_id) : null),
        text(item.source),
        text(item.destination),
        text(item.merchant),
        text(item.notes),
        text(item.status),
      ]),
      [13, 10, 14, 15, 9, 18, 20, 20, 22, 30, 10],
    ),
    sheet(
      "Accounts",
      ["Name", "Type", "Currency", "Opening balance", "Current balance"],
      accounts.map((item) => [
        text(item.name),
        text(item.account_type),
        text(item.currency),
        amount(item.opening_balance),
        amount(item.current_balance),
      ]),
      [26, 14, 10, 18, 18],
    ),
    sheet(
      "Loans & EMIs",
      [
        "Name",
        "Type",
        "Lender",
        "Status",
        "Amount borrowed",
        "Interest rate %",
        "Rate estimated",
        "EMI",
        "Tenure (months)",
        "EMIs paid",
        "EMIs left",
        "First EMI",
        "Last EMI",
        "Total payable",
        "Total interest",
        "Processing fee",
        "Outstanding principal",
        "Remaining to pay",
      ],
      loans.map(({ summary, ...item }) => [
        text(item.name),
        text(item.loan_type),
        text(item.lender),
        text(item.status),
        amount(item.principal),
        amount(summary.annual_rate),
        text(summary.rate_is_estimated ? "Yes" : "No"),
        amount(summary.emi),
        whole(summary.tenure_months),
        whole(summary.installments_paid),
        whole(summary.installments_left),
        day(summary.first_due_on),
        day(summary.last_due_on),
        amount(summary.total_payable),
        amount(summary.total_interest),
        amount(summary.processing_fee),
        amount(summary.outstanding_principal),
        amount(summary.remaining_payable),
      ]),
      [24, 14, 18, 9, 16, 14, 13, 13, 14, 10, 10, 13, 13, 15, 15, 14, 19, 17],
    ),
  ];

  await writeXlsxFile(sheets, { fontFamily: "Calibri", fontSize: 11 }).toFile(
    `spendova-statement-${range.from ?? "first"}-to-${range.to}.xlsx`,
  );
  return { transactions: transactions.length };
}
