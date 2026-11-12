import { describe, it, expect } from "vitest";
import { buildAnalysis } from "../src/features/reports/report-analysis";
import type { TransactionItem } from "../src/api/transactions/types";

const transaction = (overrides: Partial<TransactionItem> = {}): TransactionItem => ({
  id: "one", kind: "expense", amount: "125.50", currency: "INR", source: "Bank", destination: "Lender",
  source_account_id: "bank", destination_account_id: null, merchant: null, occurred_on: "2026-11-02",
  category_id: "emi", recurring_rule_id: null, notes: null, status: "cleared", ...overrides,
});

describe("report financial boundaries", () => {
  it("groups by the assigned category and excludes foreign currencies, transfers and voided records", () => {
    const result = buildAnalysis([
      transaction(), transaction({currency: "USD", amount:"900"}), transaction({status:"voided"}),
      transaction({kind:"transfer"}), transaction({kind:"income", amount:"500"}),
    ], new Date(2026, 10, 11), 6, new Map([["emi", "Loan EMI"]]), "INR");
    expect(result.categories).toEqual([{ name:"Loan EMI", amount:125.5 }]);
    expect(result.monthly.at(-1)).toMatchObject({ income:500, spending:125.5 });
    expect(result.currentSpend).toBe(125.5);
  });
  it("keeps previous-month totals correct across a year boundary", () => {
    const result = buildAnalysis([transaction({occurred_on:"2025-12-31", amount:"300"})], new Date(2026, 0, 5), 3, new Map(), "INR");
    expect(result.previousSpend).toBe(300);
    expect(result.currentSpend).toBe(0);
  });
});
