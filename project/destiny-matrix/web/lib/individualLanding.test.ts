import { describe, expect, it } from "vitest";
import { landingData } from "./individualLanding";

// The landing quotes the sample personal reading: its "main points" are mapped to the chart by hand,
// so a change of the sample must show up here before it shows up on the page.
describe("данные лендинга из примера", () => {
  for (const L of ["ru", "en"] as const) {
    it(`собраны из примера (${L})`, () => {
      const d = landingData(L);
      expect(d.sample).toBe("12.08.1992");
      expect(d.summary).toHaveLength(7);
      expect(d.summary.every((s) => s.legend && s.text)).toBe(true);
      expect(d.findings).toHaveLength(8);
      expect(d.findings.every((f) => f.formula && f.text.length)).toBe(true);
      expect(d.chapters).toHaveLength(15);
      expect(d.findings[d.strength].title).toMatch(L === "ru" ? /Сила рода/ : /strength of your family line/i);
      expect(d.values.G).toBe(11);
      expect(d.autoText.length).toBeGreaterThan(100);
      const pages = d.chapters.map((c) => c.page);
      expect(pages).toEqual([...pages].sort((a, b) => a - b));
      expect(d.pages).toBeGreaterThan(50);
    });
  }

  it("английский пример без кириллицы", () => {
    const d = landingData("en");
    expect(JSON.stringify([d.summary, d.findings, d.chapters, d.autoText])).not.toMatch(/[А-Яа-яЁё]/);
  });
});
