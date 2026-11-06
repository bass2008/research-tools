"use client";

import { useEffect, useState } from "react";
import { arcanumImage } from "@/components/matrix/ArcanumCard";
import { useLocale } from "@/components/ui/LocaleProvider";
import Link from "@/components/ui/LocalizedLink";
import RichText from "@/components/ui/RichText";
import { forLocale as arcanaForLocale } from "@/lib/arcana";
import { D } from "@/lib/i18n";
import type { Yours } from "@/lib/i18n/dict/individualLanding";
import type { LandingData, LandingFinding, SummaryItem } from "@/lib/individualLanding";
import type { Letter } from "@/lib/individualLinks";
import type { Formula } from "@/lib/individualReading";
import { fold } from "@/lib/matrix";
import { browserDay } from "@/lib/today";
import Scheme, { type SchemeFocus } from "./Scheme";
import { pad, showDate, type UserInfo } from "./types";

const MAIN_KINDS = ["key", "findings", "money", "relations", "time"];
// first day of each sign (month, day) and its card in the Golden Dawn order, Capricorn first
const SIGNS: [number, number, number][] = [[12, 22, 15], [1, 20, 17], [2, 19, 18], [3, 21, 4], [4, 20, 5], [5, 21, 6], [6, 21, 7], [7, 23, 11], [8, 23, 9], [9, 23, 8], [10, 23, 13], [11, 22, 14]];

export function useMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(max-width: 719px)");
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return mobile;
}

const pointsOf = (f: Formula) => f.items.flatMap((it) => typeof it === "string" ? [] : (it.points ?? []) as Letter[]);

/** Cards of a formula; a tap shows the card's point on the chart, a second tap brings the whole formula back. */
function FormulaCards({ f, sel, onPick, cardW = 112 }: { f: Formula; sel: number | null; onPick: (i: number) => void; cardW?: number }) {
  const L = useLocale();
  const { arcanumTitle } = arcanaForLocale(L);
  return <>
    <div className="lp-f-row" style={{ gridTemplateColumns: f.items.map((it) => typeof it === "string" ? "auto" : `minmax(0, ${cardW}px)`).join(" ") }}>
      {f.items.map((it, i) => typeof it === "string"
        ? <span key={i} className="lp-f-op">{it}</span>
        : <button key={i} type="button" className={`lp-fc${it.points?.length ? "" : " lp-off"}${sel === i ? " lp-sel" : ""}`} onClick={() => onPick(i)}>
          <span className="lp-who">{it.label}</span>
          <img src={arcanumImage(it.arcanum, true)} alt={arcanumTitle(it.arcanum)} loading="lazy" />
          <span className="lp-nm"><span className="lp-rn">{it.arcanum}</span> {arcanumTitle(it.arcanum)}</span>
        </button>)}
    </div>
    {f.caption ? <figcaption className="lp-f-cap"><RichText text={f.caption} /></figcaption> : null}
  </>;
}

function useFormula(f: Formula | null | undefined, opts: { chain?: Letter[]; closed?: boolean; cap?: string } = {}) {
  const L = useLocale();
  const TL = D.individualLanding;
  const { arcanumTitle } = arcanaForLocale(L);
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => setSel(null), [f]);
  const all = f ? pointsOf(f) : [];
  const item = f && sel !== null ? f.items[sel] : null;
  const card = item && typeof item !== "string" ? item : null;
  const keys = card?.points?.length ? card.points as Letter[] : all;
  const focus: SchemeFocus = { keys, links: keys.length > 1 ? [{ chain: opts.chain ?? keys, closed: opts.closed && keys.length > 2 }] : [] };
  const name = card ? `${card.arcanum} ${arcanumTitle(card.arcanum)}` : "";
  const cap = !card ? opts.cap ?? "" : card.points?.length ? TL.cardCap[L](card.label, name) : TL.cardOff[L](card.label, name);
  return { sel, pick: (i: number) => setSel((s) => (s === i ? null : i)), focus, cap };
}

