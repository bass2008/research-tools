import { describe, expect, it, vi } from "vitest";

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

describe("карта сайта вне боевого контура", () => {
  it("на тесте не отдаётся вовсе", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://test.arcana-sense.ru");
    vi.resetModules();
    const { default: onTest } = await import("./sitemap");
    expect(onTest()).toEqual([]);
    vi.unstubAllEnvs();
    vi.resetModules();
  });
});
