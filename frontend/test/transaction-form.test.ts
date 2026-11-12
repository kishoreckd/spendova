import { expect, it } from "vitest";
import { blankTransaction, transactionSchema } from "../src/features/transactions/transaction-form";

it("rejects transfers to the same account and expenses without categories", () => {
  const transfer = transactionSchema.safeParse({ ...blankTransaction("transfer", "one", "2026-11-11"), amount:"100", toAccount:"one" });
  expect(transfer.success).toBe(false);
  if (!transfer.success) expect(transfer.error.issues.some(issue => issue.path[0] === "toAccount")).toBe(true);
  expect(transactionSchema.safeParse({...blankTransaction("expense", "one"), amount:"100"}).success).toBe(false);
});

it("accepts a complete expense while preserving its decimal amount", () => {
  const result = transactionSchema.parse({...blankTransaction("expense", "one", "2026-11-11"), amount:"125.50", categoryId:"food"});
  expect(result.amount).toBe("125.50");
});
