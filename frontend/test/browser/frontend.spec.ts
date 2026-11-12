import { test, expect, type Page } from "@playwright/test";
import writeExcelFile from "write-excel-file/node";

async function mockApi(page: Page) {
  const transactions = Array.from({ length: 205 }, (_, index) => ({
    id: String(index), kind: "expense", amount: "125.50", currency: "INR", source: "Bank", destination: "Shop",
    source_account_id: "bank", destination_account_id: null, merchant: index === 204 ? "Old receipt" : `Shop ${index}`,
    occurred_on: "2026-11-02", category_id: "food", recurring_rule_id: null, notes: null, status: "cleared",
  }));
  await page.route("**/api/v1/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    let data: unknown = [];
    if (path === "/accounts") data = [{id:"bank",name:"Bank",currency:"INR",account_type:"bank",current_balance:"10000",opening_balance:"10000"}, {id:"usd",name:"USD account",currency:"USD",account_type:"bank",current_balance:"100",opening_balance:"100"}];
    if (path === "/categories") data = [{id:"food",name:"Food",category_type:"expense",icon:"utensils",color:"#168a75",monthly_budget:null}];
    if (path === "/transactions") {
      if (route.request().method() === "POST") data = {...transactions[0], id:"new", ...route.request().postDataJSON()};
      else {
        let rows = transactions.filter(item => !url.searchParams.get("search") || item.merchant.toLowerCase().includes(url.searchParams.get("search")!.toLowerCase()));
        for (const key of ["currency","status","kind"] as const) if (url.searchParams.has(key)) rows = rows.filter(item => item[key] === url.searchParams.get(key));
        const offset = Number(url.searchParams.get("offset") ?? 0);
        data = rows.slice(offset, offset + Number(url.searchParams.get("limit") ?? 100));
      }
    }
    if (path.startsWith("/transactions/") && route.request().method() === "DELETE") {
      transactions.find(item => item.id === path.split("/").at(-1))!.status = "voided";
      await route.fulfill({status:204, body:""}); return;
    }
    if (path === "/dashboard") data = {period:{year:2026,month:11}, income:"5000",spending:"125.50",cash_flow:"4874.50",transaction_count:205,categories:[{id:"food",name:"Food",color:null,amount:"125.50"}]};
    if (path === "/preferences") data = {daily_token_limit:20000,max_daily_tokens:100000,bills:false,deposits:false,budgets:false,weekly:false,tokens_used:0,tokens_remaining:20000,resets_at:"2026-11-12T00:00:00+05:30",reset_timezone:"Asia/Kolkata",ai_available:false};
    if (path === "/loans/overview") data = {active_loans:0};
    await route.fulfill({json:{status:"success",message:"Success",data}});
  });
}

test.beforeEach(async ({page}) => { await mockApi(page); });

test("searches older history, opens details and voids with confirmation", async ({page}) => {
  await page.goto("/transactions");
  await expect(page.getByText("Page 1", {exact:true})).toBeVisible();
  await page.getByRole("button", {name:"Next",exact:true}).click();
  await expect(page.getByText("Page 2", {exact:true})).toBeVisible();
  await page.getByRole("searchbox", {name:"Search transactions"}).fill("Old receipt");
  await page.getByRole("button", {name:/Old receipt/}).click();
  await expect(page.getByRole("heading", {name:"Transaction details"})).toBeVisible();
  await page.getByRole("button", {name:"Void transaction",exact:true}).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("alertdialog").getByRole("button", {name:"Void transaction",exact:true}).click();
  await expect(page.getByText("Transaction voided", {exact:true})).toBeVisible();
  await expect(page.getByRole("button", {name:/Old receipt/})).toContainText("voided");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/transactions-${test.info().project.name}.png`, fullPage:true});
});

test("renders currency controls and report categories without horizontal overflow", async ({page}) => {
  await page.goto("/reports");
  await expect(page.getByText("Where money went", {exact:true})).toBeVisible();
  await expect(page.getByRole("combobox", {name:"Currency"})).toBeVisible();
  await expect(page.getByText("Food", {exact:true}).first()).toBeVisible();
  await page.getByText("Where money went", {exact:true}).scrollIntoViewIfNeeded();
  await expect(page.locator(".recharts-pie-sector")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/reports-${test.info().project.name}.png`, fullPage:true});
});

test("requires import review before posting spreadsheet rows", async ({page}) => {
  let posted = 0;
  page.on("request", request => { if (request.method() === "POST" && request.url().endsWith("/transactions")) ++posted; });
  await page.goto("/settings");
  await expect(page.getByText("Upload completed template", {exact:false})).toBeVisible();
  await expect(page.locator('input[type="file"]')).toBeEnabled();
  const buffer = await writeExcelFile([
    ["Date","Type","Amount","Currency","Category","Source","Destination","Merchant","Note"],
    ["2026-11-02","expense",125.5,"INR","Food","Bank","Groceries","Shop",""]
  ]).toBuffer();
  await page.locator('input[type="file"]').setInputFiles({name:"test-import.xlsx", mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer});
  await expect(page.getByRole("heading", {name:"Review import"})).toBeVisible();
  expect(posted).toBe(0);
  await page.getByRole("button", {name:"Import transactions",exact:true}).click();
  await expect(page.getByText("Import complete", {exact:true})).toBeVisible();
  expect(posted).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
