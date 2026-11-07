"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { arcanumImage } from "@/components/matrix/ArcanumCard";
import { useIndividualTerms } from "@/components/pay/individualTerms";
import { useLocale } from "@/components/ui/LocaleProvider";
import Link from "@/components/ui/LocalizedLink";
import RichText from "@/components/ui/RichText";
import { D, forLocale as localizedI18n } from "@/lib/i18n";
import type { LandingData } from "@/lib/individualLanding";
import { lettersOf, linksOf } from "@/lib/individualLinks";
import { rub } from "@/lib/individualMoney";
import { EMPTY_CART, KIND_CARDS, workdaysFrom, type Cart } from "@/lib/individualPricing";
import { calculate } from "@/lib/matrix";
import type { PaymentProvider } from "@/lib/tariffs";
import { browserDay } from "@/lib/today";
import { useBirth } from "@/lib/useBirth";
import { usePair } from "@/lib/usePair";
import { FindingSheet, SummarySheet, TocSheet, ToggleSheet, useMobile } from "./ExampleSheets";
import LinksMap from "./LinksMap";
import OrderSection from "./OrderSection";
import { setOf } from "./useSets";
import PricesSection from "./PricesSection";
import { pad, showDate, type Kind, type SetKey, type UserDate, type UserInfo } from "./types";

export interface IndividualLandingProps {
  data: LandingData; providers: PaymentProvider[]; serverYear: number; initialCart?: Cart | null; initialYear?: number;
}

