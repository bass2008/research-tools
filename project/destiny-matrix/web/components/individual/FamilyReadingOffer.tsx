"use client";

import { onePrice, useIndividualTerms } from "@/components/pay/individualTerms";
import { useLocale } from "@/components/ui/LocaleProvider";
import Link from "@/components/ui/LocalizedLink";
import { ALL_FREE } from "@/lib/access";
import { track } from "@/lib/analytics";
import { D } from "@/lib/i18n";
import { rub } from "@/lib/individualMoney";
import { EMPTY_CART, cartQuery, quote, type Cart, type OrderPreset } from "@/lib/individualPricing";

type Variant = "child" | "line";
type Option = { key: "pair" | "child" | "self" | "bundle"; cart: Partial<Cart>; preset: OrderPreset };

const PAIR: Option = { key: "pair", cart: { pair: 1 }, preset: { relation: "parent_child" } };
const BUNDLE: Option = { key: "bundle", cart: { personal: 1, pair: 1 }, preset: { relation: "parent_child", childFirst: true } };
// the child article sells the couple first: a parent's question is usually "how do I get on with them"
const OPTIONS: Record<Variant, Option[]> = {
  child: [PAIR, { key: "child", cart: { personal: 1 }, preset: { childFirst: true } }, BUNDLE],
  line: [{ key: "self", cart: { personal: 1 }, preset: {} }, PAIR, BUNDLE],
};

/** Individual readings under the family articles: live prices, and the order form opens with the couple's
 *  relation and, for a child, without the visitor's own saved date. Only where individual readings are sold. */
export default function FamilyReadingOffer({ variant }: { variant: Variant }) {
  const L = useLocale();
  const terms = useIndividualTerms();
  if (L !== "ru" || ALL_FREE || !terms.payable) return null;
  const T = D.familyOffer;
  return (
    <section className="allbox section-gap family-offer" data-testid={`family-offer-${variant}`}>
      <h2>{T.title[variant][L]}</h2>
      <p>{T.lead[variant][L]}</p>
      <div className="family-offer-grid">
        {OPTIONS[variant].map((o, i) => {
          const cart = { ...EMPTY_CART, ...o.cart };
          const q = quote(cart, terms.bought, terms.prices);
          const price = q.count > 1 ? q.total : onePrice(terms);
          return (
            <div className="family-offer-item" key={o.key}>
              <h3>{T.options[o.key].title[L]}</h3>
              <p>{T.options[o.key].text[L]}</p>
              <p className="family-offer-price">
                <b>{rub(price, L)}</b>{q.separately && q.count > 1 ? <> <s>{rub(q.separately, L)}</s></> : null}
              </p>
              <Link className={`btn${i === 0 ? " gold" : " ghost"}`} href={`/pay?${cartQuery(cart, undefined, o.preset)}#order`}
                onClick={() => track("individual_set", { place: `${variant}-article-${o.key}` })} data-testid={`family-offer-order-${o.key}`}>
                {T.order[L]}
              </Link>
            </div>
          );
        })}
      </div>
      <p className="family-offer-note">
        {terms.bought >= 3 ? T.afterThree[L](rub(terms.prices.after_three, L)) : T.saving[L]} {T.form[L]}
      </p>
      <p className="family-offer-note">
        <Link href="/matrix/individual-example/child" data-testid="family-offer-example">{D.individualLanding.exLabel[L].child}</Link>
      </p>
    </section>
  );
}
