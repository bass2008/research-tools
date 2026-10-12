import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import ChakraReadingView from "../../components/matrix/ChakraReadingView";
import { lockedPairChakraReading, pairChakraKeys, pairChakraReading } from "./chakraReading";
import type { PairUnit } from "./spheres";

const dates = { a: "1990-01-01", b: "1990-01-01" };
for (const L of ["ru", "en"] as const) describe(`готовые чакры пары (${L})`, () => {
  const units = Object.fromEntries(pairChakraKeys(L, dates).map((key) => [key, {
    unit: key, title: "Ready chakra reading", captions: { physics: "Physical actions", energy: "Shared motivation", emotions: "Shared feelings" },
    meaning: "A complete reading", text: ["First paragraph", "Second **paragraph**", "Third paragraph"],
  } satisfies PairUnit]));
  it("сразу отображает восемь толкований без сохранения и ожидания", () => {
    const reading = pairChakraReading(L, dates, units);
    const rows = [...reading.chakraRows!, reading.energyField!];
    expect(rows).toHaveLength(8);
    expect(rows.every((row) => row.paragraphs.length === 3 && row.cells.every((c) => c.caption))).toBe(true);
    const html = renderToStaticMarkup(createElement(ChakraReadingView, { reading, locale: L }));
    expect(html.match(/First paragraph/g)).toHaveLength(8);
    expect(html).not.toContain("chakra-pending");
    expect(html).not.toContain("chakra-row-pending");
  });
  it("отсутствие текста — ошибка корпуса, а не обещание дописать", () => {
    expect(() => pairChakraReading(L, dates, { ...units, [Object.keys(units)[0]]: null })).toThrow("Incomplete pair chakra corpus");
  });
  it("закрытый разбор содержит только скрытую раскладку с замком", () => {
    const reading = lockedPairChakraReading(L, dates);
    expect([...reading.chakraRows!, reading.energyField!].every((row) => row.lockedLabel)).toBe(true);
  });
});