export default function IndividualLanding({ data, providers, serverYear, initialCart, initialYear }: IndividualLandingProps) {
  const L = useLocale();
  const T = D.individualSale;
  const TL = D.individualLanding;
  const { dateLabel } = localizedI18n(L);
  const r = (n: number) => rub(n, L);
  const terms = useIndividualTerms();
  const prices = terms.prices;
  const year = initialYear || terms.defaultYear || serverYear;
  const mobile = useMobile();
  const stored = useBirth();
  const storedPair = usePair();

  const [user, setUser] = useState<UserInfo | null>(null);
  const asked = initialCart ? setOf(initialCart) : null;
  const [oneKind, setOneKind] = useState<Kind>(asked?.kind ?? "personal");
  const [set, setSet] = useState<SetKey>(asked?.set ?? "one");
  const [formKind, setFormKind] = useState<Kind>(asked?.kind ?? "personal");
  const [custom, setCustom] = useState<Cart>(initialCart ?? { ...EMPTY_CART, personal: 2 });
  const [dates, setDates] = useState<[string, string]>(["", ""]);
  useEffect(() => {
    const t = browserDay();
    setDates([dateLabel(workdaysFrom(t, 1), L), dateLabel(workdaysFrom(t, 3), L)]);
  }, [L, dateLabel]);
  const latest = dates[1];

  const onDate = useCallback((d: UserDate, links: number) => {
    const m = calculate(`${d.y}-${pad(d.m)}-${pad(d.d)}`);
    setUser({ date: d, v: lettersOf(m), totals: [m.chakra_totals.physics, m.chakra_totals.energy, m.chakra_totals.emotions], links });
  }, []);
  const userBirth = user ? { birth: `${user.date.y}-${pad(user.date.m)}-${pad(user.date.d)}`, sex: stored?.sex ?? "f" as const } : stored;

  const goOrder = (s: SetKey, kind?: Kind) => {
    setSet(s);
    if (kind) { setFormKind(kind); setOneKind(kind); }
    document.getElementById("order")?.scrollIntoView();
  };

  const [barOn, setBarOn] = useState(false);
  useEffect(() => {
    const vis = new Map<string, boolean>();
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => vis.set(e.target.id, e.isIntersecting));
      setBarOn(!["hero", "map", "prices", "order"].some((k) => vis.get(k)));
    }, { threshold: 0 });
    ["hero", "map", "prices", "order"].forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);

  const linksTotal = useMemo(() => user?.links ?? linksOf(L, data.values).length, [user, L, data.values]);
  const strengthCap = (data.findings[data.strength]?.formula?.caption ?? "").match(/\*\*(.+?)\.?\*\*/)?.[1]?.replace(/\.$/, "") ?? "";

  return (
    <div>
      <section className="lp-hero" id="hero">
        <div className="lp-wrap">
          <div>
            <h1><span className="lp-kicker">{TL.kicker[L]}</span>{" "}{TL.h1[L]}</h1>
            <p className="lp-sub">{TL.sub[L](data.sample)}</p>
            <div className="lp-btns">
              <Link className="lp-btn" href="/matrix/individual-example/personal">{TL.readExample[L]}</Link>
              <a className="lp-btn lp-ghost" href="#map">{TL.enterDate[L]}</a>
            </div>
            <p className="lp-ai-line"><span>{TL.aiLine[L]} <a href="#who">{TL.howLink[L]}</a></span></p>
            <p className="lp-meta"><RichText text={TL.meta[L](r(prices.first))} /></p>
          </div>
          <div className="lp-fan" aria-hidden="true">
            {KIND_CARDS.personal.map((n) => <img key={n} src={arcanumImage(n)} alt="" />)}
            <span>{TL.fanCaption[L]}</span>
          </div>
        </div>
      </section>

      <SummarySheet data={data} mobile={mobile} />

      <LinksMap sample={data.sample} sampleFinding={data.findings[2]?.title ?? ""} onDate={onDate} />

      <section className="lp-doc" aria-label={TL.fragments[L]}>
        <div className="lp-wrap">
          <p className="lp-skip">{TL.skipKey[L](data.chapters[1]?.page ?? 2, data.chapters[0]?.h2 ?? "")}</p>
          <FindingSheet data={data} />
          <p className="lp-skip">{TL.skipToggle[L]}</p>
          <ToggleSheet data={data} />
        </div>
      </section>

      <section className="lp-sec" id="who">
        <div className="lp-wrap">
          <h2 className="lp-sec-h">{TL.whoTitle[L]}</h2>
          <div className="lp-who-box">
            <p>{TL.whoLead[L]}</p>
            <ol className="lp-proc">{TL.proc[L].map(([h, t]) => <li key={h}><b>{h}</b>{t}</li>)}</ol>
            <p className="lp-notgpt"><RichText text={TL.notGpt[L](strengthCap)} /></p>
          </div>
          <div className="lp-cmp" role="table" aria-label={TL.cmpLabel[L]}>
            {TL.cmpHead[L].map(([h, p], i) => <div key={h} className={`lp-hd${i === 1 ? " lp-mid" : ""}`}>{h}<span>{i === 1 ? r(prices.first) : p}</span></div>)}
            {TL.cmpRows[L].flatMap(([label, a, b, c]) => [
              <div key={`${label}-l`} className="lp-rl">{label}</div>, <div key={`${label}-a`}>{a}</div>,
              <div key={`${label}-b`} className="lp-mid">{b}</div>, <div key={`${label}-c`}>{c}</div>,
            ])}
          </div>
        </div>
      </section>

      <TocSheet data={data} user={user ? { ...user, links: linksTotal } : null} mobile={mobile} />

      <PricesSection user={user} sampleBirth={data.birth} year={year} oneKind={oneKind} setOneKind={setOneKind}
        custom={custom} setCustom={setCustom} goOrder={goOrder} />

      <section className="lp-sec" id="how">
        <div className="lp-wrap">
          <h2 className="lp-sec-h">{TL.howTitle[L]}</h2>
          <div className="lp-two">
            <ol className="lp-steps">{TL.howSteps[L](latest).map(([h, t]) => <li key={h}><b>{h}</b><p>{t}</p></li>)}</ol>
            <div className="lp-box"><h3>{TL.guarTitle[L]}</h3><ul className="lp-guar">{TL.guar[L](latest).map((g) => <li key={g}><span>{g}</span></li>)}</ul></div>
          </div>
        </div>
      </section>

      <OrderSection set={set} setSet={setSet} formKind={formKind} setFormKind={setFormKind} custom={custom} setCustom={setCustom}
        year={year} providers={providers} initialBirth={userBirth} initialPair={storedPair} latest={latest} />

      <section className="lp-sec lp-faq" id="faq">
        <div className="lp-wrap" style={{ maxWidth: 820 }}>
          <h2 className="lp-sec-h">{TL.faqTitle[L]}</h2>
          <div>{T.faq[L].map(([q, a]) => <details key={q}><summary>{q}</summary><div className="lp-a"><p>{a}</p></div></details>)}</div>
        </div>
      </section>

      <div className={`lp-bar${barOn ? " lp-on" : ""}`}>
        <div className="lp-in">
          <div className="lp-t"><b>{user ? TL.barDate[L](showDate(user.date)) : TL.barSample[L]}</b>{TL.barSub[L](r(prices.first))}</div>
          <a className="lp-btn lp-gold" href="#prices">{TL.order[L]}</a>
        </div>
      </div>
    </div>
  );
}
