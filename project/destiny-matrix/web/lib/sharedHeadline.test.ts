import { describe, expect, it } from "vitest";
import { calculate } from "./matrix";
import { pairDates, sharedHeadline, sharedPoints } from "./sharedHeadline";

const pair = { a: { birth: "1993-03-31" }, b: { birth: "1994-12-28" } };

describe("what a messenger shows for a shared reading", () => {
  it("names the reading and puts its dates in the title", () => {
    expect(sharedHeadline({ shared: "reading", inputs: { birth: "1993-03-31" } }, "ru"))
      .toEqual({ title: "Разбор матрицы судьбы", dates: "31 марта 1993" });
    expect(sharedHeadline({ shared: "reading", inputs: pair }, "ru"))
      .toEqual({ title: "Совместимость по матрице судьбы", dates: "31 марта 1993 и 28 декабря 1994" });
    expect(sharedHeadline({ shared: "individual", inputs: { birth: "1993-03-31" }, year: 2027 }, "ru").title).toBe("Индивидуальный разбор на 2027 год");
    expect(sharedHeadline({ shared: "individual", inputs: pair }, "ru").title).toBe("Индивидуальный разбор пары");
    expect(sharedHeadline({ shared: "individual", inputs: { birth: "1993-03-31" } }, "en").title).toBe("Individual destiny matrix reading");
    expect(pairDates("en", "1993-03-31", "1994-12-28")).toMatch(/1993 and .*1994/);
  });

  it("draws the outer eight points from the left clockwise and the centre last", () => {
    const m = calculate("1993-03-31", "m");
    expect(sharedPoints({ shared: "reading", inputs: { birth: "1993-03-31", sex: "m" } }, "ru"))
      .toEqual([m.day, m.father_line, m.month, m.mother_line, m.year, m.descendants, m.mission, m.inheritance, m.center]);
    expect(sharedPoints({ shared: "reading", inputs: pair }, "ru")).toHaveLength(9);
    expect(sharedPoints({ shared: "reading", inputs: {} }, "ru")).toBeNull();
  });
});
