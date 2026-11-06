import { D } from "./i18n";
import { forLocale as formatForLocale } from "./i18n/format";
import type { Lang } from "./i18n/hosts";
import type { PriceWords, Prices } from "./individualPricing";

/** A price as the site writes it in this language; the number never breaks away from the sign. */
export const rub = (n: number, L: Lang = "ru") =>
  D.pay.priceFormat[L](formatForLocale(L).groupNumber(n)).replace(/[\s\u202f]/g, "\u00a0");

export function priceWords(p: Prices, L: Lang = "ru"): PriceWords {
  const r = (n: number) => rub(n, L);
  return { first: r(p.first), second: r(p.second), third: r(p.third), next: r(p.next),
    after: r(p.after_three), thirdStep: r(p.third - p.second) };
}
