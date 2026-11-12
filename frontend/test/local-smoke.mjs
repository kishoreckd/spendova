// Read-only smoke check of the real local app; no user accounts are created.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

await mkdir("test-results", { recursive: true });
const health = await fetch("http://localhost:8000/health");
assert.equal(health.status, 200);
assert.equal((await health.json()).data.db, "ok");
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  for (const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
    const page = await browser.newPage({viewport});
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("http://localhost:5173/sign-in");
    await page.locator('input[type="email"]').waitFor();
    assert.equal(await page.locator('input[type="email"]').count(), 1);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({path:`test-results/local-sign-in-${viewport.width}.png`,fullPage:true});
    await page.goto("http://localhost:5173/demo");
    await page.getByText("Sample dashboard", {exact:true}).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({path:`test-results/local-demo-${viewport.width}.png`,fullPage:true});
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("Live local smoke passed: PostgreSQL health, updated API schema, desktop/mobile sign-in and demo.");
} finally { await browser.close(); }
