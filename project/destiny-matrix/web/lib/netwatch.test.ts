import { afterEach, describe, expect, it, vi } from "vitest";

type Netwatch = typeof import("./netwatch");

async function browser(original: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>, online = true) {
  const win = Object.assign(new EventTarget(), { fetch: vi.fn(original) });
  vi.stubGlobal("window", win);
  vi.stubGlobal("location", { href: "https://arcana-sense.ru/login", origin: "https://arcana-sense.ru" });
  vi.stubGlobal("navigator", { onLine: online });
  vi.resetModules();
  const netwatch: Netwatch = await import("./netwatch");
  netwatch.installNetwatch();
  const seen: string[] = [];
  netwatch.onFailure((failure) => seen.push(`${failure.cause} ${failure.method} ${failure.path}`));
  return { win, seen };
}

const refuse = async () => {
  throw new TypeError("Failed to fetch");
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 350));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("одна точка наблюдения за запросами", () => {
  it("видит любой запрос к нашему API, кто бы его ни отправил", async () => {
    const { win, seen } = await browser(refuse);
    await win.fetch("/api/sections?slug=x").catch(() => null);
    await win.fetch("/api/auth/login", { method: "post" }).catch(() => null);
    await settle();
    expect(seen).toEqual(["network GET /api/sections?slug=x", "network POST /api/auth/login"]);
  });

  it("не трогает пинги, страницы и чужие адреса", async () => {
    const { win, seen } = await browser(refuse);
    for (const url of ["/api/pulse", "/encyclopedia?_rsc=1", "https://mc.yandex.ru/watch"]) await win.fetch(url).catch(() => null);
    await settle();
    expect(seen).toEqual([]);
  });

  it("ответ 5xx — сбой сервера, 4xx — обычный ответ", async () => {
    const { win, seen } = await browser(async (input) => new Response("{}", { status: String(input).includes("broken") ? 502 : 401 }));
    await win.fetch("/api/broken");
    await win.fetch("/api/auth/login");
    expect(seen).toEqual(["status GET /api/broken"]);
  });

  it("уход со страницы и отмена запроса — не ошибка", async () => {
    const { win, seen } = await browser(async () => {
      throw new DOMException("The user aborted a request.", "AbortError");
    });
    await win.fetch("/api/payments").catch(() => null);
    await settle();
    expect(seen).toEqual([]);

    const leaving = await browser(refuse);
    await leaving.win.fetch("/api/matrices").catch(() => null);
    leaving.win.dispatchEvent(new Event("pagehide"));
    await settle();
    expect(leaving.seen).toEqual([]);
  });

  it("ссылка на почту не уход: страница осталась, сбой виден", async () => {
    const { win, seen } = await browser(refuse);
    win.dispatchEvent(new Event("beforeunload"));
    await win.fetch("/api/matrices").catch(() => null);
    await settle();
    expect(seen).toEqual(["network GET /api/matrices"]);
  });

  it("без интернета причина — связь посетителя, а не наш сервер", async () => {
    const { win, seen } = await browser(refuse, false);
    await win.fetch("/api/auth/login", { method: "POST" }).catch(() => null);
    await settle();
    expect(seen).toEqual(["offline POST /api/auth/login"]);
  });
});
