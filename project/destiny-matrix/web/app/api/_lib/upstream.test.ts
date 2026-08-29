import { afterEach, describe, expect, it, vi } from "vitest";

import { forward, trustedClientIp } from "./upstream";

function stubUpstream() {
  const spy = vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("доверенный IP в цепочке nginx → BFF → API", () => {
  it("передаёт X-Real-IP от nginx и не переносит поддельный X-Forwarded-For", async () => {
    const spy = stubUpstream();
    const source = new Request("https://arcana-sense.ru/api/auth/login", {
      headers: {
        "X-Real-IP": "40.69.0.186",
        "X-Forwarded-For": "203.0.113.77, 40.69.0.186",
      },
    });

    expect(trustedClientIp(source)).toBe("40.69.0.186");
    await forward("/auth/login", { method: "POST", body: {}, source });

    const [, init] = spy.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get("x-real-ip")).toBe("40.69.0.186");
    expect(headers.get("x-forwarded-for")).toBeNull();
  });

  it("не отправляет заголовок, если вместо IP пришёл мусор", async () => {
    const spy = stubUpstream();
    const source = new Request("https://arcana-sense.ru/api/auth/login", {
      headers: {
        "X-Real-IP": "not-an-ip",
        "X-Forwarded-For": "203.0.113.77",
      },
    });

    expect(trustedClientIp(source)).toBeNull();
    await forward("/auth/login", { method: "POST", body: {}, source });

    const [, init] = spy.mock.calls[0];
    expect(new Headers(init?.headers).get("x-real-ip")).toBeNull();
  });
});
