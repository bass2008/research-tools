// Prices of individual readings (docs/individual-reading.md). They live in the `prices` table and
// come with /api/individual-orders/terms; the server counts the same way and is the one that charges.

export interface Prices { first: number; second: number; third: number; next: number; after_three: number }
/** Shown until the terms arrive; the same values the database is seeded with. */
export const DEFAULT_PRICES: Prices = { first: 1990, second: 2990, third: 3590, next: 1190, after_three: 1190 };

export type IndividualKindKey = "personal" | "pair" | "year";
/** At most this many readings of one kind in an order; the API refuses more (MAX_PER_KIND). */
export const MAX_PER_KIND = 10;
export type Cart = Record<IndividualKindKey, number>;
export const EMPTY_CART: Cart = { personal: 0, pair: 0, year: 0 };
export const CART_KINDS: IndividualKindKey[] = ["personal", "pair", "year"];

export type SetKey = "one" | "selfYear" | "couple";
export const SETS: Record<SetKey, (oneKind: "personal" | "pair") => Cart> = {
  one: (oneKind) => ({ ...EMPTY_CART, [oneKind]: 1 }),
  selfYear: () => ({ ...EMPTY_CART, personal: 1, year: 1 }),
  couple: () => ({ ...EMPTY_CART, personal: 2, pair: 1 }),
};

/** Cards on the sets: the sample's mask, main talent and trigger for a personal reading, and so on. */
export const KIND_CARDS: Record<IndividualKindKey, number[]> = { personal: [12, 8, 11], pair: [6, 19, 15], year: [7, 4, 14] };
export const SELF_YEAR_CARDS = [12, 10, 21];
export const COUPLE_CARDS = [6, 19, 17];

/** In the first half of the year — this year, from July on — the next one; any year can be chosen. */
export function defaultYearFor(today: { month: number; year: number }): number {
  return today.month <= 6 ? today.year : today.year + 1;
}

/** Price of n readings in one order: first, second, third, then `next` for each one more. */
export function ladder(n: number, p: Prices = DEFAULT_PRICES): number {
  if (n <= 0) return 0;
  if (n === 1) return p.first;
  if (n === 2) return p.second;
  return p.third + (n - 3) * p.next;
}

export interface Quote {
  total: number;
  /** each reading at the price of one; null when not more than the total */
  separately: number | null;
  /** average per reading, when there is more than one */
  perReading: number | null;
  count: number;
}

/** With three paid readings any reading costs `after_three`. */
export function quote(cart: Cart, bought: number, p: Prices = DEFAULT_PRICES): Quote {
  const count = cart.personal + cart.pair + cart.year;
  const total = bought >= 3 ? count * p.after_three : ladder(count, p);
  const separately = count * p.first;
  return {
    total,
    separately: separately > total ? separately : null,
    perReading: count > 1 ? Math.round(total / count) : null,
    count,
  };
}

export function cartQuery(cart: Cart, year?: number): string {
  const parts = CART_KINDS.filter((k) => cart[k] > 0).map((k) => `${k}=${cart[k]}`);
  if (cart.year > 0 && year) parts.push(`y=${year}`);
  return parts.join("&");
}

export interface IndividualTerms { bought: number; default_year: number; prices: Prices; typical_days: number; max_days: number; payable: boolean }

export interface OrderPerson { birth: string; sex: "f" | "m" }
/** `who` — indexes in `persons`: one person, two for a couple. */
export interface OrderReading { kind: IndividualKindKey; who: number[]; year?: number; relation?: string }

export interface IndividualOrder {
  email: string;
  persons: OrderPerson[];
  readings: OrderReading[];
  question: string;
}

/** ISO date `days` working days after `today`; weekends do not count. */
export function workdaysFrom(today: { day: number; month: number; year: number }, days: number): string {
  const d = new Date(Date.UTC(today.year, today.month - 1, today.day));
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) left -= 1;
  }
  return d.toISOString().slice(0, 10);
}

/** Prices written out for the texts (`lib/individualMoney.ts`); `thirdStep` is what the third reading adds. */
export interface PriceWords { first: string; second: string; third: string; next: string; after: string; thirdStep: string }
