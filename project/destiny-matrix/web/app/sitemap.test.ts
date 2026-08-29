import { describe, expect, it, vi } from "vitest";

import sitemap from "./sitemap";

// Дефект A17: карту сайта пополняли вручную, и юридические страницы попали в неё не все.
// адреса первого уровня, которые не являются концепт-хабами
const STATIC_PATHS = ["/", "/encyclopedia", "/matrix", "/na-god", "/contacts", "/oferta",
  "/privacy", "/refund"];

describe("карта сайта", () => {
  const paths = sitemap().map((entry) => new URL(entry.url).pathname);

  it.each(["/", "/encyclopedia", "/matrix", "/oferta", "/privacy", "/refund", "/contacts"])(
    "содержит %s",
    (path) => {
      expect(paths).toContain(path);
    },
  );

  // 5544 почти-дубля тянули домен вниз: страницы остались как результат расчёта, но закрыты
  // noindex и из карты убраны. Сторож, чтобы они не вернулись вместе с новой категорией.
  it("не содержит страниц матриц", () => {
    expect(paths.filter((p) => /^\/matrix\/.+/.test(p))).toEqual([]);
    expect(paths).toContain("/matrix");
  });

  // Ключ в hubs.json без файла-роута дал бы в карте адрес, которого нет, — 404 из sitemap.
  it("не выдаёт корневой хаб, для которого нет роута", async () => {
    const { ROOT_HUBS } = await import("@/lib/encyclopedia");
    const roots = paths.filter((p) => /^\/[a-z-]+$/.test(p) && !STATIC_PATHS.includes(p));
    for (const p of roots) expect(ROOT_HUBS).toContain(p.slice(1));
  });

  it("держит шапки категорий независимо от наличия статей", () => {
    expect(paths).toContain("/na-god");
    expect(paths).toContain("/encyclopedia/karmic-tail");
  });

  it("выдаёт разобранные кармические хвосты", () => {
    expect(paths).toContain("/encyclopedia/karmic-tail");
    expect(paths.some((p) => p.startsWith("/encyclopedia/karmic-tail/"))).toBe(true);
  });

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
