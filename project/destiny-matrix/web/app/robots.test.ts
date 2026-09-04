import { describe, expect, it, vi } from "vitest";

import robots from "./robots";
import { PERSONAL_SECTION_KEYS } from "@/lib/sectionReadingShared";
import { verification } from "@/lib/seo";

// SITE.url читается на импорте, поэтому контур подменяем до него — иначе проверять нечего.

describe("robots.txt", () => {
  const rules = [robots().rules].flat();
  const groupFor = (agent: string) => rules.find((r) => r.userAgent === agent);
  const closed = (agent: string) => [groupFor(agent)?.disallow].flat().includes("/");

  it.each(["GPTBot", "ClaudeBot", "CCBot", "AhrefsBot"])("закрывает %s целиком", (agent) => {
    expect(closed(agent)).toBe(true);
  });

  // Поисковые боты ИИ-сервисов приводят людей и ставят ссылку на источник — их закрывать нельзя,
  // хотя имена похожи на обучающие краулеры тех же компаний.
  it.each(["Googlebot", "YandexBot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot"])(
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
  // обхода экономит только `Disallow`, поэтому 5 990 результатов расчёта закрыты префиксами.
  it("закрывает от обхода результаты расчёта", () => {
    const disallow = [groupFor("*")?.disallow].flat();
    expect(disallow).toContain("/matrix/");
    const missing = [...PERSONAL_SECTION_KEYS, "character"].filter(
      (section) => !disallow.includes(`/encyclopedia/${section}/`),
    );
    expect(missing).toEqual([]);
  });

  // Хаб `/matrix` — обычная страница корпуса и стоит в карте сайта: закрыть его префиксом
  // без слеша значило бы выкинуть из поиска и его.
  it("не закрывает хаб матриц", () => {
    expect([groupFor("*")?.disallow].flat()).not.toContain("/matrix");
  });

  it("на тестовом контуре закрывает сайт целиком", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://test.arcana-sense.ru");
    vi.resetModules();
    const { default: onTest } = await import("./robots");
    expect([onTest().rules].flat()).toEqual([{ userAgent: "*", disallow: "/" }]);
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("называет карту сайта", () => {
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/);
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
