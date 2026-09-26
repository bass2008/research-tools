// Прайс живёт в базе: цену меняем часто, для этого пересборка не нужна. Здесь только тип и
// перевод копеек в валюту витрины. Значений цены в коде нет: при недоступной базе оплату нельзя
// корректно открыть, поэтому интерфейс показывает «уточняется».
import { D, forLocale as localizedI18n } from "./i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "./i18n/lang";
import { localized } from "./i18n/localized";

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

/** A locale-bound view; safe to use alongside other languages. */
export const forLocale = localized((L: Locale) => {
  const { groupNumber } = localizedI18n(L);

  /** Тариф, который рекламируем и показываем в первом экране. */
  const LEAD_ID: TariffId = "single";

  function money(kopecks: number): string {
    return groupNumber(Math.round(kopecks / 100));
  }

  function priceLabel(t: Tariff): string {
    return D.pay.priceFormat[L](money(t.price));
  }

  function periodLabel(t: Tariff): string {
    if (t.period_days === null) return D.pay.forever[L];
    if (t.period_days % 30 === 0) {
      const months = t.period_days / 30;
      if (months === 1) return D.pay.forMonth[L];
      return D.pay.forMonths[L](months);
    }
    return D.pay.forDays[L](t.period_days);
  }

  function capLabel(t: Tariff): string {
    // срок в тарифе — это подписка: доступ живёт, пока она активна
    if (t.period_days !== null) return D.pay.subscription[L];
    return t.scope.includes("all") ? D.pay.anyDates[L] : D.pay.oneDate[L];
  }

  function byId(list: Tariff[], id: string): Tariff | undefined {
    return list.find((t) => t.id === id);
  }

  function lead(list: Tariff[]): Tariff | null {
    return byId(list, LEAD_ID) ?? list[0] ?? null;
  }
  return { LEAD_ID, money, priceLabel, periodLabel, capLabel, byId, lead };
});

// Compatibility for callers that explicitly use the deployment default.
export const { LEAD_ID, money, priceLabel, periodLabel, capLabel, byId, lead } = forLocale(defaultLocale);

export interface PaymentProvider {
  id: string;
  provider: string;
}
