import { describe, expect, it } from "vitest";
import { computePair } from "./engine";
import { characters } from "./spheres";

describe("совпадения характеров пары", () => {
  it("сохраняет совпадения обоих партнёров независимо от порядка дат", () => {
    const { a, b } = computePair("1988-01-01", "1988-03-01", "ru");
    const matches = characters(a, b);
    expect(matches).toEqual(characters(b, a));
    expect(matches.map((block) => block.unit).sort()).toEqual([
      "characters:dual:13", "characters:dual:5", "characters:semidual:18", "characters:semidual:3",
    ]);
  });

  it("одинаковая карта двух партнёров остаётся одним блоком в каждой роли", () => {
    const { a, b } = computePair("1990-01-01", "1990-01-01", "ru");
    const matches = characters(a, b);
    expect(matches.filter((block) => block.role === "character")).toHaveLength(1);
    expect(matches.filter((block) => block.role === "wishes")).toHaveLength(1);
    expect(matches.find((block) => block.role === "character")?.lead?.kind).toBe("both");
  });
});
