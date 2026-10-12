// Эталон — числа, напечатанные в книге (глава 5), а не вывод нашего кода.
import { describe, expect, it } from "vitest";
import { fromPoints } from "../matrix";
import { businessDate, businessMatrix, businessPoints } from "./business";

describe("совместимость в работе", () => {
  it("сложение дат — пример сделки из книги: 20.05.1987 + 29.12.1973 → 13.17.0018", () => {
    expect(businessDate("1987-05-20", "1973-12-29")).toEqual({ day: 13, month: 17, year: 18 });
    const p = businessPoints(businessMatrix("1987-05-20", "1973-12-29", "ru"));
    // точки, которые от Д не зависят: в примере книги Д = 8 при 13 + 17 + 18 = 48 → 12 по её же
    // правилу «по классической схеме» (опечатка издания, library/lisovskaya/general/05-known-issues.md)
    expect({ view: p.view, plus: p.plus, gain: p.gain, result: p.result, trouble: p.trouble })
      .toEqual({ view: 13, plus: 17, gain: 18, result: 3, trouble: 8 });
  });

  it("матрица на «дату» — пример коллектива из книги, все точки (05.06.0006)", () => {
    const p = businessPoints(fromPoints(5, 6, 6, "5.6.6"));
    expect(p).toEqual({
      base: 7, view: 5, plus: 6, minus: 17, gain: 6, result: 11, trouble: 12, hiddenA: 5, hiddenB: 22,
      finIn: 13, finWay: 5, finTotal: 19, relCommon: 6, relTerms: 7,
    });
  });

  it("месяц больше двенадцати не ограничивается, но сворачивается выше 22", () => {
    expect(businessDate("2000-12-01", "2000-11-01").month).toBe(23 - 22 + 4); // 12 + 11 = 23 → 2 + 3
    expect(businessDate("2000-08-01", "2000-09-01").month).toBe(17);
  });
});
