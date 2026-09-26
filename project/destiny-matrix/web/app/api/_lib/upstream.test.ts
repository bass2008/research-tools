import { afterEach, describe, expect, it, vi } from "vitest";

const { cookieGet } = vi.hoisted(() => ({ cookieGet: vi.fn() }));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: `arcana-sense.${process.env.NEXT_PUBLIC_SITE_LANG === "en" ? "com" : "ru"}`, "x-arcana-path": "/api/test" }),
  cookies: async () => ({ get: cookieGet }),
}));

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
  cookieGet.mockReset();
});

describe("доверенный IP в цепочке nginx → BFF → API", () => {
  it("replaces a forged RU context with the COM Host, even when Russian is selected", async () => {
    const spy = stubUpstream();
    const source = new Request("https://arcana-sense.com/api/payments/start", {
      headers: {
        "Accept-Language": "ru",
        "X-Arcana-Site-Origin": "https://arcana-sense.ru",
        "X-Forwarded-Host": "arcana-sense.ru",
      },
    });
    await forward("/payments/start", { source });
    const headers = new Headers(spy.mock.calls[0][1]?.headers);
    expect(headers.get("X-Arcana-Site-Origin")).toBe("https://arcana-sense.com");
    expect(headers.get("Accept-Language")).toBe("ru");
    expect(headers.get("X-Forwarded-Host")).toBeNull();
  });

  it("forwards a supported request language independently of the session", async () => {
    const spy = stubUpstream();
    const source = new Request("https://arcana-sense.com/api/tariffs", {
      headers: { "Accept-Language": "de-DE,en-US;q=0.8,ru;q=0.5" },
    });
    await forward("/tariffs", { source });
    expect(new Headers(spy.mock.calls[0][1]?.headers).get("accept-language")).toBe("en");
  });

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

describe("необязательная сессия BFF", () => {
  it("передаёт JWT авторизованного pulse", async () => {
    const spy = stubUpstream();
    cookieGet.mockReturnValue({ value: "signed-session" });

    await forward("/pulse", { method: "POST", body: {}, optionalAuth: true });

    const [, init] = spy.mock.calls[0];
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer signed-session");
  });

  it("не отклоняет pulse гостя", async () => {
    const spy = stubUpstream();
    cookieGet.mockReturnValue(undefined);

    const answer = await forward("/pulse", { method: "POST", body: {}, optionalAuth: true });

    expect(answer.status).toBe(200);
    const [, init] = spy.mock.calls[0];
    expect(new Headers(init?.headers).get("authorization")).toBeNull();
  });
});
