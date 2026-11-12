import { beforeEach, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";

const state = vi.hoisted(() => ({ create: vi.fn(), invalidate: vi.fn(), read: vi.fn(), epoch: 1 }));
vi.mock("@/api/transactions/api", () => ({transactionsApi:{create:state.create}}));
vi.mock("@/lib/query-client", () => ({invalidateLedger:state.invalidate}));
vi.mock("@/lib/session", () => ({getSessionEpoch: () => state.epoch}));
vi.mock("read-excel-file", () => ({default:state.read}));
vi.mock("@/api/accounts/api", () => ({accountsApi:{list:async () => [{id:"bank", name:"Bank", currency:"INR"}]}}));
vi.mock("@/api/categories/api", () => ({categoriesApi:{list:async () => [{id:"food", name:"Food", category_type:"expense"}]}}));
import { importBatchId, importPreparedTransactions, prepareTransactionImport, type ImportEntry } from "../src/features/settings/transaction-import";

const headers = ["Date","Type","Amount","Currency","Category","Source","Destination","Merchant","Note"];
const row = ["2026-11-02","expense",125.50,"INR","Food","Bank","Groceries","Shop",""];
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  state.create.mockReset(); state.invalidate.mockReset(); state.epoch = 1;
});

it("previews account-linked decimal transactions before writing", async () => {
  state.read.mockResolvedValue([headers, row]);
  const preview = await prepareTransactionImport(new File([], "import.xlsx"));
  expect(preview.rejected).toEqual([]);
  expect(preview.entries[0].payload).toMatchObject({amount:"125.50", source_account_id:"bank", category_id:"food"});
  expect(state.create).not.toHaveBeenCalled();
});

it("rejects invalid calendar dates and unknown accounts before posting", async () => {
  state.read.mockResolvedValue([headers, ["2026-02-31", ...row.slice(1)], [...row.slice(0,5),"Unknown",...row.slice(6)]]);
  const preview = await prepareTransactionImport(new File([], "bad.xlsx"));
  expect(preview.rejected).toHaveLength(2);
  expect(state.create).not.toHaveBeenCalled();
});

it("reports partial success, refreshes data and retries remaining rows with the same key", async () => {
  const entries: ImportEntry[] = [2,3].map(row => ({row, payload:{kind:"expense",amount:"10.00",currency:"INR",source:"Bank",destination:"Food",occurred_on:"2026-11-02"}}));
  const batch = await importBatchId(entries);
  state.create.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("Offline"));
  const result = await importPreparedTransactions(entries, batch);
  expect(result.imported).toBe(1);
  expect(result.remaining).toHaveLength(1);
  expect(result.rejected[0]).toContain("Row 3: Offline");
  expect(state.invalidate).toHaveBeenCalledOnce();
  const failedKey = state.create.mock.calls[1][1];
  state.create.mockResolvedValueOnce({});
  const resumed = await importPreparedTransactions(result.remaining, batch);
  expect(resumed.imported).toBe(1);
  expect(state.create.mock.calls[2][1]).toBe(failedKey);
});

it("stops the remaining import when the account changes", async () => {
  const entries: ImportEntry[] = [2,3].map(row => ({row, payload:{kind:"expense",amount:"10.00",currency:"INR",source:"Bank",destination:"Food",occurred_on:"2026-11-02"}}));
  state.create.mockImplementationOnce(async () => { state.epoch = 2; return {}; });
  const result = await importPreparedTransactions(entries, "batch");
  expect(result.imported).toBe(1);
  expect(result.remaining).toHaveLength(1);
  expect(state.create).toHaveBeenCalledOnce();
});
