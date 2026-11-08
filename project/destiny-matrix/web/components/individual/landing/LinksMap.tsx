"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { arcanumImage } from "@/components/matrix/ArcanumCard";
import { useLocale } from "@/components/ui/LocaleProvider";
import Link from "@/components/ui/LocalizedLink";
import RichText from "@/components/ui/RichText";
import { track, type Goal, type GoalParams } from "@/lib/analytics";
import { forLocale as arcanaForLocale } from "@/lib/arcana";
import { D } from "@/lib/i18n";
import { COLORS, cap, linksOf, personalModel, valuesOf, type Link as MatrixLink, type LinksModel } from "@/lib/individualLinks";
import { pairModel } from "@/lib/pairLinks";
import type { YearLinksModel } from "@/lib/yearLinks";
import { browserDay } from "@/lib/today";
import { CX, OUTLINE, POINT, R_IN, R_OUT, at, f1, poly, xy, type Size } from "./geometry";
import { routePath, type Pos } from "./routes";
import { Frame, SIZE, YearFrame } from "./schemeParts";
import { R_WHEEL, THIRD_EDGES, THIRDS, yearAt, yearSize } from "./yearGeometry";
import { showDate as show } from "./types";

type Day = { y: number; m: number; d: number };
type Model = LinksModel & Partial<Pick<YearLinksModel, "frame" | "wheel" | "accent" | "example" | "sampleNext" | "moreTitle">>;

const EXAMPLE = "/matrix/individual-example/personal";
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function isoDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

function parseDate(s: string) {
  const digits = s.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  const d = Number(digits.slice(0, 2)), m = Number(digits.slice(2, 4)), y = Number(digits.slice(4));
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d || y < 1900) return null;
  const t = browserDay();
  if (dt.getTime() > Date.UTC(t.year, t.month - 1, t.day)) return null;
  return { y, m, d };
}

/** "Your matrix has links you cannot see point by point": the visitor's date, its links and one rule of the corpus.
 *  With `date` (the report) or `pair` (the couple) the chart is known: no form, and it draws itself once it is on screen. */
