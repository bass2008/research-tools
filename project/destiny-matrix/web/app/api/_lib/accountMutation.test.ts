import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { cookieGet } = vi.hoisted(() => ({ cookieGet: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "arcana-sense.ru" }), cookies: async () => ({ get: cookieGet }) }));
import { accountMutation } from "./accountMutation";
import { forward } from "./upstream";

// Production shape: Next sees its own bind address in req.url, nginx passes the public Host.
function request(origin = "https://arcana-sense.ru", contentType = "application/json") {
  return new Request("https://0.0.0.0:3000/api/auth/password/change", { method: "POST", headers: { Origin: origin, Host: "arcana-sense.ru", "Content-Type": contentType }, body: JSON.stringify({ current_password: "old", new_password: "new" }) });
}
beforeEach(() => cookieGet.mockReturnValue({ value: "old-session" }));
afterEach(() => { vi.unstubAllGlobals(); cookieGet.mockReset(); });
describe("cookie account mutations", () => {
  it("rejects cross-origin and non-JSON before contacting API", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect((await accountMutation(request("https://other.example"), "/auth/password/change")).status).toBe(403);
    expect((await accountMutation(request("https://arcana-sense.ru.other.example"), "/auth/password/change")).status).toBe(403);
    expect((await accountMutation(request("null"), "/auth/password/change")).status).toBe(403);
    expect((await accountMutation(request("https://arcana-sense.ru", "text/plain"), "/auth/password/change")).status).toBe(415);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("captures the rotated session only in httpOnly cookie", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ token: "rotated-session", user: { id: 1 } })));
    const result = await accountMutation(request(), "/auth/password/change", true, true);
    expect(result.status).toBe(200);
    expect((await result.json()).token).toBeUndefined();
    expect(result.headers.get("set-cookie")).toContain("rotated-session");
    expect(result.headers.get("set-cookie")).toContain("HttpOnly");
  });
  it("clears session after final email confirmation, not the first side", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ changed: false })));
    expect((await accountMutation(request(), "/auth/email/change/confirm", false)).headers.get("set-cookie")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ changed: true })));
    expect((await accountMutation(request(), "/auth/email/change/confirm", false)).headers.get("set-cookie")).toContain("Max-Age=0");
  });
  it("forwards 204 deletion without constructing an invalid JSON body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    const result = await forward("/readings/1", { method: "DELETE", auth: true, source: request() });
    expect(result.status).toBe(204); expect(await result.text()).toBe("");
  });
});