export function SummarySheet({ data, mobile }: { data: LandingData; mobile: boolean }) {
  const L = useLocale();
  const TL = D.individualLanding;
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const it: SummaryItem = data.summary[idx];
  const focus: SchemeFocus = { keys: it.points, links: it.chains?.map((c) => ({ chain: c })) ?? (it.points.length > 1 ? [{ chain: it.points }] : []), marks: it.marks, dim: it.dim };
  const cut = data.lead.indexOf(". ") + 1;
  const box = (
    <div className="lp-mapbox" onClick={(e) => e.stopPropagation()}>
      <Scheme values={data.values} focus={focus} target={27} label={TL.schemeLabel[L]} />
      <div className="lp-legend">
        <div className="lp-thumbs">{it.cards.map((n) => <img key={n} src={arcanumImage(n, true)} alt="" />)}</div>
        <div><p>{it.legend}</p>{it.off?.length ? <div className="lp-chips">{it.off.map((o) => <span key={o} className="lp-chip">{TL.offChart[L](o)}</span>)}</div> : null}</div>
      </div>
    </div>
  );
  return (
    <section className="lp-doc" aria-label={TL.firstPage[L]}>
      <div className="lp-wrap">
        <div className="lp-frag">
          <p className="lp-note">{TL.sumNote[L]}</p>
          <article className="lp-sheet">
            <header className="lp-sheet-h"><span>{TL.sumSheet[L](data.sample)}</span><span className="lp-pg">{TL.pageOf[L](1, data.pages)}</span></header>
            <h2 className="lp-doc-title">{data.title}</h2>
            <p className="lp-doc-lead">{data.lead.slice(0, cut)}<span className="lp-dots-m"> …</span><span className="lp-more-d"> {data.lead.slice(cut)}</span></p>
            <h3 className="lp-h2">{TL.minute[L]}</h3>
            <p className="lp-inote">{TL.sumHint[L]}</p>
            <div className="lp-minute">
              <div>
                <ol className={`lp-sum${open ? " lp-open" : ""}`}>
                  {data.summary.map((s, i) => {
                    const base = s.text.search(/(Основа|Based on|Basis):/);
                    return <li key={i} tabIndex={0} className={`${i === idx ? "lp-on" : ""}${i >= 3 ? " lp-more" : ""}`}
                      onClick={() => setIdx(i)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setIdx(i); } }}>
                      {base > 0 ? <><RichText text={s.text.slice(0, base)} /><span className="lp-base"><RichText text={s.text.slice(base)} /></span></> : <RichText text={s.text} />}
                      {mobile && i === idx ? box : null}
                    </li>;
                  })}
                </ol>
                <button type="button" className="lp-sum-more" onClick={() => setOpen(true)}>{TL.sumMore[L](Math.max(0, data.summary.length - 3))}</button>
              </div>
              <div className="lp-sum-aside">{!mobile ? box : null}</div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

export function FindingSheet({ data }: { data: LandingData }) {
  const L = useLocale();
  const TL = D.individualLanding;
  const n = data.findings.length;
  const [fi, setFi] = useState(Math.min(2, n - 1));
  const [more, setMore] = useState(false);
  const f: LandingFinding = data.findings[fi];
  const { sel, pick, focus, cap } = useFormula(f.formula, { cap: TL.findCap[L] });
  const go = (i: number) => { setFi((i + n) % n); setMore(false); };
  const [first, ...rest] = f.text;
  return (
    <div className="lp-frag" id="findFrag">
      <p className="lp-note">{TL.findNote[L]}</p>
      <article className="lp-sheet">
        <header className="lp-sheet-h"><span>{TL.findSheet[L]}</span><span className="lp-pg">{TL.pageOf[L](f.page, data.pages)}</span></header>
        <div className="lp-fnav">
          <span className="lp-count">{TL.findCount[L](fi + 1, n)}</span>
          <span className="lp-arr">
            <button type="button" aria-label={TL.findPrev[L]} onClick={() => go(fi - 1)}>‹</button>
            <button type="button" aria-label={TL.findNext[L]} onClick={() => go(fi + 1)}>›</button>
          </span>
        </div>
        <div className="lp-dots">{data.findings.map((_, j) => <button key={j} type="button" className={j === fi ? "lp-on" : undefined} aria-label={TL.findDot[L](j + 1)} onClick={() => go(j)} />)}</div>
        <p className="lp-inote">{TL.findHint[L](n)}</p>
        <h3 className="lp-f-title"><span className="lp-f-num">{fi + 1}</span>{f.title}</h3>
        <div className="lp-f-body">
          {f.formula && <figure className="lp-formula"><FormulaCards f={f.formula} sel={sel} onPick={pick} /></figure>}
          <div className="lp-f-map"><Scheme values={data.values} focus={focus} target={27} label={TL.schemeLabel[L]} /><p>{cap}</p></div>
          <div className={`lp-prose${more ? " lp-open" : ""}`}>
            <p><RichText text={first} /></p>
            {rest.map((p, i) => <p key={i} className="lp-rest"><RichText text={p} /></p>)}
            {rest.length && !more ? <button type="button" className="lp-readmore" onClick={() => setMore(true)}>{TL.readFinding[L]}</button> : null}
          </div>
          {f.action && <p className="lp-todo"><b>{TL.todo[L]}</b> <RichText text={f.action} /></p>}
        </div>
      </article>
    </div>
  );
}

