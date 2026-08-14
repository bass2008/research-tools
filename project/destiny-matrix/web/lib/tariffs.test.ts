import { describe, expect, it } from "vitest";

import { FALLBACK, LEAD_ID, capLabel, lead, money, periodLabel, priceLabel } from "./tariffs";

describe("прайс", () => {
  it("два тарифа, цены в копейках", () => {
    expect(FALLBACK.map((t) => t.id)).toEqual(["single", "month"]);
    expect(FALLBACK.map((t) => t.price)).toEqual([10_000, 24_000]);
  });

  it("копейки печатаются рублями", () => {
    expect(priceLabel(FALLBACK[0])).toBe("100 ₽");
    expect(priceLabel(FALLBACK[1])).toBe("240 ₽");
    expect(money(199_900)).toBe("1 999");
  });

  it("разовый бессрочен, срочный на три месяца", () => {
    expect(periodLabel(FALLBACK[0])).toBe("навсегда");
    expect(periodLabel(FALLBACK[1])).toBe("на 3 месяца");
  });

  it("подпись охвата: бессрочный — по scope, срочный — подписка", () => {
    expect(capLabel(FALLBACK[0])).toBe("Одна дата");
    expect(capLabel(FALLBACK[1])).toBe("Подписка");
  });

  it("рекламируем разовый — с него начинают", () => {
    expect(LEAD_ID).toBe("single");
    expect(lead(FALLBACK).id).toBe("single");
  });

  it("месячный даёт хранение и любые даты, разовый — только один разбор", () => {
    expect(FALLBACK[0].scope).toEqual(["single"]);
    expect(FALLBACK[1].scope).toEqual(["single", "matrix", "all"]);
  });
});
