"use client";

import { useMemo } from "react";
import { arcanumImage } from "@/components/matrix/ArcanumCard";
import { Ladder, Steppers } from "@/components/pay/IndividualBuilder";
import { useLocale } from "@/components/ui/LocaleProvider";
import Link from "@/components/ui/LocalizedLink";
import RichText from "@/components/ui/RichText";
import { forLocale as arcanaForLocale } from "@/lib/arcana";
import { D } from "@/lib/i18n";
import { COUPLE_CARDS, EMPTY_CART, KIND_CARDS, SELF_YEAR_CARDS, quote, type Cart } from "@/lib/individualPricing";
import { yearMatrix } from "@/lib/yearMatrix";
import { showDate, type Kind, type SetKey, type UserInfo } from "./types";
import { useSets } from "./useSets";

/** Ready sets and the builder; "Choose" puts the set into the order form below. */
export default function PricesSection({ user, sampleBirth, year, oneKind, setOneKind, custom, setCustom, goOrder }: {
  user: UserInfo | null; sampleBirth: string; year: number; oneKind: Kind; setOneKind: (k: Kind) => void;
  custom: Cart; setCustom: (c: Cart) => void; goOrder: (s: SetKey, kind?: Kind) => void;
}) {
  const L = useLocale();
  const T = D.individualSale;
  const TL = D.individualLanding;
  const { arcanumTitle } = arcanaForLocale(L);
  const { terms, prices, PW, r, priceOf, plans, kindName } = useSets(year);
  const after = terms.bought >= 3;
  const oneCart = { ...EMPTY_CART, [oneKind]: 1 };
  const sampleYear = useMemo(() => {
    const [y, m, d] = sampleBirth.split("-").map(Number);
    return yearMatrix(user?.date ?? { y, m, d }, year);
  }, [user, sampleBirth, year]);
  const q = quote(custom, terms.bought, prices);
  return (
  <section className="lp-sec" id="prices">
    <div className="lp-wrap">
      <h2 className="lp-sec-h">{T.heading[L]}</h2>
      <p className="lp-sec-sub">{user ? TL.pricesSubDate[L](showDate(user.date)) : T.sub[L]}</p>
      {after && <p className="lp-nosub" data-testid="isale-perk"><b>{T.perkThreeStrong[L]}</b> {T.perkThree[L](PW)}</p>}
      <div className="lp-plans">
        <article className="lp-plan" data-testid="iset-one">
          <div className="lp-ph"><div><h3>{T.setOne[L]}</h3><p className="lp-tagline">{TL.oneTagline[L]}</p></div>
            <div className="lp-cardrow">{KIND_CARDS[oneKind].map((n) => <img key={n} src={arcanumImage(n, true)} alt="" />)}</div></div>
          <div className="lp-kinds">
            {(["personal", "pair", "year"] as const).map((k) => <button key={k} type="button" className={oneKind === k ? "lp-on" : undefined} onClick={() => setOneKind(k)}>{kindName[k]}</button>)}
          </div>
          <p className="lp-desc">{TL.kindDesc[L][oneKind](oneKind === "personal" ? (user ? TL.theDate[L](showDate(user.date)) : TL.yourDate[L]) : String(year))}</p>
          <p className="lp-price">{r(priceOf(oneCart))}</p>
          <p className="lp-price-sub">{after ? T.afterThreeSub[L](PW) : T.setOneSub[L]}</p>
          <a className="lp-btn lp-ghost" href="#order" onClick={(e) => { e.preventDefault(); goOrder("one", oneKind); }}>{T.choose[L]}</a>
          <Link className="lp-ex-link" href={`/matrix/individual-example/${oneKind}`}>{TL.exLabel[L][oneKind]}</Link>
        </article>
        <article className="lp-plan lp-rec" data-testid="iset-selfYear">
          <span className="lp-ribbon">{TL.ribbon[L]}</span>
          <div className="lp-ph"><div><h3>{T.setSelfYear[L](year)}</h3><p className="lp-tagline">{TL.selfYearTagline[L](year)}</p></div>
            <div className="lp-cardrow">{SELF_YEAR_CARDS.map((n) => <img key={n} src={arcanumImage(n, true)} alt="" />)}</div></div>
          <p className="lp-desc">{TL.selfYearDesc[L](year)}</p>
          <p className="lp-y2027"><RichText text={TL.yearNote[L](Boolean(user), year, `${sampleYear.centre} ${arcanumTitle(sampleYear.centre)}`, sampleYear.periods.map((n) => arcanumTitle(n)) as [string, string, string])} /></p>
          <p className="lp-price">{r(priceOf(plans.self))}</p>
          <p className="lp-price-sub">{after ? T.afterThreeSub[L](PW) : T.separately[L](r(prices.first * 2))}</p>
          <a className="lp-btn lp-gold" href="#order" onClick={(e) => { e.preventDefault(); goOrder("selfYear"); }}>{T.choose[L]}</a>
          <Link className="lp-ex-link" href="/matrix/individual-example/year">{TL.exLabel[L].year}</Link>
        </article>
        <article className="lp-plan" data-testid="iset-couple">
          <div className="lp-ph"><div><h3>{T.setCouple[L]}</h3><p className="lp-tagline">{TL.coupleTagline[L]}</p></div>
            <div className="lp-cardrow">{COUPLE_CARDS.map((n) => <img key={n} src={arcanumImage(n, true)} alt="" />)}</div></div>
          <p className="lp-desc">{TL.coupleDesc[L]}</p>
          <p className="lp-price">{r(priceOf(plans.couple))}</p>
          <p className="lp-price-sub">{after ? T.afterThreeSub[L](PW) : `${T.separately[L](r(prices.first * 3))} · ${T.coupleExtra[L](PW)}`}</p>
          <a className="lp-btn lp-ghost" href="#order" onClick={(e) => { e.preventDefault(); goOrder("couple"); }}>{T.choose[L]}</a>
          <Link className="lp-ex-link" href="/matrix/individual-example/pair">{TL.exLabel[L].pair}</Link>
        </article>
      </div>
      <div className="lp-builder" data-testid="ibuilder">
        <div className="lp-b-copy">
          <p className="lp-kicker">{TL.builderKicker[L]}</p>
          <h3>{TL.builderTitle[L]}</h3>
          <p>{T.builderText[L](PW)}</p>
        </div>
        <div className="lp-b-box">
          <Steppers cart={custom} setCart={setCustom} year={year} p="lp" />
          <Ladder count={quote(custom, 0, prices).count} bought={terms.bought} prices={prices} p="lp" />
          <div className="lp-b-total">
            <p data-testid="ib-total"><b>{r(q.total)}</b> · {T.readings[L](q.count)}{q.perReading ? <> · {TL.each[L](r(q.perReading))}</> : null}{q.separately ? <s>{r(q.separately)}</s> : null}</p>
            <a className="lp-btn lp-gold" href="#order" onClick={(e) => { e.preventDefault(); goOrder("custom"); }}>{T.checkout[L]}</a>
          </div>
        </div>
      </div>
      <div className="lp-plan-foot">
        <p className="lp-nosub"><RichText text={TL.noSub[L]} /></p>
      </div>
      {!terms.payable && <p className="lp-nosub" data-testid="isale-region">{D.pay.regionUnavailable[L]}</p>}
    </div>
  </section>
  );
}
