import { describe, expect, it, vi } from "vitest";
import { article, articleContentForLocale, articleSource } from "@/app/_lib/article";
import { forLocale as contentForLocale } from "@/lib/content";
import { forLocale as encyclopediaForLocale } from "@/lib/encyclopedia";
import { forLocale as readingsForLocale } from "@/lib/sectionReadings";
import { forLocale as matrixForLocale } from "@/lib/matrix";
import { PERSONAL_SECTION_KEYS } from "@/lib/sectionReadingShared";
import { configuredSites } from "@/lib/siteProfile";
import { sitemapForSite } from "@/lib/sitemapEntries";
import { isMobileArticle } from "@/lib/mobileContentContract";
import { forLocale as combinationForLocale } from "@/lib/combinationReading";
import type { Lang } from "@/lib/i18n/hosts";
vi.mock("@/lib/i18n/request", () => ({ requestLocale: async (req: Request) => req.headers.get("Accept-Language") ?? "ru" }));
vi.mock("@/lib/siteProfile.server", () => ({ requestSite: async () => ({ origin: "https://arcana-sense.com", legalLocale: "en", defaultLocale: "en", locales: ["ru", "en"], indexable: true }) }));
import { GET } from "./route";

async function get(path: string, locale: Lang) {
  return GET(new Request(`https://arcana-sense.com/api/content?path=${encodeURIComponent(path)}`, { headers: { "Accept-Language": locale } }));
}

for (const locale of ["ru", "en"] as const) describe(`native content ${locale}`, () => {
  const site = configuredSites().find((s) => s.defaultLocale === locale)!;
  const sitemapPaths = sitemapForSite(site).map((entry) => new URL(entry.url).pathname.replace(/^\/(ru|en)(?=\/)/, ""))
    .filter((path) => path.startsWith("/encyclopedia"));
  it("serves every encyclopedia sitemap URL as nonempty versioned JSON", async () => {
    expect(sitemapPaths.length).toBeGreaterThan(70);
    for (const path of sitemapPaths) {
      const response = await get(path, locale);
      expect(response.status, path).toBe(200);
      const body = await response.json();
      expect(isMobileArticle(body), path).toBe(true);
      expect(body.title.length, path).toBeGreaterThan(2);
      expect(body.blocks.length, path).toBeGreaterThan(0);
      expect(body.breadcrumbs.some((b: { href?: string }) => b.href === "/encyclopedia"), path).toBe(true);
      expect(body.locale).toBe(locale);
      expect(JSON.stringify(body)).not.toContain('"source"');
    }
  });
  it("also serves noindex combinations, intersections, ordered tails and every personal family", async () => {
    const c = contentForLocale(locale), e = encyclopediaForLocale(locale), r = readingsForLocale(locale);
    const matrix = matrixForLocale(locale).calculate("1987-06-14", "f");
    const paths = ["/encyclopedia/character/14-6-7", "/encyclopedia/combination", ...e.allCombinationSlugs().map((key) => `/encyclopedia/combination/${key}`),
      ...c.positionArcanumRows().map((row) => `/encyclopedia/position/${row.position}/${row.arcanum}`),
      ...c.karmicTailKeys().map(e.karmicTailHref), ...c.pairTailKeys().map(e.pairTailHref),
      ...PERSONAL_SECTION_KEYS.map((key) => r.sectionReadingHref(key, matrix))];
    for (const path of paths) {
      const response = await get(path, locale);
      expect(response.status, path).toBe(200);
      expect(isMobileArticle(await response.json()), path).toBe(true);
    }
  });
  it("keeps web source content and required paragraphs intact", () => {
    const c = contentForLocale(locale), web = articleContentForLocale(locale);
    const canonical = c.arcanumContent(5)!;
    const native = article("/encyclopedia/arcanum/5", { locale })!;
    expect(web.arcanumContent(5)).toEqual(canonical);
    expect(native.source.data).toEqual(canonical);
    const first = canonical.article?.intro.find((p) => typeof p === "string");
    if (first) expect(native.document.blocks).toContainEqual({ type: "paragraph", text: first });
    const character = articleSource("/encyclopedia/character/14-6-7", { locale }, "reading")!;
    const characterJson = JSON.stringify(article("/encyclopedia/character/14-6-7", { locale })!.document);
    expect(characterJson).toContain(character.interactions[0].paragraphs[0]);
    expect(characterJson).toContain(character.practice);
    const combination = combinationForLocale(locale).buildCombinationArticle(5, 8);
    const combinationJson = JSON.stringify(article("/encyclopedia/combination/5-8", { locale })!.document);
    for (const group of combination.groups) for (const context of group.contexts) for (const variant of context.variants)
      for (const p of variant.paragraphs) expect(combinationJson).toContain(JSON.stringify(p).slice(1, -1));
    expect(web.combinationContent("5-8")).toEqual(c.combinationContent("5-8"));
    for (const key of ["arcanum", "position", "chakra", "karmic-tail", "compatibility", "compatibility-tails", "combination", "month", "energy-field", "year"]) {
      expect(web.categoryHub(key), key).toEqual(c.categoryHub(key));
    }
    for (const key of c.yearKeys()) expect(web.yearArcanum(key)).toEqual(c.yearArcanum(key));
  });
  it("validates the birth parameter against the actual year-line slug", async () => {
    const r = readingsForLocale(locale), m = matrixForLocale(locale).calculate("1987-06-14", "f");
    const path = r.sectionReadingHref("years", m);
    expect((await get(path, locale)).status).toBe(200);
    expect((await get(path.replace("1987-06-14", "2000-01-01"), locale)).status).toBe(404);
    expect((await get(path + "&birth=1987-06-14", locale)).status).toBe(404);
    expect((await get(path.replace("1987-06-14", ""), locale)).status).toBe(404);
    expect((await get("/encyclopedia/arcanum/5?birth=1987-06-14", locale)).status).toBe(404);
    expect((await get("/encyclopedia/arcanum/5?tab=combos", locale)).status).toBe(200);
    expect((await get("/encyclopedia/arcanum/5?tab=wrong", locale)).status).toBe(404);
  });
  it("keeps the COM legal profile when switching interface language", async () => {
    for (const path of ["/support", "/contacts", "/privacy", "/terms", "/refund"]) {
      const response = await get(path, locale);
      expect(response.status, path).toBe(200);
      const body = await response.json();
      expect(isMobileArticle(body), path).toBe(true);
      expect(body.blocks.length).toBeGreaterThan(0);
      if (path === "/privacy") {
        expect(JSON.stringify(body)).not.toContain("152-ФЗ");
        expect(JSON.stringify(body)).not.toContain("Яндекс Метрики");
      }
    }
  });
});

