import type { ErrorEvent } from "@sentry/browser";
import { describe, expect, it } from "vitest";

import { deviceTags, isOurError, isOurEvent, pathTemplate, scrubEvent, scrubText, stripQuery } from "./errors";

describe("error reports carry no personal data", () => {
  it("hides e-mails and birth dates in any text", () => {
    expect(scrubText("вход a.zaremka@bk.ru не удался, дата 31.03.1993 и 1993-03-31, путь /matrix/31-03-1993"))
      .toBe("вход [email] не удался, дата [date] и [date], путь /matrix/[date]");
    expect(scrubText("юзер@почта.рф")).toBe("[email]");
  });

  it("drops query strings and numbers in API paths", () => {
    expect(stripQuery("https://arcana-sense.ru/report?m=42&lang=ru#s1")).toBe("https://arcana-sense.ru/report");
    expect(pathTemplate("/matrices/42/title?x=1")).toBe("/matrices/:n/title");
    expect(pathTemplate("/auth/login")).toBe("/auth/login");
  });

  it.each([
    ["Mozilla/5.0 (Linux; Android 12; Xiaomi 12T Pro Build/SKQ1.220303.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.7049.79 Mobile Safari/537.36 XiaoMi/MiuiBrowser/14.62.0-gn",
      { browser: "MiuiBrowser 14.62.0", os: "Android 12", device: "Xiaomi 12T Pro" }],
    ["Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36",
      { browser: "Chrome 152.0.0.0", os: "Android 10" }],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1",
      { browser: "Safari 26.5.2", os: "iOS 18.7" }],
    ["Mozilla/5.0 (Linux; Android 13; SM-A536B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36",
      { browser: "Chrome 140.0.0.0", os: "Android 13", device: "SM-A536B", webview: "yes" }],
  ])("names the browser and device: %s", (ua, tags) => {
    expect(deviceTags(ua)).toEqual(tags);
  });

  it("accepts only errors thrown by our own bundles", () => {
    expect(isOurError("TypeError: x\n    at r (https://arcana-sense.ru/_next/static/chunks/1i.js:476:18212)")).toBe(true);
    expect(isOurError("Error: boom\n    at x (chrome-extension://abcdef/content.js:1:1)")).toBe(false);
    expect(isOurError("Error: boom\n    at x (chrome-extension://abc/c.js:1:1)\n    at y (https://arcana-sense.ru/_next/static/chunks/a.js:1:1)")).toBe(false);
    expect(isOurError("Error: tag\n    at y (https://mc.yandex.ru/metrika/tag.js:1:1)")).toBe(false);
    expect(isOurError(undefined)).toBe(false);
  });

  it("drops SDK events whose frames have no file of ours", () => {
    const event = (...files: (string | undefined)[]) =>
      ({ type: undefined, exception: { values: [{ stacktrace: { frames: files.map((filename) => ({ filename })) } }] } }) as ErrorEvent;
    expect(isOurEvent(event("https://arcana-sense.ru/_next/static/chunks/a.js"))).toBe(true);
    expect(isOurEvent(event(undefined, "<anonymous>"))).toBe(false);
    expect(isOurEvent(event("https://arcana-sense.ru/injected-by-isp.js"))).toBe(false);
    expect(isOurEvent({ type: undefined, message: "Non-Error promise rejection" } as ErrorEvent)).toBe(false);
  });

  it("strips the event before it leaves the browser", () => {
    const event = scrubEvent({
      type: undefined,
      message: "Проверка формы pay: email:no-at",
      user: { email: "a@b.ru", ip_address: "1.2.3.4" },
      breadcrumbs: [{ message: "click" }],
      request: {
        url: "https://arcana-sense.ru/report?m=42",
        query_string: "m=42",
        headers: { Referer: "https://arcana-sense.ru/pay?m=7", "User-Agent": "UA" },
      },
      extra: { page: "/matrix/31-03-1993", note: "почта a@b.ru" },
      exception: { values: [{ type: "TypeError", stacktrace: { frames: [{ filename: "https://arcana-sense.ru/_next/app.js?v=1" }] } }] },
    } as unknown as ErrorEvent);
    expect(event.user).toBeUndefined();
    expect(event.breadcrumbs).toBeUndefined();
    expect(event.request).toEqual({ url: "https://arcana-sense.ru/report", headers: { Referer: "https://arcana-sense.ru/pay", "User-Agent": "UA" } });
    expect(event.extra).toEqual({ page: "/matrix/[date]", note: "почта [email]" });
    expect(event.exception?.values?.[0].stacktrace?.frames?.[0].filename).toBe("https://arcana-sense.ru/_next/app.js");
  });
});
