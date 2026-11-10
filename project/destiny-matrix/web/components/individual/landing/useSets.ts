import { useIndividualTerms } from "@/components/pay/individualTerms";
import { useLocale } from "@/components/ui/LocaleProvider";
import { D } from "@/lib/i18n";
import { priceWords, rub } from "@/lib/individualMoney";
import { SETS, quote, type Cart } from "@/lib/individualPricing";
import type { Kind, SetKey } from "./types";

/** Prices of the sets for this buyer, as the prices block and the order form both show them. */
export function useSets() {
  const L = useLocale();
  const T = D.individualSale;
  const terms = useIndividualTerms();
  return {
    terms, prices: terms.prices, PW: priceWords(terms.prices, L),
    r: (n: number) => rub(n, L),
    priceOf: (c: Cart) => quote(c, terms.bought, terms.prices).total,
    plans: { self: SETS.selfYear("personal"), couple: SETS.couple("personal") },
    kindName: { personal: T.kindPersonal[L], pair: T.kindPair[L], year: T.kindAnyYear[L], child: T.childTag[L] } as Record<Kind | "child", string>,
  };
}

// A cart from the address opens as the matching ready set; anything else goes to the builder.
export function setOf(cart: Cart): { set: SetKey; kind?: Kind } {
  const { personal, pair, year } = cart;
  if (personal + pair + year === 1) return { set: "one", kind: personal ? "personal" : pair ? "pair" : "year" };
  if (personal === 1 && year === 1 && !pair) return { set: "selfYear" };
  if (personal === 2 && pair === 1 && !year) return { set: "couple" };
  return { set: "custom" };
}
