import { describe, expect, it, vi } from "vitest";

import sitemap from "./sitemap";
import { indexedKarmicTailKeys, karmicTailKeys } from "@/lib/content";
import { SPEC } from "@/lib/sections";
import {
  SERVICE_PAGES,
  hasServicePage,
  servicePages,
  type ServiceKey,
} from "@/lib/servicePages";

// Дефект A17: карту сайта пополняли вручную, и юридические страницы попали в неё не все.
// Теперь набор служебных страниц задан реестром `lib/servicePages.ts`, и он же проверяется:
// у языка, где страницы нет, её не должно быть и в карте.
const SERVICE_PATHS = servicePages().map((key) => SERVICE_PAGES[key].path);
// адреса первого уровня, которые не являются концепт-хабами
const STATIC_PATHS = ["/", "/encyclopedia", "/year", ...SERVICE_PATHS];

describe("карта сайта", () => {
  const paths = sitemap().map((entry) => new URL(entry.url).pathname);

  it.each(["/", "/encyclopedia", ...SERVICE_PATHS])("содержит %s", (path) => {
    expect(paths).toContain(path);
  });

  // Источников у карты несколько, и «О методе» какое-то время стоял в ней дважды: он и хаб,
  // и служебная страница. Поиск читает дубль как признак того, что сайт не знает своих адресов.
  it("каждый адрес встречается один раз", () => {
    const seen = paths.filter((path, i) => paths.indexOf(path) !== i);
    expect([...new Set(seen)]).toEqual([]);
  });

  it("не обещает поиску страницу, которой на этом языке нет", () => {
    const missing = (Object.keys(SERVICE_PAGES) as ServiceKey[])
      .filter((key) => !hasServicePage(key))
      .map((key) => SERVICE_PAGES[key].path);
    for (const path of missing) expect(paths, path).not.toContain(path);
  });

  // Шапка раздела — цель обхода, с которой раздаётся весь раздел, и собственный ответ на его
  // головной запрос. Без записи в карте она осталась бы страницей без входящих ссылок из поиска.
  it.each([
    "/encyclopedia/arcanum",
    "/encyclopedia/position",
    "/encyclopedia/chakra",
    "/encyclopedia/combination",
    "/encyclopedia/karmic-tail",
    "/year",
  ])("содержит шапку раздела %s", (path) => {
    expect(paths).toContain(path);
  });

  // Приоритет шапки выше листа: иначе карта заявляет, что 231 пара важнее страницы, с которой
  // они раздаются.
  it("ставит шапкам приоритет выше листьев", () => {
    const by = new Map(sitemap().map((e) => [new URL(e.url).pathname, e.priority ?? 0]));
    for (const [hub, leaf] of [
      ["/encyclopedia/arcanum", "/encyclopedia/arcanum/4"],
      ["/encyclopedia/chakra", "/encyclopedia/chakra/anahata"],
      ["/encyclopedia/combination", "/encyclopedia/combination/8-11"],
      ["/encyclopedia/position", "/encyclopedia/position/center"],
    ] as const) {
      expect(by.get(hub)).toBeGreaterThan(by.get(leaf) ?? 0);
    }
  });

  // 5544 почти-дубля тянули домен вниз: страницы остались как результат расчёта, но закрыты
  // noindex и из карты убраны. Сторож, чтобы они не вернулись вместе с новой категорией.
  //
  // Каталог `/matrix` убран вместе с ними: спроса на список всех матриц нет, а его содержимое —
  // ссылки на закрытые от обхода адреса. Страница живёт и закрыта `noindex`, но заявлять её
  // поиску как цель обхода незачем.
  it("не содержит ни страниц матриц, ни их каталога", () => {
    expect(paths.filter((p) => /^\/matrix(\/.*)?$/.test(p))).toEqual([]);
  });

  // Тест утверждал только отсутствие персональных разборов. Потеря раздела из positions.json
  // делала карту тихо короче, и он оставался зелёным — а общая статья и есть то единственное,
  // что этот релиз отдаёт в индекс.
  it("содержит общую статью каждого из 20 разделов отчёта", () => {
    expect(SPEC).toHaveLength(20);
    const missing = SPEC.map((section) => section.key)
      .filter((key) => !paths.includes(`/encyclopedia/position/${key}`));
    expect(missing, "разделов нет в карте сайта").toEqual([]);
  });

  it("не содержит персональных статей разделов отчёта", () => {
    const personalSections = [
      "character", "comfort", "profession", "realisation", "karma40", "resources",
      "family_gifts", "soul_tasks", "purpose", "money", "money40", "relations",
      "parents_children", "ancestry", "body_resource", "chakras", "rest", "loops", "years",
    ];
    for (const section of personalSections) {
      expect(paths.filter((p) => p.startsWith(`/encyclopedia/${section}/`)), section).toEqual([]);
    }
  });

  // Ключ в hubs.json без файла-роута дал бы в карте адрес, которого нет, — 404 из sitemap.
  it("не выдаёт корневой хаб, для которого нет роута", async () => {
    const { ROOT_HUBS } = await import("@/lib/encyclopedia");
    const roots = paths.filter((p) => /^\/[a-z-]+$/.test(p) && !STATIC_PATHS.includes(p));
    for (const p of roots) expect(ROOT_HUBS).toContain(p.slice(1));
  });

  it("держит шапки категорий независимо от наличия статей", () => {
    expect(paths).toContain("/year");
    expect(paths).toContain("/encyclopedia/karmic-tail");
  });

  it("выдаёт разобранные кармические хвосты", () => {
    expect(paths).toContain("/encyclopedia/karmic-tail");
    expect(paths.some((p) => p.startsWith("/encyclopedia/karmic-tail/"))).toBe(true);
  });

  // Порога спроса у хвостов больше нет: метод даёт ровно 26 достижимых троек, статьи написаны
  // на все, и закрывать готовую страницу из-за того, что Вордстат не показал по ней частоту,
  // значит доверять отсутствию данных больше, чем самому тексту.
  it("выдаёт все достижимые хвосты", () => {
    const published = paths
      .filter((p) => p.startsWith("/encyclopedia/karmic-tail/"))
      .map((p) => p.split("/").at(-1)!)
      .sort();
    expect(published).toEqual(karmicTailKeys().sort());
    expect(published).toEqual(indexedKarmicTailKeys().sort());
    expect(published).toHaveLength(26);
  });

  // Даты в карте нет намеренно: честной она была бы только постраничной, а общая дата корпуса
  // объявляла изменившимися все 444 адреса при правке одной статьи. Возврат такой даты — не
  // улучшение, а возврат к неправде, поэтому её отсутствие закреплено тестом.
  it("не ставит адресам дату правки", () => {
    expect(sitemap().filter((entry) => entry.lastModified !== undefined)).toEqual([]);
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
