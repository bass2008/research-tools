"use client";

import { useLocale } from "@/components/ui/LocaleProvider";
import { D } from "@/lib/i18n";
import { rub } from "@/lib/individualMoney";
import { MAX_PER_KIND as MAX, type Cart, type IndividualKindKey, type Prices } from "@/lib/individualPricing";

/** The builder of a set: how many readings of each kind; `p` is the class prefix of the page it stands on. */
export function Steppers({ cart, setCart, year, p }: { cart: Cart; setCart: (c: Cart) => void; year: number; p: string }) {
  const L = useLocale();
  const T = D.individualSale;
  const title: Record<IndividualKindKey, string> = { personal: T.kindPersonal[L], pair: T.kindPair[L], year: T.kindYear[L](year) };
  const change = (k: IndividualKindKey, d: number) => {
    const next = { ...cart, [k]: Math.max(0, Math.min(MAX, cart[k] + d)) };
    if (!next.personal && !next.pair && !next.year) next[k] = 1;
    setCart(next);
  };
  return <div className={`${p}-steppers`}>
    {(["personal", "pair", "year"] as const).map((k) => <div key={k} className={`${p}-stp`}>
      <span><b>{title[k]}</b><small>{D.individualLanding.stepHint[L][k]}</small></span>
      <button type="button" data-d="-1" aria-label={`${T.less[L]}: ${title[k]}`} disabled={!cart[k]} onClick={() => change(k, -1)}>−</button>
      <output data-testid={`ib-${k}`}>{cart[k]}</output>
      <button type="button" data-d="1" aria-label={`${T.more[L]}: ${title[k]}`} disabled={cart[k] === MAX} onClick={() => change(k, 1)}>+</button>
    </div>)}
  </div>;
}

/** The price ladder with the current step: one, two, three, then each next one. */
export function Ladder({ count, bought, prices, p }: { count: number; bought: number; prices: Prices; p: string }) {
  const L = useLocale();
  const T = D.individualSale;
  const each = D.individualLanding.each[L];
  const r = (n: number) => rub(n, L);
  const steps: [number, string, string][] = [
    [1, r(prices.first), T.stepOne[L]],
    [2, r(prices.second), `${T.stepTwo[L]} · ${each(r(Math.round(prices.second / 2)))}`],
    [3, r(prices.third), `${T.stepThree[L]} · ${each(r(Math.round(prices.third / 3)))}`],
    [4, `+${r(prices.next)}`, bought >= 3 ? T.stepYours[L] : T.stepNext[L]],
  ];
  const state = (k: number) => bought >= 3 ? (k === 4 ? "on" : "") : (k < 4 ? count === k : count >= 4) ? "on" : count > k ? "past" : "";
  return <ol className={`${p}-ladder`}>
    {steps.map(([k, price, note]) => <li key={k} className={state(k) ? `${p}-${state(k)}` : undefined}><b>{price}</b><span>{note}</span></li>)}
  </ol>;
}
