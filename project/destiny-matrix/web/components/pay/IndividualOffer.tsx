"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/account/useSession";
import { useLocale } from "@/components/ui/LocaleProvider";
import Link from "@/components/ui/LocalizedLink";
import { track } from "@/lib/analytics";
import { forLocale as localizedApi } from "@/lib/api";
import { D } from "@/lib/i18n";
import { Ladder, Steppers } from "@/components/pay/IndividualBuilder";
import RichText from "@/components/ui/RichText";
import { arcanumImage } from "@/components/matrix/ArcanumCard";
import { forLocale as arcanaForLocale } from "@/lib/arcana";
import {
  COUPLE_CARDS, DEFAULT_PRICES, EMPTY_CART, KIND_CARDS, SELF_YEAR_CARDS, SETS, cartQuery, defaultYearFor, quote,
  type Cart, type IndividualTerms, type Prices,
} from "@/lib/individualPricing";
import { SAMPLE_BIRTH } from "@/lib/individualSample";
import { useBirth } from "@/lib/useBirth";
import { yearMatrix } from "@/lib/yearMatrix";
import { priceWords, rub } from "@/lib/individualMoney";
import { browserDay } from "@/lib/today";
import type { Lang } from "@/lib/i18n/hosts";

export interface Terms { bought: number; prices: Prices; defaultYear: number; payable: boolean }

// One request per language and account for every block on the page; an order changes the count.
const asked = new Map<string, Promise<IndividualTerms>>();
export function forgetIndividualTerms() { asked.clear(); }

/** Prices from the database and how many readings the buyer has paid for: from three on, any
 *  reading costs `after_three`. Until the answer comes, the seeded prices and the browser's year. */
export function useIndividualTerms(): Terms {
  const L = useLocale();
  const { status, email } = useSession();
  const [terms, setTerms] = useState<Terms>({ bought: 0, prices: DEFAULT_PRICES, defaultYear: 0, payable: true });
  useEffect(() => {
    let live = true;
    setTerms((t) => ({ ...t, defaultYear: t.defaultYear || defaultYearFor(browserDay()) }));
    if (status === "loading") return;
    const key = `${L}|${status === "user" ? email : ""}`;
    if (!asked.has(key)) asked.set(key, localizedApi(L).api.individualTerms());
    asked.get(key)!
      .then((t) => { if (live) setTerms({ bought: t.bought, prices: t.prices, defaultYear: t.default_year, payable: t.payable !== false }); })
      .catch(() => asked.delete(key));
    return () => { live = false; };
  }, [status, email, L]);
  return terms;
}

/** Any year can be chosen; the input only keeps it a plausible one. */
export function YearInput({ value, onChange, label }: { value: number; onChange: (y: number) => void; label: string }) {
  return <input className="iyear" type="number" inputMode="numeric" min={1900} max={2200} value={value || ""} aria-label={label}
    onChange={(e) => { const y = Math.trunc(Number(e.target.value)); if (y) onChange(y); }} />;
}

type Kind = "personal" | "pair" | "year";

const Cards = ({ ns }: { ns: number[] }) => <div className="pw-cardrow">{ns.map((n) => <img key={n} src={arcanumImage(n, true)} alt="" />)}</div>;
const order = (cart: Cart, year: number) => `/individual?${cartQuery(cart, year)}#order`;

