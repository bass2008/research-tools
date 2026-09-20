// Прайс живёт в базе: цену меняем часто, для этого пересборка не нужна. Здесь только тип и
// перевод копеек в валюту витрины. Значений цены в коде нет: при недоступной базе оплату нельзя
// корректно открыть, поэтому интерфейс показывает «уточняется».
import { D, L, groupNumber } from "./i18n";


export type TariffId = "single" | "month";

export interface Tariff {
  id: TariffId | string;
  name: string;
  /** копейки: 10000 = 100 ₽ */
  price: number;
  /** виды доступа: single | matrix | all */
  scope: string[];
  /** null — бессрочно */
  period_days: number | null;
}

/** Тариф, который рекламируем и показываем в первом экране. */
export const LEAD_ID: TariffId = "single";

export function money(kopecks: number): string {
  return groupNumber(Math.round(kopecks / 100));
}

export function priceLabel(t: Tariff): string {
  return D.pay.priceFormat[L](money(t.price));
}

export function periodLabel(t: Tariff): string {
  if (t.period_days === null) return D.pay.forever[L];
  if (t.period_days % 30 === 0) {
    const months = t.period_days / 30;
    if (months === 1) return D.pay.forMonth[L];
    return D.pay.forMonths[L](months);
  }
  return D.pay.forDays[L](t.period_days);
}

export function capLabel(t: Tariff): string {
  // срок в тарифе — это подписка: доступ живёт, пока она активна
  if (t.period_days !== null) return D.pay.subscription[L];
  return t.scope.includes("all") ? D.pay.anyDates[L] : D.pay.oneDate[L];
}

export function byId(list: Tariff[], id: string): Tariff | undefined {
  return list.find((t) => t.id === id);
}

export function lead(list: Tariff[]): Tariff | null {
  return byId(list, LEAD_ID) ?? list[0] ?? null;
}
