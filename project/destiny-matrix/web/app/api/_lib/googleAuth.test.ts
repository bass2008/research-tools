import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { cookieGet } = vi.hoisted(() => ({ cookieGet: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "arcana-sense.com" }), cookies: async () => ({ get: cookieGet }) }));
import { POST as webLogin } from "../auth/google/route";
import { POST as webChallenge } from "../auth/google/challenge/route";
import { GET as webConfig } from "../auth/google/config/route";
import { POST as nativeLogin } from "../mobile/auth/google/route";
import { POST as nativeChallenge } from "../mobile/auth/google/challenge/route";
import { GET as nativeConfig } from "../mobile/auth/google/config/route";

beforeEach(() => cookieGet.mockReturnValue(undefined));
afterEach(() => { vi.unstubAllGlobals(); cookieGet.mockReset(); });
const payload = { credential: "google-id-token", challenge: "one-use-challenge" };
function req(body: unknown = payload, native = false, origin = "https://arcana-sense.com") {
  return new Request("https://0.0.0.0:3000/api/auth/google", { method: "POST", headers: {
    Host: "arcana-sense.com", "Content-Type": "application/json", "Accept-Language": "en",
    ...(!native ? { Origin: origin } : {}),
  }, body: JSON.stringify(body) });
}
it("captures web login in HttpOnly only, preserving password state and restore-only metadata", async () => {
  const deletion = { requested_at: "2026-11-09", delete_at: "2026-12-09", renewal_cancellation: "complete" };
  const fetcher = vi.fn(async () => Response.json({ token: "session-secret", user: { id: 5, has_password: false }, deletion }));
  vi.stubGlobal("fetch", fetcher);
  const response = await webLogin(req());
  expect(await response.json()).toEqual({ authenticated: true, user: { id: 5, has_password: false }, deletion });
  expect(response.headers.get("set-cookie")).toContain("session-secret");
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(fetcher).toHaveBeenCalledOnce();
});
it.each([webLogin, webChallenge])("rejects cross-origin, missing-origin and non-JSON web mutation", async handler => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  for (const origin of ["https://other.example", "null", "https://arcana-sense.com.evil.test"]) {
    const request = req(payload, false, origin); request.headers.set("X-Arcana-Session", "untrusted");
    expect((await handler(request)).status).toBe(403);
  }
  expect((await handler(req(payload, true))).status).toBe(403);
  for (const type of ["text/plain", "application/jsonp"]) {
    const request = req(); request.headers.set("content-type", type);
    expect((await handler(request)).status).toBe(415);
  }
  expect(fetcher).not.toHaveBeenCalled();
});
it.each([nativeLogin, nativeChallenge, nativeConfig])("native mode rejects browser origins, fetch metadata and session cookies", async handler => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  expect((await handler(req())).status).toBe(403);
  const request = req(payload, true); request.headers.set("Sec-Fetch-Site", "same-origin");
  expect((await handler(request)).status).toBe(403);
  cookieGet.mockReturnValue({ value: "browser-session" });
  expect((await handler(req(payload, true))).status).toBe(403);
  expect(fetcher).not.toHaveBeenCalled();
});
it("returns native token without a cookie and forwards only credential, challenge and password", async () => {
  const fetcher = vi.fn(async () => Response.json({ token: "native-token", user: { id: 5, has_password: true } }));
  vi.stubGlobal("fetch", fetcher);
  const response = await nativeLogin(req({ ...payload, current_password: "existing-password", email: "victim@example.test", user: { id: 1 } }, true));
  expect(await response.json()).toEqual({ token: "native-token", user: { id: 5, has_password: true } });
  expect(response.headers.get("set-cookie")).toBeNull();
  const init = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(JSON.parse(String(init[1].body))).toEqual({ ...payload, current_password: "existing-password" });
  expect(new Headers(init[1].headers).get("Authorization")).toBeNull();
});
it.each([webLogin, nativeLogin])("preserves the explicit linking code without capturing a session", async handler => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ detail: "Confirm existing password", code: "google_link_required" }, { status: 409 })));
  const response = await handler(req(payload, handler === nativeLogin));
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ detail: "Confirm existing password", code: "google_link_required" });
  expect(response.headers.get("set-cookie")).toBeNull();
});
it.each([{}, [], { ...payload, credential: "" }, { ...payload, challenge: 4 }, { ...payload, current_password: {} }])("rejects malformed credential payload before upstream: %j", async body => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  expect((await webLogin(req(body))).status).toBeGreaterThanOrEqual(400);
  expect(fetcher).not.toHaveBeenCalled();
});
it("rejects malformed challenge JSON and passes a server nonce unchanged", async () => {
  const data = { challenge: "server-challenge", nonce: "server-nonce", client_id: "client.apps.googleusercontent.com" };
  const fetcher = vi.fn(async () => Response.json(data)); vi.stubGlobal("fetch", fetcher);
  const bad = req(); Object.defineProperty(bad, "json", { value: async () => { throw new SyntaxError(); } });
  expect((await webChallenge(bad)).status).toBe(400); expect(fetcher).not.toHaveBeenCalled();
  expect(await (await webChallenge(req({}))).json()).toEqual(data);
});
it.each([webConfig, nativeConfig])("passes disabled configuration without inventing a client ID", async handler => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ enabled: false, client_id: null })));
  const response = await handler(req({}, true));
  expect(response.status).toBe(200); expect(await response.json()).toEqual({ enabled: false, client_id: null });
  expect(response.headers.get("set-cookie")).toBeNull();
});
it("returns a controlled upstream error when Google configuration is unavailable", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Offline"); }));
  expect((await webConfig(req({}, true))).status).toBe(502);
});