/** Gold section of /pay: ready sets, the builder and the perk for those who bought three (reports/individual-sales, paywall.html). */
export default function IndividualOffer() {
  const L = useLocale();
  const T = D.individualSale;
  const TL = D.individualLanding;
  const r = (n: number) => rub(n, L as Lang);
  const terms = useIndividualTerms();
  const P = priceWords(terms.prices, L);
  const { arcanumTitle } = arcanaForLocale(L);
  const stored = useBirth();
  const year = terms.defaultYear;
  const [oneKind, setOneKind] = useState<Kind>("personal");
  const [custom, setCustom] = useState<Cart>({ ...EMPTY_CART, personal: 2 });
  const after = terms.bought >= 3;
  const price = (c: Cart) => quote(c, terms.bought, terms.prices).total;
  const oneCart = { ...EMPTY_CART, [oneKind]: 1 };
  const self = SETS.selfYear("personal"), couple = SETS.couple("personal");
  const kindName: Record<Kind, string> = { personal: T.kindPersonal[L], pair: T.kindPair[L], year: T.kindYear[L](year) };
  const birth = stored?.birth ?? SAMPLE_BIRTH;
  const [by, bm, bd] = birth.split("-").map(Number);
  const y = year ? yearMatrix({ y: by, m: bm, d: bd }, year) : null;
  const q = quote(custom, terms.bought, terms.prices);
  return (
    <section className="theme-gold isale" aria-labelledby="isale-h" data-testid="individual-offer">
      <p className="isale-divider">{T.goldDivider[L]}</p>
      <div className="pw-gsec">
        <div className="pw-gcap">{T.goldCapLeft[L]} <span>{T.goldCapRight[L]}</span></div>
        <div className="pw-gin">
          <h2 id="isale-h" className="pw-isec-h">{T.heading[L]}</h2>
          <p className="pw-isec-sub">{T.sub[L]}</p>
          {after && <p className="pw-perk" data-testid="isale-perk"><b>{T.perkThreeStrong[L]}</b> {T.perkThree[L](P)}</p>}
          <div className="pw-iplans">
            <article className="pw-iplan" data-testid="iset-one">
              <div className="pw-ph"><div><h3>{T.setOne[L]}</h3><p className="pw-tagline">{TL.oneTagline[L]}</p></div><Cards ns={KIND_CARDS[oneKind]} /></div>
              <div className="pw-kinds">
                {(["personal", "pair", "year"] as const).map((k) => <button key={k} type="button" className={oneKind === k ? "pw-on" : undefined} onClick={() => setOneKind(k)}>{kindName[k]}</button>)}
              </div>
              <p className="pw-desc">{TL.kindDesc[L][oneKind](oneKind === "personal" ? TL.yourDate[L] : String(year))}</p>
              <p className="pw-iprice">{r(price(oneCart))}</p>
              <p className="pw-iprice-sub">{after ? T.afterThreeSub[L](P) : T.setOneSub[L]}</p>
              <Link className="pw-ibtn pw-ghost" href={order(oneCart, year)} onClick={() => track("individual_set", { place: `one-${oneKind}` })}>{T.choose[L]}</Link>
              <Link className="pw-ex-link" href={`/matrix/individual-example/${oneKind}`}>{TL.exLabel[L][oneKind]}</Link>
            </article>
            <article className="pw-iplan pw-rec" data-testid="iset-selfYear">
              <span className="pw-ribbon">{TL.ribbon[L]}</span>
              <div className="pw-ph"><div><h3>{T.setSelfYear[L](year)}</h3><p className="pw-tagline">{TL.selfYearTagline[L](year)}</p></div><Cards ns={SELF_YEAR_CARDS} /></div>
              <p className="pw-desc">{TL.selfYearDesc[L](year)}</p>
              {y && <p className="pw-y2027"><RichText text={T.yearFor[L](stored ? T.yourYear[L](year) : T.yearOfDate[L](year, birth.split("-").reverse().join(".")),
                `${y.centre} ${arcanumTitle(y.centre)}`, y.periods.map((n) => arcanumTitle(n)) as [string, string, string])} /></p>}
              <p className="pw-iprice">{r(price(self))}</p>
              <p className="pw-iprice-sub">{after ? T.afterThreeSub[L](P) : T.separately[L](r(terms.prices.first * 2))}</p>
              <Link className="pw-ibtn pw-gold" href={order(self, year)} onClick={() => track("individual_set", { place: "self-year" })}>{T.choose[L]}</Link>
              <Link className="pw-ex-link" href="/matrix/individual-example/year">{TL.exLabel[L].year}</Link>
            </article>
            <article className="pw-iplan" data-testid="iset-couple">
              <div className="pw-ph"><div><h3>{T.setCouple[L]}</h3><p className="pw-tagline">{TL.coupleTagline[L]}</p></div><Cards ns={COUPLE_CARDS} /></div>
              <p className="pw-desc">{TL.coupleDesc[L]}</p>
              <p className="pw-iprice">{r(price(couple))}</p>
              <p className="pw-iprice-sub">{after ? T.afterThreeSub[L](P) : `${T.separately[L](r(terms.prices.first * 3))} · ${T.coupleExtra[L](P)}`}</p>
              <Link className="pw-ibtn pw-ghost" href={order(couple, year)} onClick={() => track("individual_set", { place: "couple" })}>{T.choose[L]}</Link>
              <Link className="pw-ex-link" href="/matrix/individual-example/pair">{TL.exLabel[L].pair}</Link>
            </article>
          </div>
          <div className="pw-builder" data-testid="ibuilder">
            <div className="pw-b-copy">
              <p className="pw-kicker">{TL.builderKicker[L]}</p>
              <h3>{TL.builderTitle[L]}</h3>
              <p>{T.builderText[L](P)}</p>
            </div>
            <div className="pw-b-box">
              <Steppers cart={custom} setCart={setCustom} year={year} p="pw" />
              <Ladder count={quote(custom, 0, terms.prices).count} bought={terms.bought} prices={terms.prices} p="pw" />
              <div className="pw-b-total">
                <p data-testid="ib-total"><b>{r(q.total)}</b> · {T.readings[L](q.count)}{q.perReading ? <> · {TL.each[L](r(q.perReading))}</> : null}{q.separately ? <s>{r(q.separately)}</s> : null}</p>
                <Link className="pw-ibtn pw-gold" href={order(custom, year)} onClick={() => track("individual_set", { place: "builder" })}>{T.checkout[L]}</Link>
              </div>
            </div>
          </div>
          <p className="pw-nosub"><RichText text={T.terms[L]} /></p>
          {!terms.payable && <p className="isale-region" data-testid="isale-region">{D.pay.regionUnavailable[L]}</p>}
        </div>
      </div>
    </section>
  );
}
