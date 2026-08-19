import { describe, expect, it } from "vitest";

import { FALLBACK, LEAD_ID, capLabel, lead, money, periodLabel, priceLabel } from "./tariffs";

// Срочный тариф в витрину не выводится (api/app/tariffs.py, PUBLIC_IDS), но подписи для него
// проверяем: механика прав под подписку жива, и когда её вернут, ярлыки должны быть верными.
const MONTH = { id: "month", name: "Три месяца", price: 24_000, scope: ["single", "matrix", "all"], period_days: 90 };

describe("прайс", () => {
  it("в витрине один тариф — разовый разбор, цена в копейках", () => {
    expect(FALLBACK.map((t) => t.id)).toEqual(["single"]);
    expect(FALLBACK[0].price).toBe(25_000);
    expect(FALLBACK[0].scope).toEqual(["single"]);
  });

  it("копейки печатаются рублями", () => {
    expect(priceLabel(FALLBACK[0])).toBe("250 ₽");
    expect(money(199_900)).toBe("1 999");
  });

  it("разовый бессрочен, срочный измеряется месяцами", () => {
    expect(periodLabel(FALLBACK[0])).toBe("навсегда");
    expect(periodLabel(MONTH)).toBe("на 3 месяца");
  });

  it("подпись охвата: бессрочный — по scope, срочный — подписка", () => {
    expect(capLabel(FALLBACK[0])).toBe("Одна дата");
    expect(capLabel(MONTH)).toBe("Подписка");
  });

  it("рекламируем разовый — с него начинают", () => {
    expect(LEAD_ID).toBe("single");
    expect(lead(FALLBACK).id).toBe("single");
  });
});
