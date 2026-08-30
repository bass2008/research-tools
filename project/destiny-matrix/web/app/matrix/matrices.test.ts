import { describe, expect, it } from "vitest";

import { fold } from "@/lib/matrix";

import { birthDates, type MatrixKey } from "./matrices";

describe("реальные даты статической матрицы", () => {
  it("дни 23–31 сопоставляются сложением цифр, а не прибавлением 22", () => {
    const day3 = birthDates({ day: 3, month: 3, year: 22 });
    const day4 = birthDates({ day: 4, month: 3, year: 22 });
    expect(day3.some((row) => row.iso.endsWith("-03-30"))).toBe(true);
    expect(day4.some((row) => row.iso.endsWith("-03-31"))).toBe(true);
    expect(day3.some((row) => row.iso.endsWith("-03-25"))).toBe(false);
  });

  it("каждая выведенная дата действительно даёт ключ страницы", () => {
    const key: MatrixKey = { day: 11, month: 2, year: 2 };
    const dates = birthDates(key);
    expect(dates.length).toBeGreaterThan(0);
    for (const row of dates) {
      const [, month, day] = row.iso.split("-").map(Number);
      expect([fold(day), fold(month)]).toEqual([key.day, key.month]);
    }
  });
});
