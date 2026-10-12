import { describe, expect, it } from "vitest";
import { fold, foldYear } from "../matrix";
import { computePair, personalPoints, SUMMED, type PointKey, type Points } from "./engine";

// Буквы Лисовской → ключи продукта (library/lisovskaya/general/01-calculation.md).
const BOOK: Record<string, PointKey> = {
  "А": "E", "Б": "A", "В": "B", "Г": "C", "Д": "D", "Е": "F", "Ё": "G", "Ж": "H", "З": "I",
  "Б1": "J", "Б2": "O", "В1": "K", "В2": "P", "Г1": "L", "Г2": "Q", "Д1": "M", "Д2": "N",
  "К": "R", "И": "R1", "Л": "R2", "небо": "sky", "земля": "ground", "мужское": "male",
  "женское": "female", "ЛП": "personal", "СП": "social", "ДП": "spiritual",
};

// Числа, напечатанные в книге текстом («Матрица судьбы: совместимость», 2024).
const GOLDEN: Array<{ src: string; person?: string; pair?: [string, string]; want: Record<string, number> }> = [
  { src: "гл. 2, стр. 12–14, личная 25.11.2002", person: "2002-11-25",
    want: { "Б": 7, "В": 11, "Г": 4, "Д": 22, "А": 8, "Е": 18, "Ё": 15, "Ж": 8, "З": 11, "Б1": 15, "Б2": 22,
      "В1": 19, "В2": 3, "Г1": 12, "Г2": 16, "Д1": 3, "Д2": 7, "К": 15, "И": 18, "Л": 9,
      "небо": 6, "земля": 11, "ЛП": 17, "мужское": 8, "женское": 8, "СП": 16, "ДП": 6 } },
  { src: "гл. 2, стр. 15–21, пара 25.11.2002 + 12.03.1999", pair: ["2002-11-25", "1999-03-12"],
    want: { "А": 13, "Б": 19, "В": 14, "Г": 14, "Д": 11, "Е": 6, "Ё": 10, "Ж": 7, "З": 3, "И": 12, "К": 6,
      "Л": 15, "Б1": 5, "Б2": 6, "В1": 9, "В2": 14, "Г1": 9, "Г2": 5, "Д1": 15, "Д2": 8,
      "небо": 16, "земля": 6, "ЛП": 22, "мужское": 13, "женское": 13, "СП": 8, "ДП": 3 } },
  { src: "гл. 3, стр. 39–41, хвост 5-11-6", pair: ["1970-09-13", "1973-07-02"], want: { "Д": 5, "Д2": 11, "Д1": 6 } },
  { src: "ответы, стр. 146–150", pair: ["2003-07-16", "2005-09-01"], want: { "Б": 17, "В": 16, "Д": 9, "Д2": 9, "Д1": 9 } },
  { src: "ответы, стр. 143–146", pair: ["1997-12-03", "1999-05-27"], want: { "Д2": 8, "ДП": 21 } },
];

function everyDate(): string[] {
  const out: string[] = [];
  for (let y = 1900; y <= 2026; y++) for (let m = 1; m <= 12; m++) for (let d = 1; d <= 31; d++) {
    const at = new Date(Date.UTC(y, m - 1, d));
    if (at.getUTCMonth() !== m - 1 || at > new Date()) continue;
    out.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return out;
}

describe("матрица пары", () => {
  it.each(GOLDEN)("совпадает с книгой: $src", ({ person, pair, want }) => {
    const got: Points = person ? personalPoints(person) : computePair(pair![0], pair![1]).p;
    for (const [letter, value] of Object.entries(want)) expect([letter, got[BOOK[letter]]]).toEqual([letter, value]);
  });

  it("середину хвоста не пересчитывает из краёв", () => {
    const { p } = computePair("2003-07-16", "2005-09-01");
    expect([p.M, p.N, p.D]).toEqual([9, 9, 9]);
  });

  it("порядок партнёров не меняет ни одного числа", () => {
    expect(computePair("1993-03-31", "1994-12-28").p).toEqual(computePair("1994-12-28", "1993-03-31").p);
  });

  it("пара по умолчанию — та, что согласована в прототипе", () => {
    const { p } = computePair("1993-03-31", "1994-12-28");
    expect([p.E, p.A, p.B, p.M, p.N, p.D, p.spiritual]).toEqual([13, 14, 15, 6, 17, 20, 21]);
  });

  describe("на всех датах 1900–2026", () => {
    const dates = everyDate();
    const points = dates.map((d) => personalPoints(d));
    const values = (key: PointKey) => [...new Set(points.map((x) => x[key]))];
    const pairValues = (key: PointKey) => {
      const own = values(key);
      const out = new Set<number>();
      for (const x of own) for (const y of own) out.add(fold(x + y));
      return out;
    };

    it("1 в паре не выпадает нигде, 2 — только на Б и В", () => {
      for (const key of SUMMED) {
        const got = pairValues(key);
        expect(got.has(1)).toBe(false);
        if (key !== "A" && key !== "B") expect([key, got.has(2)]).toEqual([key, false]);
      }
    });

    it("хвостов пары ровно 97, из них 26 — личные", () => {
      const own = [...new Set(points.map((x) => `${x.M}-${x.N}-${x.D}`))].map((t) => t.split("-").map(Number));
      expect(own.length).toBe(26);
      const tails = new Set<string>();
      for (const x of own) for (const y of own) tails.add(x.map((v, i) => fold(v + y[i])).join("-"));
      expect(tails.size).toBe(97);
    });

    it("год сворачивается так же, как в личной матрице", () => {
      expect(personalPoints("1987-06-14").C).toBe(foldYear(1987));
    });
  });
});
