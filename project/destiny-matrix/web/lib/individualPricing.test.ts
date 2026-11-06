import { describe, expect, it } from "vitest";
import { DEFAULT_PRICES, EMPTY_CART, cartQuery, defaultYearFor, ladder, quote, workdaysFrom } from "./individualPricing";

// The server counts the same (api/app/individual_orders.py); this is what the page shows before paying.
describe("цены индивидуальных разборов", () => {
  it("лесенка: 1 990, 2 990, 3 590, дальше по 1 190", () => {
    expect([0, 1, 2, 3, 4, 5].map((n) => ladder(n))).toEqual([0, 1990, 2990, 3590, 4780, 5970]);
  });

  it("набор дешевле, чем по отдельности", () => {
    const q = quote({ ...EMPTY_CART, personal: 2, pair: 1 }, 0);
    expect(q.total).toBe(3590);
    expect(q.separately).toBe(3 * 1990);
    expect(q.perReading).toBe(Math.round(3590 / 3));
  });

  it("после трёх оплаченных любой разбор стоит 1 190", () => {
    expect(quote({ ...EMPTY_CART, pair: 1 }, 3).total).toBe(1190);
    expect(quote({ ...EMPTY_CART, personal: 2, pair: 1 }, 3, DEFAULT_PRICES).total).toBe(3 * 1190);
  });

  it("год по умолчанию: до июля текущий, с июля следующий", () => {
    expect(defaultYearFor({ month: 6, year: 2027 })).toBe(2027);
    expect(defaultYearFor({ month: 7, year: 2027 })).toBe(2028);
  });

  it("сроки считаются в рабочих днях: из пятницы — понедельник и среда", () => {
    const friday = { day: 6, month: 11, year: 2026 };
    expect(workdaysFrom(friday, 1)).toBe("2026-11-09");
    expect(workdaysFrom(friday, 3)).toBe("2026-11-11");
  });

  it("ссылка на форму несёт состав и год", () => {
    expect(cartQuery({ ...EMPTY_CART, personal: 1, year: 1 }, 2031)).toBe("personal=1&year=1&y=2031");
    expect(cartQuery({ ...EMPTY_CART, personal: 2 }, 2031)).toBe("personal=2");
  });
});
