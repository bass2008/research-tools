import { describe, expect, it } from "vitest";

import sitemap from "./sitemap";

// Дефект A17: карту сайта пополняли вручную, и юридические страницы попали в неё не все.
describe("карта сайта", () => {
  const paths = sitemap().map((entry) => new URL(entry.url).pathname);

  it.each(["/", "/encyclopedia", "/matrix", "/oferta", "/privacy", "/refund", "/contacts"])(
    "содержит %s",
    (path) => {
      expect(paths).toContain(path);
    },
  );

  it("не выдаёт приватные адреса", () => {
    for (const hidden of ["/report", "/account", "/pay", "/matrices", "/admin"]) {
      expect(paths).not.toContain(hidden);
    }
  });
});
