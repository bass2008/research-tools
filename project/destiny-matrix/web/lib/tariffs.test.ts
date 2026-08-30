import { describe, expect, it } from "vitest";

import { LEAD_ID, capLabel, lead, money, periodLabel, priceLabel, type Tariff } from "./tariffs";

// Срочный тариф в витрину не выводится (api/app/tariffs.py, PUBLIC_IDS), но подписи для него
// проверяем: механика прав под подписку жива, и когда её вернут, ярлыки должны быть верными.
const MONTH = { id: "month", name: "Три месяца", price: 24_000, scope: ["single", "matrix", "all"], period_days: 90 };
const SINGLE: Tariff = {
  id: "single",
  name: "Полный разбор одной даты",
  price: 25_000,
  scope: ["single"],
  period_days: null,
};

describe("прайс", () => {
  it("модель тарифа хранит цену в копейках", () => {
    expect(SINGLE.price).toBe(25_000);
    expect(SINGLE.scope).toEqual(["single"]);
  });

  it("копейки печатаются рублями", () => {
    expect(priceLabel(SINGLE)).toBe("250 ₽");
    expect(money(199_900)).toBe("1 999");
  });

  it("разовый бессрочен, срочный измеряется месяцами", () => {
    expect(periodLabel(SINGLE)).toBe("навсегда");
    expect(periodLabel(MONTH)).toBe("на 3 месяца");
  });

  it("подпись охвата: бессрочный — по scope, срочный — подписка", () => {
    expect(capLabel(SINGLE)).toBe("Одна дата");
    expect(capLabel(MONTH)).toBe("Подписка");
  });

  it("рекламируем разовый — с него начинают", () => {
    expect(LEAD_ID).toBe("single");
    expect(lead([SINGLE])?.id).toBe("single");
    expect(lead([])).toBeNull();
  });
});
