"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { arcanumImage } from "@/components/matrix/ArcanumCard";
import { Ladder, Steppers } from "@/components/pay/IndividualBuilder";
import { useLocale } from "@/components/ui/LocaleProvider";
import RichText from "@/components/ui/RichText";
import { track } from "@/lib/analytics";
import { D } from "@/lib/i18n";
import { EMPTY_CART, KIND_CARDS, SETS, quote, type Cart } from "@/lib/individualPricing";
import type { StoredBirth } from "@/lib/storage";
import type { PaymentProvider } from "@/lib/tariffs";
import OrderForm from "./OrderForm";
import type { Kind, SetKey } from "./types";
import { useSets } from "./useSets";

/** The order on the landing: which set, the form with the people of every reading, the order card beside it. */
export default function OrderSection({ set, setSet, formKind, setFormKind, custom, setCustom, year, providers, initialBirth, latest }: {
  set: SetKey; setSet: (s: SetKey) => void; formKind: Kind; setFormKind: (k: Kind) => void; custom: Cart; setCustom: (c: Cart) => void;
  year: number; providers: PaymentProvider[]; initialBirth: StoredBirth | null; latest: string;
}) {
  const L = useLocale();
  const T = D.individualSale;
  const TL = D.individualLanding;
  const { terms, prices, PW, r, priceOf, plans, kindName } = useSets();
  const [question, setQuestion] = useState("");
  const [topic, setTopic] = useState<number | null>(null);
  const [orderDates, setOrderDates] = useState<string[]>([]);
  const [orderYears, setOrderYears] = useState<number[]>([]);
  const shownYear = orderYears[0] ?? year;
  const cart: Cart = useMemo(() => set === "custom" ? custom
    : set === "one" ? { ...EMPTY_CART, [formKind]: 1 } : SETS[set === "selfYear" ? "selfYear" : "couple"]("personal"), [set, custom, formKind]);
  const oneKind = formKind === "year" ? T.kindYear[L](shownYear) : kindName[formKind];
  const setTitle = set === "one" ? `${T.setOne[L]} · ${oneKind.toLowerCase()}` : set === "selfYear" ? T.setSelfYear[L](shownYear)
    : set === "couple" ? T.setCouple[L] : `${TL.optCustom[L]} · ${T.readings[L](quote(custom, 0, prices).count)}`;
  const total = r(priceOf(cart));
  const byDates = orderDates.length ? TL.byDate[L](orderDates.join(", ")) : "";
  const topics = TL.topics[L];
  // a question only suggests its set: the order changes on an explicit choice, so the form does not jump under the finger
  const suggested = topic === null ? null : { s: topics[topic][2] as SetKey, k: (topics[topic][3] || undefined) as Kind | undefined };
  const fits = suggested && (suggested.s !== set || (suggested.k && suggested.k !== formKind)) ? suggested : null;
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const seen = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      track("individual_order_view");
      seen.disconnect();
    }, { threshold: 0.2 });
    seen.observe(el);
    return () => seen.disconnect();
  }, []);
  return (
  <section className="lp-order-sec" id="order" ref={sectionRef}>
    <div className="lp-wrap">
      <h2 className="lp-sec-h">{TL.orderTitle[L]}</h2>
      <div className="lp-order-grid">
        <div className="lp-form">
          <div className="lp-fl">
            <span>{TL.orderWhat[L]}</span>
            <div className="lp-opts">
              {([["one", T.setOne[L], TL.optOneSub[L](year), priceOf({ ...EMPTY_CART, [formKind]: 1 })],
                ["selfYear", T.setSelfYear[L](year), TL.selfYearTagline[L](year).toLowerCase(), priceOf(plans.self)],
                ["couple", T.setCouple[L], TL.coupleTagline[L].toLowerCase(), priceOf(plans.couple)],
                ["custom", TL.optCustom[L], TL.optCustomSub[L](PW.next), priceOf(custom)]] as [SetKey, string, string, number][]).map(([k, h, s, p]) => (
                <label key={k} className="lp-opt"><input type="radio" name="lp-set" value={k} checked={set === k} onChange={() => setSet(k)} />
                  <span><b>{h}</b><small>{s}</small></span><span className="lp-p">{r(p)}</span></label>
              ))}
            </div>
          </div>
          {set === "one" && <div className="lp-fl">
            <span>{TL.whichKind[L]}</span>
            <div className="lp-kinds">{(["personal", "pair", "year"] as const).map((k) => <button key={k} type="button" className={formKind === k ? "lp-on" : undefined} onClick={() => setFormKind(k)}>{kindName[k]}</button>)}</div>
          </div>}
          {set === "custom" && <div className="lp-fl">
            <span>{TL.buildSet[L]}</span>
            <Steppers cart={custom} setCart={setCustom} p="lp" />
            <Ladder count={quote(custom, 0, prices).count} bought={terms.bought} prices={prices} p="lp" />
          </div>}
          <OrderForm cart={cart} baseYear={year} total={total} providers={providers} payable={terms.payable} initialBirth={initialBirth}
            question={question} setQuestion={setQuestion} latest={latest} onDates={setOrderDates} onYears={setOrderYears}
            summary={`**${setTitle}**${byDates ? ` · ${byDates}` : ""} · ${TL.summaryWhen[L](latest)}`}
            topics={<>
              <div className="lp-topics">{topics.map(([label, text, s, k], i) => (
                <button key={label} type="button" className={topic === i ? "lp-on" : undefined} aria-pressed={topic === i} onClick={() => {
                  const ours = !question.trim() || (topic !== null && question === topics[topic][1]);
                  if (topic === i) {
                    if (question === text) setQuestion("");
                    setTopic(null);
                    return;
                  }
                  if (ours) setQuestion(text);
                  setTopic(i);
                }}>{label}</button>
              ))}</div>
              {fits && <p className="lp-topic-note">{TL.topicNote[L](fits.s === "one"
                ? `${T.setOne[L]}${fits.k ? ` · ${kindName[fits.k].toLowerCase()}` : ""}`
                : fits.s === "selfYear" ? T.setSelfYear[L](year) : T.setCouple[L])}{" "}
                <button type="button" onClick={() => { setSet(fits.s); if (fits.k) setFormKind(fits.k); }}>{TL.topicChoose[L]}</button></p>}
            </>} />
        </div>
        <aside className="lp-summary-card">
          <div className="lp-sc-fan">{KIND_CARDS.personal.map((n) => <img key={n} src={arcanumImage(n, true)} alt="" />)}</div>
          <h3>{setTitle}</h3>
          <p className="lp-sc-date">{byDates ? byDates.charAt(0).toUpperCase() + byDates.slice(1) : TL.noDate[L]}</p>
          <p className="lp-price" style={{ margin: "0 0 14px" }}>{total}</p>
          <ul className="lp-guar">{TL.scGuar[L](latest).map((g) => <li key={g}><span><RichText text={g} /></span></li>)}</ul>
          <p className="lp-fine" style={{ marginTop: 12 }}>{TL.aiLine[L]}</p>
        </aside>
      </div>
    </div>
  </section>
  );
}
