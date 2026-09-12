import { describe, expect, it } from "vitest";

import { config, middleware } from "./middleware";

// Заголовок, которым Next передаёт вниз изменённый список заголовков запроса.
const forwarded = (response: ReturnType<typeof middleware>) =>
  response.headers.get("x-middleware-override-headers");

function call(headers: Record<string, string>, pathname = "/o-metode") {
  const request = {
    method: "GET",
    headers: new Headers(headers),
    nextUrl: new URL(pathname, "https://arcana-sense.ru"),
  } as unknown as Parameters<typeof middleware>[0];
  return middleware(request);
}

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
      expect(forwarded(call({ "user-agent": "probe", ...extra }))).toBeNull();
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
