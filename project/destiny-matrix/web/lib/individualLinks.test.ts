import { describe, expect, it } from "vitest";
import { countSub, formulaLabel, linksOf, rarity, riddle, sumText, valuesOf } from "./individualLinks";

// The sample personal reading (12.08.1992) has the finding "Three Hierophants add up to the Devil":
// 5 + 5 + 5 = 15 in the karmic task, the physics of Anahata and the earnings point.
describe("связи на схеме", () => {
  const v = valuesOf(1992, 8, 12);

  it("находит связь примера и объясняет её бесплатно", () => {
    const links = linksOf("ru", v);
    // Q (отношение к материальному, 7) встала на схему третьей семёркой рядом с O и R1.
    expect(links.map(formulaLabel)).toEqual(["5 × 3", "8 × 3", "7 × 3", "20 = 20", "10 = 10"]);
    expect(links[0]).toMatchObject({ n: 5, keys: ["D", "S", "R2"], sum: 15, free: true });
    expect(links.filter((c) => c.free)).toHaveLength(1);
    expect(riddle("ru", links[0])).toBe("Кармическая задача, любовь в поступках и заработок — одна карта");
    expect(sumText("ru", links[0], String)).toContain("**5 + 5 + 5 = 15**");
  });

  it("называет редкость словами на обоих языках", () => {
    const [first] = linksOf("en", v);
    expect(rarity("ru", first.p)).toBe("у 3 дат из 1000");
    expect(rarity("en", first.p)).toBe("in 3 dates out of 1000");
    expect(riddle("en", first)).toBe("Karmic task, love in actions and earnings — one card");
    expect(countSub("en", linksOf("en", v))).toContain("**5 × 3**");
  });
});
