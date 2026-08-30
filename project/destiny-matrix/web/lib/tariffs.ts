// Прайс живёт в базе: цену меняем часто, для этого пересборка не нужна. Здесь только тип,
// перевод копеек в рубли. Значений цены в коде нет: при недоступной базе оплату нельзя
// корректно открыть, поэтому интерфейс показывает «уточняется».

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
  const rubles = Math.round(kopecks / 100);
  return rubles.toLocaleString("ru-RU").replace(/ /g, " ");
}

export function priceLabel(t: Tariff): string {
  return `${money(t.price)} ₽`;
}

export function periodLabel(t: Tariff): string {
  if (t.period_days === null) return "навсегда";
  if (t.period_days % 30 === 0) {
    const months = t.period_days / 30;
    if (months === 1) return "на месяц";
    return `на ${months} ${months < 5 ? "месяца" : "месяцев"}`;
  }
  return `на ${t.period_days} дней`;
}

export function capLabel(t: Tariff): string {
  // срок в тарифе — это подписка: доступ живёт, пока она активна
  if (t.period_days !== null) return "Подписка";
  return t.scope.includes("all") ? "Любое число дат" : "Одна дата";
}

export function byId(list: Tariff[], id: string): Tariff | undefined {
  return list.find((t) => t.id === id);
}

export function lead(list: Tariff[]): Tariff | null {
  return byId(list, LEAD_ID) ?? list[0] ?? null;
}