it.each(["/etc/passwd", "/etc/../encyclopedia/arcanum/5", "//evil.example/encyclopedia/arcanum/5", "/encyclopedia/arcanum/99", "/encyclopedia/position/missing", "/encyclopedia/character/99-99-99", "/encyclopedia/money/not-a-slug", "/api/sections?m=1"])("rejects unknown or malformed path %s", async (path) => {
  expect((await get(path, "ru")).status).toBe(404);
});
it("rejects unsupported or malformed contract versions", () => {
  const value = article("/encyclopedia/arcanum/5", { locale: "en" })!.document;
  expect(isMobileArticle({ ...value, schemaVersion: 2 })).toBe(false);
  expect(isMobileArticle({ ...value, blocks: [{ type: "table", rows: null }] })).toBe(false);
});
it("resolves the language already present in a shared website link", async () => {
  const response = await get("/en/encyclopedia/arcanum/5", "ru");
  expect(response.status).toBe(200);
  const value = await response.json();
  expect(value.locale).toBe("en");
  expect(value.path).toBe("/encyclopedia/arcanum/5");
});
it.each([
  ["ru", "/encyclopedia/arcanum/99", "Статья не найдена"],
  ["en", "/encyclopedia/arcanum/99", "Article not found"],
  ["ru", "/en/encyclopedia/arcanum/99", "Article not found"],
  ["en", "/ru/encyclopedia/arcanum/99", "Статья не найдена"],
] as const)("localizes a missing article for request %s and path %s", async (locale, path, detail) => {
  const response = await get(path, locale);
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ detail });
});
