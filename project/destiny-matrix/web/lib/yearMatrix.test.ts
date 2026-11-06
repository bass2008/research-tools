import { describe, expect, it } from "vitest";
import { yearMatrix } from "./yearMatrix";

// The year example (07.10.1988, 2027) states the centre and the three periods in its own text.
describe("матрица года", () => {
  it("совпадает с примером разбора года: центр Сила, периоды Суд, Император, Влюблённые", () => {
    expect(yearMatrix({ y: 1988, m: 10, d: 7 }, 2027)).toEqual({ centre: 11, periods: [20, 4, 6] });
  });
});
