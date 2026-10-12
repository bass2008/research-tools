import { describe, expect, it } from "vitest";
import { calculate } from "../matrix";
import { LANGS } from "../i18n/lang";
import { pairChakraKeys } from "./chakraReading";
import { pairChakras } from "./chakras";
import { unit } from "./corpus";

const pair = (x: string, y: string) => pairChakras(calculate(x), calculate(y));
const row = (map: ReturnType<typeof pair>, key: string) => map.rows.find((r) => r.key === key)!;

describe("чакры пары", () => {
  // Пример из главы 2 книги Лисовской: клетки, стоящие на точках пары, равны напечатанным числам.
  it("совпадает с точками пары 25.11.2002 + 12.03.1999 из книги", () => {
    const map = pair("2002-11-25", "1999-03-12");
    expect([row(map, "sahasrara").physics, row(map, "sahasrara").energy, row(map, "sahasrara").emotions]).toEqual([19, 14, 6]);
    expect([row(map, "ajna").physics, row(map, "ajna").energy]).toEqual([6, 14]);
    expect([row(map, "vishuddha").physics, row(map, "vishuddha").energy]).toEqual([5, 9]);
    expect(row(map, "manipura").physics).toBe(13);
    expect([row(map, "svadhisthana").physics, row(map, "svadhisthana").energy, row(map, "svadhisthana").emotions]).toEqual([9, 15, 6]);
    expect([row(map, "muladhara").physics, row(map, "muladhara").energy, row(map, "muladhara").emotions]).toEqual([14, 11, 7]);
  });

  it("сумма колонки 100 даёт 10, а не 1", () => {
    const map = pair("1985-01-01", "1986-01-17");
    expect(map.rows.reduce((acc, r) => acc + r.emotions, 0)).toBe(100);
    expect(map.totals.emotions).toBe(10);
  });

  for (const L of LANGS) {
    it(`${L}: у пары из примера есть тексты всех чакр и энергополя`, () => {
      const missing = pairChakraKeys(L, { a: "1993-03-31", b: "1994-12-28" })
        .filter((key) => !(unit(L, key)?.text?.length === 3 && unit(L, key)?.title && Object.keys(unit(L, key)?.captions ?? {}).length === 3));
      expect(missing).toEqual([]);
    });
  }
});
