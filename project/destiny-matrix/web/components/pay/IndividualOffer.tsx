"use client";

import { useEffect, useState } from "react";
import OrderSection from "@/components/individual/landing/OrderSection";
import type { Kind, SetKey } from "@/components/individual/landing/types";
import { setOf } from "@/components/individual/landing/useSets";
import { useIndividualTerms } from "@/components/pay/individualTerms";
import { useLocale } from "@/components/ui/LocaleProvider";
import Link from "@/components/ui/LocalizedLink";
import { track } from "@/lib/analytics";
import { D, forLocale as localizedI18n } from "@/lib/i18n";
import { Ladder, Steppers } from "@/components/pay/IndividualBuilder";
import RichText from "@/components/ui/RichText";
import { arcanumImage } from "@/components/matrix/ArcanumCard";
import { forLocale as arcanaForLocale } from "@/lib/arcana";
import {
  COUPLE_CARDS, EMPTY_CART, KIND_CARDS, SELF_YEAR_CARDS, SETS, quote, workdaysFrom, type Cart,
} from "@/lib/individualPricing";
import { SAMPLE_BIRTH } from "@/lib/individualSample";
import { useBirth } from "@/lib/useBirth";
import { usePair } from "@/lib/usePair";
import { yearMatrix } from "@/lib/yearMatrix";
import { priceWords, rub } from "@/lib/individualMoney";
import { browserDay } from "@/lib/today";
import type { Lang } from "@/lib/i18n/hosts";
import type { PaymentProvider } from "@/lib/tariffs";

const Cards = ({ ns }: { ns: number[] }) => <div className="pw-cardrow">{ns.map((n) => <img key={n} src={arcanumImage(n, true)} alt="" />)}</div>;

/** Gold section of /pay: ready sets, the builder and the perk for those who bought three (reports/individual-sales, paywall.html). */
export default function IndividualOffer({ providers, initialCart, initialYear }: {
  providers: PaymentProvider[]; initialCart?: Cart | null; initialYear?: number;
}) {
  const L = useLocale();
  const { dateLabel } = localizedI18n(L);
  const T = D.individualSale;
  const TL = D.individualLanding;
  const r = (n: number) => rub(n, L as Lang);
  const terms = useIndividualTerms();
  const P = priceWords(terms.prices, L);
  const { arcanumTitle } = arcanaForLocale(L);
  const stored = useBirth();
  const storedPair = usePair();
  const year = initialYear || terms.defaultYear;
  const asked = initialCart ? setOf(initialCart) : null;
  const [oneKind, setOneKind] = useState<Kind>(asked?.kind ?? "personal");
  const [custom, setCustom] = useState<Cart>(initialCart ?? { ...EMPTY_CART, personal: 2 });
  // the order form of the landing, opened here by the chosen set (docs/individual-reading.md)
  const [open, setOpen] = useState(Boolean(asked));
  const [set, setSet] = useState<SetKey>(asked?.set ?? "one");
  const [formKind, setFormKind] = useState<Kind>(asked?.kind ?? "personal");
  const [latest, setLatest] = useState("");
  useEffect(() => { setLatest(dateLabel(workdaysFrom(browserDay(), 3), L)); }, [L, dateLabel]);
  const choose = (s: SetKey, place: string, kind?: Kind) => (e: React.MouseEvent) => {
    e.preventDefault();
    track("individual_set", { place });
    setSet(s);
    if (kind) setFormKind(kind);
    setOpen(true);
    requestAnimationFrame(() => document.getElementById("order")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const after = terms.bought >= 3;
  const price = (c: Cart) => quote(c, terms.bought, terms.prices).total;
  const oneCart = { ...EMPTY_CART, [oneKind]: 1 };
  const self = SETS.selfYear("personal"), couple = SETS.couple("personal");
  const kindName: Record<Kind, string> = { personal: T.kindPersonal[L], pair: T.kindPair[L], year: T.kindAnyYear[L] };
  const birth = stored?.birth ?? SAMPLE_BIRTH;
  const [by, bm, bd] = birth.split("-").map(Number);
  const y = year ? yearMatrix({ y: by, m: bm, d: bd }, year) : null;
  const q = quote(custom, terms.bought, terms.prices);
  return (
    <section className="theme-gold isale" aria-label={T.goldCapLeft[L]} data-testid="individual-offer">
      <p className="isale-divider">{T.goldDivider[L]}</p>
      <div className="pw-gsec">
        <div className="pw-gcap">{T.goldCapLeft[L]} <span>{T.goldCapRight[L]}</span></div>
        <div className="pw-gin">
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
              <a className="pw-ibtn pw-ghost" href="#order" onClick={choose("one", `one-${oneKind}`, oneKind)}>{T.choose[L]}</a>
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
              <a className="pw-ibtn pw-gold" href="#order" onClick={choose("selfYear", "self-year")}>{T.choose[L]}</a>
              <Link className="pw-ex-link" href="/matrix/individual-example/year">{TL.exLabel[L].year}</Link>
            </article>
            <article className="pw-iplan" data-testid="iset-couple">
              <div className="pw-ph"><div><h3>{T.setCouple[L]}</h3><p className="pw-tagline">{TL.coupleTagline[L]}</p></div><Cards ns={COUPLE_CARDS} /></div>
              <p className="pw-desc">{TL.coupleDesc[L]}</p>
              <p className="pw-iprice">{r(price(couple))}</p>
              <p className="pw-iprice-sub">{after ? T.afterThreeSub[L](P) : `${T.separately[L](r(terms.prices.first * 3))} · ${T.coupleExtra[L](P)}`}</p>
              <a className="pw-ibtn pw-ghost" href="#order" onClick={choose("couple", "couple")}>{T.choose[L]}</a>
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
              <Steppers cart={custom} setCart={setCustom} p="pw" />
              <Ladder count={quote(custom, 0, terms.prices).count} bought={terms.bought} prices={terms.prices} p="pw" />
              <div className="pw-b-total">
                <p data-testid="ib-total"><b>{r(q.total)}</b> · {T.readings[L](q.count)}{q.perReading ? <> · {TL.each[L](r(q.perReading))}</> : null}{q.separately ? <s>{r(q.separately)}</s> : null}</p>
                <a className="pw-ibtn pw-gold" href="#order" onClick={choose("custom", "builder")}>{T.checkout[L]}</a>
              </div>
            </div>
          </div>
          <p className="pw-nosub"><RichText text={T.terms[L]} /></p>
          {!terms.payable && <p className="isale-region" data-testid="isale-region">{D.pay.regionUnavailable[L]}</p>}
        </div>
      </div>
      {open && <div className="ilp isale-order">
        <OrderSection set={set} setSet={setSet} formKind={formKind} setFormKind={setFormKind} custom={custom} setCustom={setCustom}
          year={year} providers={providers} initialBirth={stored} initialPair={storedPair} latest={latest} />
      </div>}
    </section>
  );
}
