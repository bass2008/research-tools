import { describe, expect, it } from "vitest";

import { matrixItem, matrixSlugs } from "./content";
import { isBlockedText } from "./textPolicy";
import { buildCharacterReading, characterRoleTemplate } from "./character";
import { characterHref } from "./characterTypes";

describe("персональный разбор характера", () => {
  it("собирает контрольную тройку 4-3-22 в связную статью", () => {
    const matrix = matrixItem("4-3-22")!.matrix;
    const reading = buildCharacterReading(matrix);

    expect(reading.slug).toBe("4-3-22");
    expect(reading.roles.map((role) => [role.key, role.arcanum, role.title])).toEqual([
      ["A", 4, "Император"],
      ["B", 3, "Императрица"],
      ["C", 22, "Шут"],
    ]);
    expect(reading.interactions).toHaveLength(3);
    expect(reading.interactions.map((item) => item.key)).toEqual(["3-4", "3-22", "4-22"]);
    expect(reading.interactions[0]).toMatchObject({
      href: "/encyclopedia/combination/3-4",
      linkLabel: "Подробнее про сочетание 3 и 4 аркана в энциклопедии →",
    });
    expect(characterHref(matrix)).toBe("/encyclopedia/character/4-3-22");
    expect(
      [
        reading.summary,
        ...reading.roles.flatMap((role) => [
          role.essence,
          role.strength,
          role.risk,
          role.action,
        ]),
        ...reading.interactions.flatMap((item) => item.paragraphs),
        reading.strength,
        reading.tension,
        reading.practice,
      ].join(" ").length,
    ).toBeGreaterThan(2500);
  });

  it("сворачивает повторы в один сюжет вместо дублирования пар", () => {
    const double = buildCharacterReading(matrixItem("4-4-22")!.matrix);
    expect(double.interactions).toHaveLength(2);
    expect(double.interactions.some((item) => item.key === "4-4")).toBe(true);
    expect(double.interactions.some((item) => item.key === "4-22")).toBe(true);

    const triple = buildCharacterReading(matrixItem("4-4-4")!.matrix);
    expect(triple.interactions).toHaveLength(1);
    expect(triple.interactions[0].roles).toEqual(["A", "B", "C"]);
  });

  it("разделяет все 66 вариантов A, B и C на суть, силу, риск и действие", () => {
    for (const position of ["day", "month", "year"] as const) {
      for (let arcanum = 1; arcanum <= 22; arcanum++) {
        const role = characterRoleTemplate(arcanum, position);
        for (const part of [role.essence, role.strength, role.risk, role.action]) {
          expect(part.length, `${position}:${arcanum}`).toBeGreaterThanOrEqual(20);
        }
      }
    }
  });

  it("покрывает все 5 544 достижимые тройки без пустот и запрещённой лексики", () => {
    const slugs = matrixSlugs();
    expect(slugs).toHaveLength(5544);
    for (const slug of slugs) {
      const matrix = matrixItem(slug)!.matrix;
      const reading = buildCharacterReading(matrix);
      expect(reading.slug).toBe(slug);
      expect(reading.roles).toHaveLength(3);
      expect(reading.interactions.length).toBeGreaterThanOrEqual(1);
      expect(reading.interactions.length).toBeLessThanOrEqual(3);
      const corpus = [
        reading.title,
        reading.lead,
        reading.summary,
        ...reading.roles.flatMap((role) => [
          role.label,
          role.question,
          role.essence,
          role.strength,
          role.risk,
          role.action,
        ]),
        ...reading.interactions.flatMap((item) => [item.title, ...item.paragraphs]),
        reading.strength,
        reading.tension,
        reading.practice,
      ].join(" ");
      expect(corpus.length).toBeGreaterThan(1800);
      expect(isBlockedText(corpus)).toBe(false);
    }
  });
});
