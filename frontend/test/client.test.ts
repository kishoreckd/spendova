import { afterEach, expect, it, vi } from "vitest";

import { apiFetch, ApiError } from "../src/api/client";
import { clearSession, startSession } from "../src/lib/session";

afterEach(() => {vi.unstubAllGlobals();clearSession();});
it("passes cancellation to fetch without turning it into a network error", async () => {
  const controller = new AbortController();
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
    expect(options.signal).toBe(controller.signal);
    controller.abort(); throw new DOMException("Aborted", "AbortError");
  }));
  await expect(apiFetch("/transactions", {signal:controller.signal})).rejects.toMatchObject({name:"AbortError"});
});

it("coalesces concurrent token refreshes and retries with the new access token", async () => {
  startSession("old","A");
  let refreshes = 0;
  vi.stubGlobal("fetch", vi.fn(async (url, options) => {
    if (String(url).endsWith("/auth/refresh")) {
      ++refreshes;return new Response(JSON.stringify({status:"success",data:{access_token:"new"}}));
    }
    if (options.headers.Authorization === "Bearer old") return new Response(null,{status:401});
    expect(options.headers.Authorization).toBe("Bearer new");
    return new Response(JSON.stringify({status:"success",data:[]}));
  }));
  await Promise.all([apiFetch("/accounts"),apiFetch("/goals")]);
  expect(refreshes).toBe(1);
});

it("never retries an old account's request under a newly signed-in account", async () => {
  startSession("old","A");
  const fetch = vi.fn(async () => {startSession("new","B");return new Response(null,{status:401});});
  vi.stubGlobal("fetch",fetch);
  await expect(apiFetch("/accounts")).rejects.toMatchObject({code:"SESSION_CHANGED"});
  expect(fetch).toHaveBeenCalledOnce();
});
it("preserves field errors and handles empty 204 responses", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({status:"error",message:"Check amount",data:{code:"VALIDATION_ERROR",details:[{path:"amount",message:"Must be positive"}]}}), {status:400})));
  await expect(apiFetch("/transactions")).rejects.toMatchObject({status:400,code:"VALIDATION_ERROR",fieldErrors:{amount:"Must be positive"}} satisfies Partial<ApiError>);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, {status:204})));
  await expect(apiFetch("/transactions/one", {method:"DELETE"})).resolves.toBeUndefined();
});
