import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { forLocale as matrixForLocale } from "@/lib/matrix";
import { PERSONAL_SECTION_KEYS } from "@/lib/sectionReadingShared";
import { forLocale as readingsForLocale } from "@/lib/sectionReadings";
import { forLocale as contentForLocale } from "@/lib/content";
import CharacterReadingView from "./CharacterReadingView";

describe.each(["ru", "en"] as const)("readable role names (%s)", (locale) => {
  it.each([false, true])("keeps article introductions out of personal chakra tables (printing=%s)", (printing) => {
    const matrix = matrixForLocale(locale).calculate("1993-03-04", "f");
    const reading = readingsForLocale(locale).buildSectionReading("chakras", matrix);
    const html = renderToStaticMarkup(<CharacterReadingView reading={reading} locale={locale} printing={printing} />);
    const visible = html.replace(/<[^>]*>/g, " ");
    for (const row of reading.chakraRows!) {
      const article = contentForLocale(locale).chakraContent(row.key)!;
      expect(visible).toContain(article.personalIntro);
      for (const paragraph of article.level) expect(visible).not.toContain(paragraph);
      expect(html).toContain(`/encyclopedia/chakra/${row.key}`);
    }
    expect(visible).not.toMatch(/Ниже — чтение этой строки|второй пример и справочник|Ниже показано/);
  });

  it("does not infer chakra strength or conflict from arcanum magnitudes", () => {
    for (const birth of ["1993-03-04", "1985-07-15", "2000-01-01"]) {
      const matrix = matrixForLocale(locale).calculate(birth, "f");
      const before = structuredClone(matrix);
      const reading = readingsForLocale(locale).buildSectionReading("chakras", matrix);
      const html = renderToStaticMarkup(<CharacterReadingView reading={reading} locale={locale} />);
      const visible = html.replace(/<[^>]*>/g, " ");
      expect(visible).not.toMatch(/Ведущий акцент|Ведущий и ресурсный|суммарный акцент|Главный внутренний разрыв|разрыв —|порог|сильнее выделяется колонка|максимум и минимум|leading accent|leading and the resource|total accent|main inner gap|gap is|threshold|column stands out more|maximum and the minimum/i);
      expect(visible).toContain(locale === "ru"
        ? "Номер аркана не измеряет силу"
        : "An arcanum number does not measure strength");
      const totals = reading.interactions.find((item) => item.key === "columns")!;
      // Every total is present in its original column, even when two totals coincide.
      expect(totals.caption?.match(/\d+/g)?.map(Number)).toEqual([
        matrix.chakra_totals.physics, matrix.chakra_totals.energy, matrix.chakra_totals.emotions,
      ]);
      expect(reading.chakraRows!.map((row) => row.cells.map((cell) => cell.arcanum))).toEqual(
        matrix.chakras.map((row) => [row.physics, row.energy, row.emotions]),
      );
      // Keep actual repetition data; repeated numbers do not create a strength ranking.
      const repeated = reading.interactions.find((item) => item.key === "repeats")!;
      const numbers = matrix.chakras.flatMap((row) => [row.physics, row.energy, row.emotions]);
      const expected = [...new Set(numbers.filter((n, i) => numbers.indexOf(n) !== i))].sort((a, b) => a - b);
      expect(repeated.roles.map(Number).sort((a, b) => a - b)).toEqual(expected);
      expect(matrix).toEqual(before);
      if (locale === "en") expect(visible).not.toMatch(/[А-Яа-яЁё]/);
    }
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
