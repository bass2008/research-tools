import { describe, expect, it } from "vitest";
import { monthPoints, yearMatrix, yearPoints } from "./yearMatrix";

// The year example (07.10.1988, 2027) states the centre and the three periods in its own text.
describe("матрица года", () => {
  it("совпадает с примером разбора года: центр Сила, периоды Суд, Император, Влюблённые", () => {
    expect(yearMatrix({ y: 1988, m: 10, d: 7 }, 2027)).toEqual({ centre: 11, periods: [20, 4, 6] });
  });
});

// «Прогностика»: 28.07.1991 на 2023 — А 6, Б 8, В 9, Г 5, Д 10, Е 14, Ё 17, Ж 14, З 11; трети 10, 20, 3.
// Прогноз на месяц: 30.06.1998 на июнь 2023 — А 7, Б 12, В 7, Г 8, Д 7, Е 19, Ё 19, Ж 15, З 15.
describe("точки матрицы года и месяца по примерам книги", () => {
  it("год", () => {
    const p = yearPoints({ y: 1991, m: 7, d: 28 }, 2023);
    expect(["A", "B", "C", "D", "E", "F", "G", "H", "I", "P1", "P2", "P3"].map((k) => p[k as keyof typeof p]))
      .toEqual([6, 8, 9, 5, 10, 14, 17, 14, 11, 10, 20, 3]);
  });
  it("месяц", () => {
    const p = monthPoints({ y: 1998, m: 6, d: 30 }, 2023, 6);
    expect(["A", "B", "C", "D", "E", "F", "G", "H", "I"].map((k) => p[k as keyof typeof p])).toEqual([7, 12, 7, 8, 7, 19, 19, 15, 15]);
  });
  it("день месяца складывается целиком: декабрь 2027 для 07.10.1988", () => {
    expect(monthPoints({ y: 1988, m: 10, d: 7 }, 2027, 12).A).toBe(3);
  });
});