export function ToggleSheet({ data }: { data: LandingData }) {
  const L = useLocale();
  const TL = D.individualLanding;
  const { arcanumTitle } = arcanaForLocale(L);
  const [mode, setMode] = useState<"auto" | "ind">("ind");
  const fs = data.findings[data.strength];
  const g = data.values.G;
  const { sel, pick, focus } = useFormula(fs.formula, { chain: ["F", "G", "H", "I"], closed: true });
  return (
    <div className="lp-frag" id="toggleFrag">
      <p className="lp-note">{TL.togNote[L]}</p>
      <article className="lp-sheet">
        <header className="lp-sheet-h"><span>{TL.togSheet[L]}</span><span className="lp-pg">{TL.pageOf[L](fs.page, data.pages)}</span></header>
        <div className="lp-pt-head">
          <img src={arcanumImage(g, true)} alt={arcanumTitle(g)} />
          <div><div className="lp-who">{TL.togWhere[L]}</div><div className="lp-nm"><span className="lp-num">{g}</span> · {arcanumTitle(g)}</div></div>
          <div><Scheme values={data.values} focus={mode === "auto" ? { keys: ["G"] } : focus} target={40} label={TL.schemeLabel[L]} /></div>
        </div>
        <p className="lp-inote">{TL.togHint[L]}</p>
        <div className="lp-seg" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "auto"} className={mode === "auto" ? "lp-on" : undefined} onClick={() => setMode("auto")}>{TL.togAuto[L]}</button>
          <button type="button" role="tab" aria-selected={mode === "ind"} className={mode === "ind" ? "lp-on" : undefined} onClick={() => setMode("ind")}>{TL.togInd[L]}</button>
        </div>
        <div className={`lp-pane${mode === "auto" ? " lp-on" : ""}`}>
          <div className="lp-auto">
            <p className="lp-lbl">{TL.togAutoLabel[L]}</p>
            <h4>{D.mapPoints.mother_line[L]} — {g} {arcanumTitle(g)}</h4>
            <p>{data.autoText}</p>
            <p className="lp-also">{TL.togAlso[L]}</p>
          </div>
        </div>
        <div className={`lp-pane${mode === "ind" ? " lp-on" : ""}`}>
          <h3 className="lp-f-title" style={{ fontSize: 24 }}><span className="lp-f-num">✦</span>{fs.title}</h3>
          {fs.formula && <figure className="lp-formula" style={{ margin: "0 0 12px" }}><FormulaCards f={fs.formula} sel={sel} onPick={pick} /></figure>}
          <div className="lp-prose">{fs.text.slice(0, 2).map((p, i) => <p key={i}><RichText text={p} /></p>)}</div>
          {fs.action && <p className="lp-todo"><b>{TL.todo[L]}</b> <RichText text={fs.action} /></p>}
        </div>
        <p className="lp-after-toggle">{TL.togAfter[L]}</p>
      </article>
    </div>
  );
}