export default function LinksMap({ sample = "", sampleFinding = "", onDate, date: fixedDate, pair, cta, endCta, id = "map", palette, place: goalPlace = "report",
  build, formExtra, compact = false, submitLabel, dateGoal = "individual_date", goalParams, autoGoal = true, titleTag: Title = "h2" }: {
  sample?: string; sampleFinding?: string; onDate?: (date: Day, links: number) => void;
  date?: Day; cta?: ReactNode; endCta?: ReactNode; id?: string; palette?: readonly string[];
  pair?: { a: string; b: string; names: { a: string; b: string } }; place?: string;
  // another chart for the same block (the year): the form stays, the list starts folded like under a reading
  build?: (date: Day) => Model; formExtra?: ReactNode; compact?: boolean; submitLabel?: string; dateGoal?: Goal; goalParams?: GoalParams;
  // above the page h1 (year pages) the block title must not be a heading
  titleTag?: "h2" | "p";
  // Metrika counts every <form> submit as its own auto-goal; without it the date is sent by the button and Enter only
  autoGoal?: boolean;
}) {
  const L = useLocale();
  const T = D.individualLinks;
  const { arcanumTitle } = arcanaForLocale(L);
  const known = Boolean(fixedDate || pair);
  const folded = known || compact;
  // the landing keeps its old field id: tests and the anchor of the form point at it
  const field = id === "map" ? "lm-bd" : `${id}-bd`;
  const [input, setInput] = useState(sample);
  const [date, setDate] = useState(() => fixedDate ?? (pair ? isoDate(pair.a) : parseDate(sample)!));
  const [own, setOwn] = useState(known);
  const [err, setErr] = useState(false);
  const [open, setOpen] = useState(0);
  const [focused, setFocused] = useState<number | null>(null);
  const [tip, setTip] = useState<{ lines: string[]; left: number; top: number } | null>(null);
  const [run, setRun] = useState(0);
  const [more, setMore] = useState(!folded);
  const dateReported = useRef(false);
  const pa = pair?.a, pb = pair?.b, na = pair?.names.a, nb = pair?.names.b;
  const M: Model = useMemo(() => build ? build(date) : pa && pb ? pairModel(L, pa, pb, { a: na ?? "", b: nb ?? "" }) : personalModel(L, valuesOf(date.y, date.m, date.d)),
    [L, date, pa, pb, na, nb, build]);
  const { values, links } = M;
  const year = M.frame === "year";
  const pos: Pos = year ? yearAt : at;
  const sizeOf = (k: string): Size => year ? yearSize(k) : POINT[k as keyof typeof POINT].size;
  // a new year redraws the same date: start again from the first link
  const built = useRef(build);
  useEffect(() => {
    if (built.current === build) return;
    built.current = build;
    setOpen(0); setFocused(null); setRun((r) => r + 1);
  }, [build]);
  const focusI = focused !== null && focused < links.length ? focused : null;
  const by = useMemo(() => { const o: Record<string, number> = {}; links.forEach((c, i) => c.keys.forEach((k) => { o[k] = i; })); return o; }, [links]);
  const mapRef = useRef<HTMLDivElement>(null);
  const paint = (c: MatrixLink<string>) => palette?.[COLORS.indexOf(c.color)] ?? c.color;
  const wrapRef = useRef<HTMLDivElement>(null);
  const stRefs = useRef<(HTMLLIElement | null)[]>([]);
  const jumpTo = useRef<number | null>(null);

  // the link closed above took its text with it: bring the one just opened to the top
  useIsoLayoutEffect(() => {
    const el = jumpTo.current === null ? null : stRefs.current[jumpTo.current];
    jumpTo.current = null;
    if (!el) return;
    const bars = [...document.querySelectorAll<HTMLElement>(".site-header, .ix-top")].map((h) => h.getBoundingClientRect())
      .filter((r) => r.height && r.top < 160);
    window.scrollBy({ top: el.getBoundingClientRect().top - Math.max(0, ...bars.map((r) => r.bottom)) - 12, behavior: "instant" });
  }, [open]);

  const waiting = known && run === 0;
  useEffect(() => {
    const el = mapRef.current;
    if (!known || !el) return;
    const seen = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      setRun((r) => r + 1);
      seen.disconnect();
    }, { threshold: 0.3 });
    seen.observe(el);
    return () => seen.disconnect();
  }, [known]);

  // the numbers flip in and the links draw themselves after every new date
  useIsoLayoutEffect(() => {
    if (waiting || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const svg = mapRef.current?.querySelector("svg");
    if (!svg) return;
    svg.querySelectorAll<SVGTextElement>(".lm-node text").forEach((t, j) => { t.parentElement?.classList.add("lm-flip"); t.style.animationDelay = `${j * 25}ms`; });
    svg.querySelectorAll<SVGPathElement>(".lm-route").forEach((p, j) => {
      const len = p.getTotalLength();
      p.style.transition = "none";
      p.style.strokeDasharray = String(len); p.style.strokeDashoffset = String(len);
      p.getBoundingClientRect();
      p.style.transition = `stroke-dashoffset .9s cubic-bezier(.5,0,.2,1) ${500 + j * 260}ms, opacity .35s, stroke-width .35s`;
      p.style.strokeDashoffset = "0";
    });
  }, [run, waiting]);

  const submit = (e?: { preventDefault(): void }) => {
    e?.preventDefault();
    const p = parseDate(input);
    if (!p) { setErr(true); return; }
    setErr(false);
    const mine = own || show(p) !== sample;
    setOwn(mine);
    setDate(p);
    setOpen(0);
    setFocused(null);
    setRun((r) => r + 1);
    if (mine && onDate) {
      onDate(p, build ? build(p).links.length : linksOf(L, valuesOf(p.y, p.m, p.d)).length);
      if (!dateReported.current) track(dateGoal, goalParams);
      dateReported.current = true;
    }
    if (innerWidth < 1000) mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const tipFor = (k: string, el: Element) => {
    const val = values[k], i = by[k];
    const r = el.getBoundingClientRect(), w = wrapRef.current!.getBoundingClientRect();
    setTip({
      lines: [`**${val} · ${arcanumTitle(val)}**`, `${cap(M.role(k))} — ${M.place(k)}`, ...(i === undefined ? [] : [`${T.inLink[L]} ${M.formula(links[i])}`])],
      left: Math.min(Math.max(r.left + r.width / 2 - w.left, 110), w.width - 110), top: r.top - w.top - 6,
    });
  };

  const svg = (mini: boolean, list: MatrixLink<string>[]) => {
    const owner: Record<string, number> = {};
    list.forEach((c, i) => c.keys.forEach((k) => { owner[k] = i; }));
    const node = (k: string) => {
      const [x, y] = pos(k), i = owner[k], lit = i !== undefined, size = sizeOf(k), [r, fs] = SIZE[size];
      if (mini) return <circle key={k} cx={f1(x)} cy={f1(y)} r={lit ? r * 0.9 : 7} fill={lit ? paint(list[i]) : "#2b4366"} />;
      return <g key={k} className={`lm-node lm-${size}${lit ? " lm-on" : ""}${lit && i === focusI ? " lm-f" : ""}`} tabIndex={0}
        onMouseEnter={(e) => tipFor(k, e.currentTarget)} onMouseLeave={() => setTip(null)}
        onClick={(e) => { tipFor(k, e.currentTarget); if (lit) setOpen(i); setFocused(lit ? i : null); }}>
        <circle className="lm-halo" cx={f1(x)} cy={f1(y)} r={r + 5} stroke={lit ? paint(list[i]) : "none"} />
        <circle className="lm-b" cx={f1(x)} cy={f1(y)} r={r} />
        <text x={f1(x)} y={f1(y + 1)} fontSize={fs}>{values[k]}</text>
      </g>;
    };
    return <svg className={`lm-oct${mini ? " lm-m" : ""}${!mini && focusI !== null ? " lm-focus" : ""}${!mini && waiting ? " lm-wait" : ""}`} viewBox={mini ? "28 28 564 564" : "8 8 604 604"} role="img" aria-label={M.copy.chart}>
      {year ? <YearFrame mini={mini} wheel={M.wheel ?? []} /> : <Frame mini={mini} sky={M.copy.sky} earth={M.copy.earth} ages={M.ages} />}
      <g className="lm-routes">{list.map((c, i) => <path key={i} className={`lm-route${!mini && i === focusI ? " lm-f" : ""}`} d={routePath(c.keys, pos)} stroke={paint(c)} />)}</g>
      <g className="lm-nodes">{M.nodes.map(node)}</g>
    </svg>;
  };

  const n = links.length;
  return (
    <section id={id} className="lm-host" aria-label={M.copy.section}>
      <div className="lm-night">
        <div className={`lm-wrap lm-hero${folded && !more ? " lm-short" : ""}`}>
          <div className="lm-hero-copy">
            <div className="lm-kicker">{M.copy.kicker}</div>
            <Title className="lm-h1">{M.copy.title}<em>{M.accent ?? T.titleAccent[L]}</em></Title>
            <p className="lm-sub">{M.copy.sub}</p>
            {!known && (() => {
              const fields = <>
                {formExtra}
                <label htmlFor={field}>{T.dateLabel[L]}</label>
                <input id={field} inputMode="numeric" enterKeyHint="go" autoComplete="off" placeholder={T.placeholder[L]} value={input} maxLength={10} aria-describedby={`${field}-note`}
                  onKeyDown={autoGoal ? undefined : (e) => { if (e.key === "Enter") submit(e); }}
                  onChange={(e) => {
                    const dgt = e.target.value.replace(/\D/g, "").slice(0, 8);
                    setInput(dgt.slice(0, 2) + (dgt.length > 2 ? "." + dgt.slice(2, 4) : "") + (dgt.length > 4 ? "." + dgt.slice(4) : ""));
                  }} />
                <button className="lm-btn lm-btn-gold" type={autoGoal ? "submit" : "button"} onClick={autoGoal ? undefined : () => submit()}>{submitLabel ?? T.showLinks[L]}</button>
                <div className={`lm-dnote${err ? " lm-err" : ""}`} id={`${field}-note`}>{err ? T.badDate[L] : own ? T.ownNote[L] : T.sampleNote[L]}</div>
              </>;
              return autoGoal
                ? <form className="lm-dform" autoComplete="off" onSubmit={submit}>{fields}</form>
                : <div className="lm-dform" role="group" aria-label={T.dateLabel[L]}>{fields}</div>;
            })()}
          </div>

          <div className="lm-hero-map">
            <div className="lm-map-sticky" ref={wrapRef}>
              <div ref={mapRef}>{svg(false, links)}</div>
              <div className={`lm-tip${tip ? " lm-show" : ""}`} style={tip ? { left: tip.left, top: tip.top } : undefined}>
                {tip?.lines.map((line, i) => i === 0 ? <RichText key={i} text={line} /> : <span key={i}><br />{line}</span>)}
              </div>
              <div className="lm-map-cap">
                <span><b>{M.caption?.[0] ?? show(date)}</b> · {M.caption?.[1] || (own ? T.ownDate[L] : T.sampleDate[L])}</span>
                <span className="lm-legend"><span><i />{T.legendLink[L]}</span><span><s />{T.legendPoint[L]}</span></span>
              </div>
            </div>
          </div>

          {folded && <div className="lm-hero-btns lm-btns lm-fixed-btns">
            {links.length > 0 && <button className="lm-btn lm-btn-ghost" type="button" aria-expanded={more} data-testid="links-more"
              onClick={() => { if (!more) track("individual_report_more", { place: goalPlace }); setMore(!more); }}>
              {more ? T.hideAll[L] : T.showAll[L](links.length)}
            </button>}
            {cta}
          </div>}

          {more && n > 0 && <div className="lm-hero-rest">
            <div className="lm-count">
              <div className="lm-num">{n}</div>
              <h3 className="lm-count-h">{M.countTitle(n, own)}</h3>
              <p><RichText text={M.countSub()} /></p>
            </div>
            <ol className="lm-stations">
              {links.map((c, i) => {
                const shown = c.k > 3 ? 2 : c.k;
                const isOpen = i === open;
                return <li key={`${c.n}-${i}`} ref={(el) => { stRefs.current[i] = el; }} className={`lm-st${isOpen ? " lm-open" : ""}`} style={{ ["--c" as string]: paint(c) }}>
                  <button className="lm-st-head" type="button" aria-expanded={isOpen} onClick={() => {
                    if (!isOpen && open >= 0) jumpTo.current = i;
                    setOpen(isOpen ? -1 : i); setFocused(isOpen ? null : i);
                  }}>
                    <span className="lm-st-bar" /><span className="lm-st-f">{M.formula(c)}</span>
                    <span><span className="lm-st-t">{M.riddle(c)}</span>
                      <span className="lm-st-m"><span>{arcanumTitle(c.n)}</span><span className="lm-rare">{M.rarity(c.p)}</span>
                        {c.p < 0.01 ? <span className="lm-tag lm-rare-t">{T.rare[L]}</span> : c.p >= 0.1 ? <span className="lm-tag lm-freq-t">{T.common[L]}</span> : null}
                        {c.free ? <span className="lm-badge lm-free">{T.open[L]}</span> : <span className="lm-badge lm-lock">{T.inReading[L]}</span>}
                      </span>
                    </span>
                    <span className="lm-st-ch"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                  </button>
                  <div className="lm-st-body"><div className="lm-st-grid">
                    <div className="lm-fx">
                      {c.keys.slice(0, shown).map((k, j) => <span key={k} style={{ display: "contents" }}>
                        {j ? <span className="lm-fop">{c.k === 2 && c.sym.length ? "↔" : "="}</span> : null}
                        <figure className="lm-fc"><img src={arcanumImage(c.n, true)} alt={arcanumTitle(c.n)} loading="lazy" /><figcaption>{cap(M.role(k))}</figcaption></figure>
                      </span>)}
                      {c.k > 3 && <><span className="lm-fop">=</span><span className="lm-fmore">{T.morePoints[L](c.k - shown)}</span></>}
                    </div>
                    <div className="lm-where">
                      <div className="lm-mini">{svg(true, [c])}</div>
                      <ul className="lm-places">
                        {c.keys.slice(0, 6).map((k) => <li key={k}><b>{cap(M.role(k))}</b> — {M.place(k)}</li>)}
                        {c.k > 6 && <li>{T.andMore[L](T.morePoints[L](c.k - 6))}</li>}
                      </ul>
                    </div>
                    {c.free
                      ? <div className="lm-rule">
                        <span className="lm-kicker">{T.freeKicker[L]}</span>
                        {M.explain(c, arcanumTitle).map((t, j) => <p key={j}><RichText text={t} /></p>)}
                        <p className="lm-next">{M.next(c)}{!own && (M.example
                          ? <>{M.sampleNext}<Link href={M.example}>{T.wholeSample[L]}</Link></>
                          : <>{T.nextSample[L](sampleFinding)}<a href="#findFrag">{T.excerpt[L]}</a>{T.or[L]}<Link href={EXAMPLE}>{T.wholeSample[L]}</Link></>)}</p>
                        <p className="lm-src">{M.source(c)}</p>
                      </div>
                      : <div className="lm-lockp"><span className="lm-ic"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.6" /><path d="M5.2 7V5.2a2.8 2.8 0 015.6 0V7" stroke="currentColor" strokeWidth="1.6" /></svg></span>
                        <div>{M.locked(c)}<small>{M.lockedNote(c)}</small></div></div>}
                  </div></div>
                </li>;
              })}
            </ol>
            <div className="lm-more-cta">
              <h3>{M.moreTitle?.(n) ?? T.moreTitle[L](n)}</h3>
              <p>{M.copy.moreText}</p>
              <div className="lm-btns">{endCta ?? cta ?? <>
                <a className="lm-btn lm-btn-gold" href="#toc">{T.whatInMine[L]}</a>
                <Link className="lm-btn lm-btn-ghost" href={EXAMPLE}>{T.seeExample[L]}</Link>
              </>}</div>
              <p className="lm-fine">{T.fine[L]}</p>
            </div>
          </div>}
        </div>
      </div>
    </section>
  );
}
