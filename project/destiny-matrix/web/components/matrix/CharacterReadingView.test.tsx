import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { forLocale as matrixForLocale } from "@/lib/matrix";
import { PERSONAL_SECTION_KEYS } from "@/lib/sectionReadingShared";
import { forLocale as readingsForLocale } from "@/lib/sectionReadings";
import { forLocale as contentForLocale } from "@/lib/content";
import CharacterReadingView from "./CharacterReadingView";

describe.each(["ru", "en"] as const)("readable role names (%s)", (locale) => {
  it.each([false, true])("renders seven chakra panels with exact triples (printing=%s)", (printing) => {
    const matrix = matrixForLocale(locale).calculate("1993-03-31", "m");
    const before = structuredClone(matrix);
    const reading = readingsForLocale(locale).buildSectionReading("chakras", matrix);
    const html = renderToStaticMarkup(<CharacterReadingView reading={reading} locale={locale} printing={printing} />);
    expect(html.match(/data-chakra="(?!energy_field)/g)).toHaveLength(7);
    expect(reading.energyField!.cells.map((cell) => cell.arcanum)).toEqual(
      [matrix.chakra_totals.physics, matrix.chakra_totals.energy, matrix.chakra_totals.emotions]);
    expect(html).toContain('data-chakra="energy_field"');
    expect(html.match(/data-column=/g)).toHaveLength(24);
    expect(reading.chakraRows!.map((row) => row.cells.map((cell) => cell.arcanum))).toEqual(
      [...matrix.chakras].reverse().map((row) => [row.physics, row.energy, row.emotions]),
    );
    for (const row of reading.chakraRows!) {
      const article = contentForLocale(locale).chakraContent(row.key)!;
      for (const paragraph of article.level) expect(html).not.toContain(paragraph);
      expect(html).toContain(`/encyclopedia/chakra/${row.key}`);
    }
    if (locale === "ru") {
      expect(html).toContain("Ваша опора — не запасы, а спокойствие и близость, которые вы носите с собой.");
    } else {
      expect(html.replace(/<[^>]*>/g, " ")).not.toMatch(/[А-Яа-яЁё]/);
    }
    expect(html).not.toContain('data-empty="true"');
    expect(html).not.toContain("Ресурс карты проявляется");
    expect(reading.roles).toEqual([]);
    expect(reading.interactions).toEqual([]);
    expect(matrix).toEqual(before);
  });

  it("reads every triple from the corpus", () => {
    const matrix = matrixForLocale(locale).calculate("2000-01-01", "m");
    const reading = readingsForLocale(locale).buildSectionReading("chakras", matrix);
    expect(reading.chakraRows!.every((row) => row.paragraphs.every((p) => p !== ""))).toBe(true);
    expect(reading.chakraRows!.every((row) => row.cells.every((cell) => cell.caption !== ""))).toBe(true);
    const html = renderToStaticMarkup(<CharacterReadingView reading={reading} locale={locale} />);
    expect(html).not.toContain('data-empty="true"');
    expect(html).not.toContain("Ваша опора — не запасы");
  });

  it("renders translated names in summaries, role cards, repeats and interactions", () => {
    const { buildSectionReading } = readingsForLocale(locale);
    // Different values and repeated arcana exercise pair and synthesis text paths.
    for (const birth of ["1993-03-31", "1990-01-01", "2000-01-01"]) {
      const matrix = matrixForLocale(locale).calculate(birth, "f");
      for (const section of PERSONAL_SECTION_KEYS) {
        const reading = buildSectionReading(section, matrix);
        const html = renderToStaticMarkup(<CharacterReadingView reading={reading} locale={locale} />);
        const visible = html.replace(/<[^>]*>/g, " ");
        expect(visible, `${section}:${birth}`).not.toMatch(/\b(?:total_[mf]|task_[mf]|sky_total|ground_total|physics_total|energy_total|emotions_total)\b/);
        if (locale === "ru") {
          expect(visible, `${section}:${birth}`).not.toMatch(/\b(?:personal|social|spiritual|planetary|total|joy)\b/);
        } else {
          expect(visible, `${section}:${birth}`).not.toMatch(/[А-Яа-яЁё]/);
        }
        // Internal identifiers remain available to React and section relationships.
        if (!reading.layout) for (const role of reading.roles) {
          expect(html).toContain(`data-role="${role.key}"`);
          expect(visible).toContain(role.label);
        }
      }
    }
  });

  it("uses the branch gift names in the reported family summary and retains diagram symbols", () => {
    const { buildSectionReading, sectionReadingItem } = readingsForLocale(locale);
    const reading = buildSectionReading("family_gifts", sectionReadingItem("family_gifts", "2-20-6-6")!.matrix);
    const male = reading.roles.find((role) => role.key === "total_m")!;
    const female = reading.roles.find((role) => role.key === "total_f")!;
    expect(reading.summary).toContain(`${male.label} — ${male.title}`);
    expect(reading.summary).toContain(`${female.label} — ${female.title}`);
    const html = renderToStaticMarkup(<CharacterReadingView reading={reading} locale={locale} printing />);
    expect(html).toContain(`F · ${reading.roles[0].label}`);
    expect(html).toContain(`G · ${reading.roles[1].label}`);
    expect(html.replace(/<[^>]*>/g, " ")).not.toMatch(/total_[mf]/);
  });
});
