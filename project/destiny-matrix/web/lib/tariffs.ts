// Прайс живёт в базе: цену меняем часто, для этого пересборка не нужна. Здесь только тип,
// перевод копеек в рубли и запасной набор — он используется, когда API недоступен, чтобы
// страница не оказалась без цен вовсе.

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

/** Запасные значения, совпадающие с наполнением справочника в api/app/tariffs.py. */
export const FALLBACK: Tariff[] = [
  { id: "single", name: "Полный разбор одной даты", price: 10_000, scope: ["single"], period_days: null },
  {
    id: "month",
    name: "Три месяца без ограничений",
    price: 24_000,
    scope: ["single", "matrix", "all"],
    period_days: 90,
  },
];

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

export function lead(list: Tariff[]): Tariff {
  return byId(list, LEAD_ID) ?? list[0] ?? FALLBACK[0];
}

// ── откуда цену берут страницы ──────────────────────────────────────────────────────
//
// Лендинг, оплата и оферта рендерятся на запрос и берут прайс здесь, `getTariffs`. Статика
// (энциклопедия, 5 544 матрицы) собрана заранее: её кнопки печатают запасную цену и заменяют
// её живой на клиенте — `TariffsProvider` через BFF. Зашитого прайса в разметке нет нигде.

/** Серверная загрузка справочника. Кешировать нельзя: цену меняем на ходу. */
export async function getTariffs(): Promise<Tariff[]> {
  const base = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8010";
  try {
    const res = await fetch(`${base}/api/tariffs`, { cache: "no-store" });
    if (!res.ok) return FALLBACK;
    const body = (await res.json()) as { items?: Tariff[] };
    return Array.isArray(body.items) && body.items.length ? body.items : FALLBACK;
  } catch {
    return FALLBACK;   // API не поднят: страница обязана открыться, пусть с запасными ценами
  }
}
