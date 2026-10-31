import { splitPublicPath } from "@/lib/publicRouting";
import { describe, expect, it, vi } from "vitest";

import { robotsForSite as robots } from "@/lib/robotsPolicy";
import { sitemapForSite as sitemap } from "@/lib/sitemapEntries";
import { PERSONAL_SECTION_KEYS } from "@/lib/sectionReadingShared";
import { verification } from "@/lib/seo";

// SITE.url читается на импорте, поэтому контур подменяем до него — иначе проверять нечего.

describe("robots.txt", () => {
  const rules = [robots().rules].flat();
  const groupFor = (agent: string) => {
    const rule = rules.find((r) => r.userAgent === agent);
    return rule ? { ...rule, disallow: [rule.disallow].flat().map((path) => path ? splitPublicPath(path).path : path) } : undefined;
  };
  const closed = (agent: string) => [groupFor(agent)?.disallow].flat().includes("/");

  it.each(["GPTBot", "ClaudeBot", "CCBot", "AhrefsBot"])("закрывает %s целиком", (agent) => {
    expect(closed(agent)).toBe(true);
  });

  // Поисковые боты ИИ-сервисов приводят людей и ставят ссылку на источник — их закрывать нельзя,
  // хотя имена похожи на обучающие краулеры тех же компаний.
  it.each(["YandexBot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot"])(
    "не мешает %s",
    (agent) => {
      expect(groupFor(agent)).toBeUndefined();
    },
  );

  // Открытость задана отсутствием запрета, а не строкой `Allow: /`: Next печатает её раньше
  // `Disallow`, и парсер «первое совпадение» считал бы разрешённым весь сайт целиком.
  it("оставляет сайт открытым для остальных, не перебивая запреты", () => {
    const common = groupFor("*");
    expect(common?.allow).toBeUndefined();
    expect([common?.disallow].flat()).toContain("/account");
  });

  // `noindex` обход не запрещает: робот качает страницу целиком, чтобы прочитать мету. Норму
  // обхода экономит только `Disallow`, поэтому персональные разборы закрыты префиксами.
  it("закрывает от обхода результаты расчёта", () => {
    const disallow = [groupFor("*")?.disallow].flat();
    const missing = [...PERSONAL_SECTION_KEYS, "character"].filter(
      (section) => !disallow.includes(`/encyclopedia/${section}/`),
    );
    expect(missing).toEqual([]);
  });

  // Параметры интерфейса давали неканонические адреса, которые Яндекс скачивал и складывал
  // в исключённые: по одному `?sec=` с каждой страницы справочника и по два `?tab=` с каждой
  // страницы пары. `Clean-param` запрещает их обход, а не индексацию.
  it("запрещает обход адресов с параметрами интерфейса", () => {
    expect(groupFor("*")?.other?.["Clean-param"]).toBe("tab&sec&lang");
  });

  it("закрывает от обхода сочетания", () => {
    expect([groupFor("*")?.disallow].flat()).toContain("/encyclopedia/combination");
  });

  // Google не выводит из индекса закрытое `Disallow`: сочетания ему открыты, чтобы он прочитал
  // их `noindex`. Своя группа отменяет общую, поэтому остальные запреты обязаны совпадать.
  it("открывает Googlebot только сочетания", () => {
    const common = [groupFor("*")?.disallow].flat().filter((path) => path !== "/encyclopedia/combination");
    expect([groupFor("Googlebot")?.disallow].flat()).toEqual(common);
  });

  it("на тестовом контуре закрывает сайт целиком", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://test.arcana-sense.ru");
    vi.resetModules();
    const { robotsForSite: onTest } = await import("@/lib/robotsPolicy");
    expect([onTest().rules].flat()).toEqual([{ userAgent: "*", disallow: "/" }]);
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("называет карту сайта", () => {
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/);
  });

  // Сквозной инвариант: адрес, который мы сами предлагаем поиску, не может быть у нас же
  // запрещён к обходу. Ошибка такого рода видна только по падению индексации через недели.
  it("ни один адрес карты сайта не закрыт к обходу", () => {
    const disallow = [groupFor("*")?.disallow].flat().filter((value): value is string => Boolean(value));
    const clash = sitemap()
      .map((entry) => new URL(entry.url).pathname)
      .filter((path) => disallow.some((prefix) => path.startsWith(prefix)));
    expect(clash).toEqual([]);
  });
});

describe("подтверждение владения сайтом", () => {
  it("молчит, когда кодов нет", () => {
    expect(verification({} as NodeJS.ProcessEnv)).toBeUndefined();
  });

  it("печатает только то, что задано", () => {
    const only = verification({
      NEXT_PUBLIC_YANDEX_VERIFICATION: " abc ",
    } as unknown as NodeJS.ProcessEnv);
    expect(only).toEqual({ yandex: "abc" });
  });

  it("берёт оба кода", () => {
    expect(verification({
      NEXT_PUBLIC_YANDEX_VERIFICATION: "ya",
      NEXT_PUBLIC_GOOGLE_VERIFICATION: "go",
    } as unknown as NodeJS.ProcessEnv)).toEqual({ yandex: "ya", google: "go" });
  });
});
