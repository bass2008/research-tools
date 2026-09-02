import type { Metadata } from "next";
import { describe, expect, it } from "vitest";

import { SITE, pageMeta } from "./site";
import { buildSectionReading, sectionReadingItem, sectionReadingSlugs } from "./sectionReadings";
import { PERSONAL_SECTION_KEYS } from "./sectionReadingShared";

/**
 * `pageMeta` — единственный источник `robots`, canonical и метаданных для всех страниц, но до сих
 * пор не был покрыт ни одним юнитом: браузерные тесты проверяли только `noindex`, а self-canonical
 * персональных статей — ни один раздел из двадцати.
 */
describe("метаданные страницы", () => {
  const base = { title: "Заголовок", description: "Описание страницы", path: "/encyclopedia/x/1-2" };

  it("делает canonical абсолютным и указывающим на саму страницу", () => {
    const meta = pageMeta(base);
    expect(meta.alternates?.canonical).toBe(new URL(base.path, SITE.url).toString());
    expect(String(meta.alternates?.canonical)).toContain(base.path);
  });

  it("сохраняет обход ссылок при закрытой индексации", () => {
    expect(pageMeta({ ...base, noindex: true, follow: true }).robots)
      .toEqual({ index: false, follow: true });
    // Без follow страница уходит из индекса вместе со своей перелинковкой — это другой случай.
    expect(pageMeta({ ...base, noindex: true }).robots).toEqual({ index: false, follow: false });
    expect(pageMeta(base).robots).toBeUndefined();
  });

  it("совмещает og:type с разметкой Article", () => {
    // openGraph в типах Next — объединение по `type`, поэтому читаем поле через запись.
    const typeOf = (meta: Metadata) => (meta.openGraph as Record<string, unknown> | undefined)?.type;
    expect(typeOf(pageMeta({ ...base, article: true }))).toBe("article");
    expect(typeOf(pageMeta(base))).toBe("website");
  });

  it("не режет длинный заголовок суффиксом бренда", () => {
    const long = "Заголовок ровно такой длины, что вместе с суффиксом выходит за предел выдачи";
    expect(pageMeta({ ...base, title: long }).title).toEqual({ absolute: long });
    expect(pageMeta({ ...base, title: "Короткий" }).title).toBe("Короткий");
  });

  it("даёт каждому персональному разбору уникальные заголовок и canonical", () => {
    const titles = new Set<string>();
    const canonicals = new Set<string>();
    let total = 0;
    for (const section of PERSONAL_SECTION_KEYS) {
      // По три слага на раздел: полный перебор 26 284 адресов живёт в sectionReadings.test.ts.
      const slugs = sectionReadingSlugs(section);
      for (const slug of [slugs[0], slugs[Math.floor(slugs.length / 2)], slugs.at(-1)!]) {
        const item = sectionReadingItem(section, slug);
        if (!item) continue;
        const reading = buildSectionReading(section, item.matrix, new Date("2026-09-01T12:00:00Z"));
        const path = `/encyclopedia/${section}/${slug}`;
        const meta = pageMeta({
          title: reading.title,
          description: `${reading.title}: описание`,
          path,
          article: true,
          noindex: true,
          follow: true,
        });
        total++;
        titles.add(typeof meta.title === "string" ? meta.title : (meta.title as { absolute: string }).absolute);
        canonicals.add(String(meta.alternates?.canonical));
        expect(meta.robots, path).toEqual({ index: false, follow: true });
        expect(String(meta.alternates?.canonical), path).toBe(new URL(path, SITE.url).toString());
      }
    }
    expect(canonicals.size, "canonical повторяется между разборами").toBe(total);
    expect(titles.size, "заголовок повторяется между разборами").toBe(total);
  });
});
