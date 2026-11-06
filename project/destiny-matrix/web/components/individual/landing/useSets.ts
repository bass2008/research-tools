import { useIndividualTerms } from "@/components/pay/IndividualOffer";
import { useLocale } from "@/components/ui/LocaleProvider";
import { D } from "@/lib/i18n";
import { priceWords, rub } from "@/lib/individualMoney";
import { SETS, quote, type Cart } from "@/lib/individualPricing";
import type { Kind } from "./types";

/** Prices of the sets for this buyer, as the prices block and the order form both show them. */
export function useSets(year: number) {
  const L = useLocale();
  const T = D.individualSale;
  const terms = useIndividualTerms();
  return {
    terms, prices: terms.prices, PW: priceWords(terms.prices, L),
    r: (n: number) => rub(n, L),
    priceOf: (c: Cart) => quote(c, terms.bought, terms.prices).total,
    plans: { self: SETS.selfYear("personal"), couple: SETS.couple("personal") },
    kindName: { personal: T.kindPersonal[L], pair: T.kindPair[L], year: T.kindYear[L](year) } as Record<Kind, string>,
  };
}
