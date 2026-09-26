import { readFileSync } from "node:fs";
import type { Lang } from "./i18n/hosts";
import { describe, expect, it } from "vitest";
import { forLocale as arcanaForLocale } from "./arcana";
import { forLocale as contentForLocale } from "./content";
import { createContent } from "./contentReader";
import { forLocale as tariffsForLocale } from "./tariffs";
import { D } from "./i18n";
import { negotiateLocale, normalizeLocale, parseLocales } from "./i18n/selection";
import { forLocale as matrixForLocale } from "./matrix";
import { forLocale as sectionsForLocale } from "./sections";
import { forLocale as siteForLocale } from "./site";

describe("runtime localization", () => {
  it("keeps English article keywords in English, including structured data", () => {
    const content = contentForLocale("en");
    for (const key of content.hubKeys()) {
      const article = content.hub(key)!;
      expect(article.seo.queries.join(", "), key).not.toMatch(/[А-Яа-яЁё]/);
    }
    expect(content.hub("method")!.seo.queries).toContain("destiny matrix chart natalia ladini method");
  });

  it("reads both languages from an in-memory source without changing shared calculations", () => {
    const matrix = matrixForLocale("ru").calculate("1993-03-31", "f");
    const files = ["arcana.json", "positions.json", "chakras.json", "combinations.json",
      "position-arcanum.json", "karmic-tails.json", "category-hubs.json", "year-arcana.json", "hubs.json"];
    const memory = Object.fromEntries(["ru", "en"].map((locale) => [locale,
      Object.fromEntries(files.map((file) => [file, JSON.parse(readFileSync(`content/${locale}/${file}`, "utf8"))])),
    ]));
    const source = { read: (file: string, locale: Lang) => file === "matrices.json"
      ? { items: [{ slug: "example", matrix }] } : memory[locale][file] };
    const before = JSON.stringify(matrix);
    const en = createContent("en", source).matrixItem("example")!;
    const ru = createContent("ru", source).matrixItem("example")!;
    expect(en.matrix.chakras[0].title).not.toBe(ru.matrix.chakras[0].title);
    expect(JSON.stringify(matrix)).toBe(before);
    expect(en.matrix.center).toBe(ru.matrix.center);
  });

  it("keeps calculations and entity keys while changing their presentation", () => {
    const ru = matrixForLocale("ru").calculate("1993-03-31", "f");
    const en = matrixForLocale("en").calculate("1993-03-31", "f");
    expect(ru.center).toBe(en.center);
    expect(ru.karmic_tail).toEqual(en.karmic_tail);
    expect(matrixForLocale("ru").sexLabel("f")).toBe(D.calc.femaleChart.ru);
    expect(matrixForLocale("en").sexLabel("f")).toBe(D.calc.femaleChart.en);
    expect(arcanaForLocale("ru").arcanum(4).n).toBe(arcanaForLocale("en").arcanum(4).n);
    expect(arcanaForLocale("ru").arcanum(4).title).not.toBe(arcanaForLocale("en").arcanum(4).title);
  });

  it("isolates corpora and full readings in interleaved requests", async () => {
    const read = (locale: "ru" | "en") => {
      const matrix = matrixForLocale(locale).calculate("1993-03-31", "f");
      return { article: contentForLocale(locale).arcanumContent(4), sections: sectionsForLocale(locale).build(matrix, true) };
    };
    const ru = read("ru"), en = read("en");
    expect(ru.article?.title).not.toBe(en.article?.title);
    expect(ru.sections.map((item) => item.key)).toEqual(en.sections.map((item) => item.key));
    expect(ru.sections[0].title).not.toBe(en.sections[0].title);
    const results = await Promise.all(Array.from({ length: 12 }, async (_, i) => {
      await Promise.resolve();
      return read(i % 2 ? "en" : "ru");
    }));
    results.forEach((result, i) => expect(result).toEqual(i % 2 ? en : ru));
  });

  it("does not change the storefront or legal entity with the language", () => {
    expect(siteForLocale("ru").SITE).toEqual(siteForLocale("en").SITE);
    const ru = siteForLocale("ru").LEGAL, en = siteForLocale("en").LEGAL;
    for (const key of ["entity", "inn", "ogrnip", "email", "phone", "site", "bank", "rknNotice"] as const) {
      expect(ru[key], key).toBe(en[key]);
    }
    for (const key of ["updated", "hosting", "mailer"] as const) expect(ru[key], key).not.toBe(en[key]);
    expect(D.pay.currency.ru).toBe(D.pay.currency.en);
    const plan = { id: "single", name: "Plan", price: 25000, scope: ["single"], period_days: null };
    expect(tariffsForLocale("ru").priceLabel(plan)).toBe(tariffsForLocale("en").priceLabel(plan));
  });

  it("negotiates supported languages and rejects unavailable configuration", () => {
    expect(normalizeLocale("en-US")).toBe("en");
    expect(negotiateLocale("de-DE,en;q=0.8,ru;q=0.5", ["ru", "en"], "ru")).toBe("en");
    expect(negotiateLocale("en;q=0,ru;q=0.5", ["ru", "en"], "en")).toBe("ru");
    expect(negotiateLocale("en", ["ru"], "ru")).toBe("ru");
    expect(parseLocales("en,ru", "en")).toEqual(["en", "ru"]);
    expect(() => parseLocales("ru,de", "ru")).toThrow();
  });
});