export function TocSheet({ data, user, mobile }: { data: LandingData; user: UserInfo | null; mobile: boolean }) {
  const L = useLocale();
  const TL = D.individualLanding;
  const { arcanumTitle } = arcanaForLocale(L);
  const nm = (n: number) => `${n} ${arcanumTitle(n)}`;
  const [all, setAll] = useState(false);
  const yours = (kind: string) => {
    if (!user) return "";
    const v = user.v, r = user.date, t = browserDay();
    const md = r.m * 100 + r.d;
    // the latest sign start not after the birthday; before 20 January it is still Capricorn
    let s = 0, best = -1;
    SIGNS.forEach(([m, d], i) => { const k = m * 100 + d; if (k <= md && k > best) { best = k; s = i; } });
    const age = t.year - r.y - ((t.month < r.m || (t.month === r.m && t.day < r.d)) ? 1 : 0);
    if (kind === "time" && (age < 0 || age >= 80)) return "";
    const ring = [v.A, v.F, v.B, v.G, v.C, v.H, v.D, v.I], decade = Math.floor(age / 10) * 10;
    const cnt = new Map<number, number>();
    (Object.values(v) as number[]).forEach((n) => cnt.set(n, (cnt.get(n) ?? 0) + 1));
    const frequent = [...cnt.entries()].filter(([, c]) => c > 1).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([n, c]) => `${arcanumTitle(n)} ×${c}`).join(", ");
    const line = (TL.yoursFor[L] as Record<string, (y: Yours) => string>)[kind];
    return line ? line({ nm, v, ct: user.totals, links: user.links, family: fold(v.F + v.G + v.H + v.I), karma: fold(v.C + v.L),
      sign: TL.signs[L][s], signCard: SIGNS[s][2], age, decade, decadeCard: ring[decade / 10] ?? 0, frequent }) : "";
  };
  const hidden = data.chapters.filter((c) => !MAIN_KINDS.includes(c.kind)).map((c) => c.label.charAt(0).toLowerCase() + c.label.slice(1));
  const n = data.chapters.length;
  return (
    <section className="lp-doc" aria-label={TL.tocSheet[L]}>
      <div className="lp-wrap">
        <div className="lp-frag" id="toc" style={{ marginTop: 30 }}>
          <p className="lp-note">{TL.tocNote[L]}</p>
          <article className="lp-sheet lp-toc-sheet">
            <header className="lp-sheet-h"><span>{TL.tocSheet[L]}</span><span className="lp-pg">{TL.pages[L](data.pages)}</span></header>
            <h2 className="lp-h2">{TL.tocTitle[L]} <span className="lp-num">{n}</span> {TL.chapters[L](n)}</h2>
            <p className="lp-toc-sub">{user ? TL.tocSubDate[L](showDate(user.date)) : TL.tocSub[L]}</p>
            <div className={`lp-toc${all ? " lp-all" : ""}`}>
              {data.chapters.map((c, i) => {
                const sub = c.h2.startsWith(c.label) ? c.h2.slice(c.label.length).replace(/^[:\s]+/, "") : c.h2;
                const y = yours(c.kind);
                const ex = c.extra ?? {};
                return <details key={c.kind} open={i === 0 && !mobile} className={MAIN_KINDS.includes(c.kind) ? undefined : "lp-extra"}>
                  <summary>
                    <span className="lp-tn">{pad(i + 1)}</span>
                    <span className="lp-tt"><span>{c.label}</span>{sub ? <small>{sub}</small> : null}{y ? <em className="lp-yours">{TL.yours[L](y)}</em> : null}</span>
                    <span className="lp-tp">{TL.page[L](c.page)}</span><span className="lp-tx">+</span>
                  </summary>
                  <div className="lp-tb">
                    <p className="lp-concl"><RichText text={c.conclusion} /></p>
                    {c.cards.length > 0 && <div className="lp-cards">{c.cards.map((x, j) => <figure key={j}><img src={arcanumImage(x.n, true)} alt={arcanumTitle(x.n)} loading="lazy" /><figcaption>{x.label}</figcaption></figure>)}</div>}
                    {ex.list && <ol className="lp-flist">{ex.list.map((t) => <li key={t}>{t}</li>)}</ol>}
                    {ex.groups?.map((g) => <div key={g.h} className="lp-grp"><h5>{g.h}</h5><ul>{g.items.map((t, j) => <li key={j}><RichText text={t} /></li>)}</ul></div>)}
                    {ex.timeline && <ul className="lp-tl">{ex.timeline.map((t, j) => <li key={j} className={t.now ? "lp-now" : undefined}><span className="lp-age">{t.age}</span><img src={arcanumImage(t.arcanum, true)} alt="" loading="lazy" /><span>{t.title}{t.now ? <> · <b style={{ color: "var(--gold2)" }}>{TL.hereYou[L]}</b></> : null}</span></li>)}</ul>}
                    {ex.scene && <p className="lp-act"><RichText text={ex.scene} /></p>}
                    {c.action && !ex.groups && <p className="lp-act"><b>{TL.todo[L]}</b> <RichText text={c.action} /></p>}
                  </div>
                </details>;
              })}
              <details className="lp-extra">
                <summary><span className="lp-tn">✦</span><span className="lp-tt"><span>{TL.tocFaq[L]}</span><small>{TL.tocFaqSub[L](data.faq.length)}</small></span><span className="lp-tp">{TL.page[L](data.faqPage)}</span><span className="lp-tx">+</span></summary>
                <div className="lp-tb"><ul className="lp-flist">{data.faq.map((q) => <li key={q}>{q}</li>)}</ul></div>
              </details>
            </div>
            {!all && <button type="button" className="lp-toc-all" onClick={() => setAll(true)}>{TL.tocAll[L](n)}<small>{TL.tocAllMore[L](hidden.join(", "))}</small></button>}
            <div className="lp-toc-cta">
              <Link className="lp-btn" href="/matrix/individual-example/personal">{TL.readExample[L]}</Link>
              <p>{TL.tocCta[L]} <Link href="/matrix/individual-example/pair">{TL.exPairLink[L]}</Link> {TL.and[L]} <Link href="/matrix/individual-example/year">{TL.exYearLink[L]}</Link>.</p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
