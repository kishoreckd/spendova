// End-to-end local-only authentication check. Sends only to the local Mailpit mailbox.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";

const api = "http://localhost:8000";
await mkdir("test-results", {recursive:true});
const settings = Object.fromEntries((await readFile("../backend/.env.docs.local","utf8")).split(/\r?\n/).filter(line => line && !line.startsWith("#")).map(line => {
  const split = line.indexOf("="); return [line.slice(0,split),line.slice(split+1)];
}));
assert.equal((await fetch(`${api}/api/openapi.json`)).status,401);
const browser = await chromium.launch({channel:"msedge",headless:true});
let accountId = null;
const email = `spendova-auth-qa-${randomUUID()}@example.test`;
const password = `Qa-${randomUUID()}!`;
try {
  const docs = await browser.newPage({viewport:{width:1280,height:900}});
  await docs.goto(`${api}/api/docs`);
  await docs.locator("#username").fill(settings.SWAGGER_USERNAME);
  await docs.locator("#password").fill(settings.SWAGGER_PASSWORD);
  await docs.screenshot({path:"test-results/local-swagger-login.png",fullPage:true});
  await docs.getByRole("button",{name:/Open API documentation/}).click();
  await docs.getByRole("button",{name:"Sign out of docs"}).waitFor();
  const schema = await docs.evaluate(async () => (await fetch("/api/openapi.json")).json());
  for (const path of ["/api/v1/auth/register","/api/v1/auth/login","/api/v1/auth/refresh"]) assert(schema.paths[path]);
  assert(!schema.paths["/api/v1/auth/google"]);
  await docs.getByRole("button",{name:"Sign out of docs"}).click();
  await docs.locator("#username").waitFor();
  await docs.close();

  const page = await browser.newPage({viewport:{width:390,height:844}});
  await page.goto("http://localhost:5173/sign-in");
  await page.getByRole("button",{name:"Sign up",exact:true}).click();
  await page.locator("#name").fill("Local Auth QA");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button",{name:"Create account",exact:true}).click();
  await page.waitForURL("**/verify-email");
  let code = null;
  for (let attempt=0;attempt<15 && !code;attempt++) {
    const mailbox = await (await fetch(`http://localhost:8026/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
    const message = mailbox.messages?.[0] ?? mailbox.Messages?.[0];
    if (message) {
      const content = await (await fetch(`http://localhost:8026/api/v1/message/${message.ID ?? message.id}`)).json();
      code = (content.Text ?? content.text ?? "").match(/\b\d{6}\b/)?.[0];
    }
    if (!code) await new Promise(resolve => setTimeout(resolve,1000));
  }
  assert(code,"No verification code reached the local mailbox");
  await page.locator('input[name="code"]').fill(code);
  await page.getByRole("button",{name:/Verify email|Verify code|Verify and continue/}).click();
  await page.waitForURL("**/onboarding");
  accountId = await page.evaluate(async () => {
    const {getAccessToken} = await import("/src/lib/session.ts");
    const response = await fetch("http://localhost:8000/api/v1/auth/me",{method:"PATCH",credentials:"include",headers:{Authorization:`Bearer ${getAccessToken()}`,"Content-Type":"application/json"},body:JSON.stringify({onboarding_completed:true})});
    if (!response.ok) throw new Error("Could not complete QA onboarding");
    return (await response.json()).data.id;
  });
  await writeFile("test-results/local-auth-qa.json",JSON.stringify({id:accountId,email}));
  const before = (await page.context().cookies()).find(cookie => cookie.name === "spendova_refresh")?.value;
  await page.goto("http://localhost:5173/");
  await page.getByRole("heading",{name:/Good|Overview|Hello|Hi|Welcome/}).waitFor();
  const after = (await page.context().cookies()).find(cookie => cookie.name === "spendova_refresh")?.value;
  assert(before && after && before !== after,"Refresh cookie did not rotate");
  await page.goto("http://localhost:5173/settings");
  await page.getByRole("button",{name:"Sign out",exact:true}).click();
  await page.waitForURL("**/sign-in");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button",{name:"Sign in",exact:true}).last().click();
  await page.waitForURL("http://localhost:5173/");
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({path:"test-results/local-account-login-mobile.png",fullPage:true});
  console.log("Local auth passed: protected Swagger, signup, real Mailpit code, verification, rotating session, logout and password login.");
} finally {
  await browser.close();
  // Record only the synthetic account identifier, never a code, token or password.
  await writeFile("test-results/local-auth-qa.json",JSON.stringify({id:accountId,email}));
}
