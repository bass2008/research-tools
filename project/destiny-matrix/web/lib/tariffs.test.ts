import { D, L, groupNumber } from "./i18n";
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
    expect(priceLabel(SINGLE)).toBe(D.pay.priceFormat[L](money(SINGLE.price)));
    // Разделитель разрядов у языков свой (`lib/i18n/format.ts`): сверяем с ним, а не с видом
    // одного языка.
    expect(money(199_900)).toBe(groupNumber(1999));
  });

  it("разовый бессрочен, срочный измеряется месяцами", () => {
    expect(periodLabel(SINGLE)).toBe(D.pay.forever[L]);
    expect(periodLabel(MONTH)).toBe(D.pay.forMonths[L](3));
  });

  it("подпись охвата: бессрочный — по scope, срочный — подписка", () => {
    expect(capLabel(SINGLE)).toBe(D.pay.oneDate[L]);
    expect(capLabel(MONTH)).toBe(D.pay.subscription[L]);
  });

  it("рекламируем разовый — с него начинают", () => {
    expect(LEAD_ID).toBe("single");
    expect(lead([SINGLE])?.id).toBe("single");
    expect(lead([])).toBeNull();
  });
});
