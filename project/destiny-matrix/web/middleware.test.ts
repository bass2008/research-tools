import { describe, expect, it } from "vitest";

import { config, middleware } from "./middleware";

// Заголовок, которым Next передаёт вниз изменённый список заголовков запроса.
const forwarded = (response: ReturnType<typeof middleware>) =>
  response.headers.get("x-middleware-override-headers");

function call(headers: Record<string, string>, pathname = "/o-metode") {
  const request = {
    url: new URL(pathname, "https://arcana-sense.ru").toString(),
    method: "GET",
    headers: new Headers({ host: "arcana-sense.ru", ...headers }),
    nextUrl: new URL(pathname, "https://arcana-sense.ru"),
  } as unknown as Parameters<typeof middleware>[0];
  return middleware(request);
}

describe("missing content keeps its localized HTML before streaming", () => {
  it.each(["arcana-sense.ru", "arcana-sense.com"])("returns the standalone 404 for %s", (host) => {
    for (const path of ["/encyclopedia/arcanum/99", "/encyclopedia/chakra/nope",
      "/encyclopedia/position/not-real/7", "/encyclopedia/position/center/99",
      "/matrix/9-9-9999", "/year/99", "/encyclopedia/combination/1-99",
      "/encyclopedia/karmic-tail/1-2-3"]) {
      const response = call({ host }, path);
      expect(response.status, path).toBe(404);
      expect(response.headers.get("x-middleware-rewrite"), path).toContain("/_missing-content");
    }
    for (const path of ["/encyclopedia/arcanum/7", "/encyclopedia/chakra/anahata",
      "/matrix/1-1-2", "/year/7", "/encyclopedia/combination/7-18", "/api/matrices"]) {
      expect(call({ host }, path).headers.get("x-middleware-rewrite"), path).toBeNull();
    }
  });
});

// RFC 9110 §13.1.3: при наличии `If-None-Match` дату надо игнорировать. Next её не игнорирует и
// теряет совпавший отпечаток — вместо `304` уходит полное тело. Здесь сторожится обход.
describe("условные заголовки", () => {
  it("снимает дату, когда пришёл отпечаток", () => {
    const list = forwarded(call({ "if-none-match": '"abc"', "if-modified-since": "Mon, 01 Sep 2026 00:00:00 GMT" }));
    expect(list).not.toContain("if-modified-since");
    expect(list).toContain("if-none-match");
  });

  // Без отпечатка снимать нечего: пусть Next разбирается сам, как разбирался бы без middleware.
  it.each([["без условий", {}], ["с одной датой", { "if-modified-since": "Mon, 01 Sep 2026 00:00:00 GMT" }],
           ["с пустым отпечатком", { "if-none-match": "" }],
           ["с пробелами вместо отпечатка", { "if-none-match": "   " }]])(
    "запрос %s не трогает", (_name, extra) => {
      const response = call({ "user-agent": "probe", ...extra });
      for (const [key, value] of Object.entries(extra)) {
        expect(response.headers.get(`x-middleware-request-${key}`)).toBe(value.trim());
      }
      expect(response.headers.get("x-middleware-request-user-agent")).toBe("probe");
    });

  // §13.1.2: `*` подходит любому существующему представлению, значит на несуществующем адресе
  // условие ложно. Next отвечает на него `304` и там, где живой ответ `404`.
  it("снимает звёздочку целиком", () => {
    const list = forwarded(call({ "if-none-match": "*", "user-agent": "probe" }));
    expect(list).not.toContain("if-none-match");
    expect(list).toContain("user-agent");
  });

  it("звёздочку в списке с тегами не трогает", () => {
    expect(forwarded(call({ "if-none-match": '"a", *' }))).toContain("if-none-match");
  });

  it("остальные заголовки доезжают", () => {
    const list = forwarded(call({ "if-none-match": '"abc"', "if-modified-since": "x", "user-agent": "probe" }));
    expect(list).toContain("user-agent");
  });
});

describe("список адресов", () => {
  const covers = (path: string) =>
    config.matcher.some((pattern) => new RegExp(`^${pattern}$`).test(path));

  it.each(["/", "/o-metode", "/encyclopedia/arcanum/7", "/matrix/1-1-1990", "/report", "/sitemap.xml"])(
    "покрывает %s", (path) => expect(covers(path)).toBe(true),
  );

  it.each(["/_next/static/chunks/main.js", "/_next/image"])(
    "не трогает статику %s", (path) => expect(covers(path)).toBe(false),
  );
});

describe("domain and public locale isolation", () => {
  it("rejects unknown Host even if forwarded/internal headers claim a known site", () => {
    const response = call({ host: "evil.example", "x-forwarded-host": "arcana-sense.com", "x-arcana-path": "/account" });
    expect(response.status).toBe(421);
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });

  it("overwrites visitor-supplied render context", () => {
    const response = call({ host: "arcana-sense.com", "x-arcana-path": "/account", "x-arcana-interactive": "1" }, "/encyclopedia");
    expect(response.headers.get("x-middleware-request-x-arcana-path")).toBe("/encyclopedia");
    expect(response.headers.get("x-middleware-request-x-arcana-interactive")).toBe("0");
  });

  it("removes public lang links without setting a language cookie", () => {
    const response = call({ host: "arcana-sense.com" }, "/encyclopedia/arcanum/4?lang=ru&tab=meaning");
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://arcana-sense.com/encyclopedia/arcanum/4?tab=meaning");
    expect(response.headers.has("set-cookie")).toBe(false);
  });

  it("allows language links for private reports, constrained by the domain", () => {
    expect(call({ host: "arcana-sense.com" }, "/report?lang=ru").headers.get("set-cookie")).toContain("arcana_locale=ru");
    expect(call({ host: "arcana-sense.ru" }, "/report?lang=en").headers.has("set-cookie")).toBe(false);
  });

  it("marks interactive RSC responses as private and non-indexable", () => {
    const response = call({ host: "arcana-sense.com", rsc: "1", cookie: "arcana_locale=ru" }, "/encyclopedia");
    expect(response.headers.get("x-middleware-request-x-arcana-interactive")).toBe("1");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
