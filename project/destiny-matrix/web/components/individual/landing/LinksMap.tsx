"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { arcanumImage } from "@/components/matrix/ArcanumCard";
import { useLocale } from "@/components/ui/LocaleProvider";
import Link from "@/components/ui/LocalizedLink";
import RichText from "@/components/ui/RichText";
import { track } from "@/lib/analytics";
import { forLocale as arcanaForLocale } from "@/lib/arcana";
import { D } from "@/lib/i18n";
import {
  ORDER, cap, countSub, formulaLabel, linksOf, place, rarity, riddle, role, sourceText, spheres, sumText, valuesOf,
  type Letter, type Link as MatrixLink, type Values,
} from "@/lib/individualLinks";
import { browserDay } from "@/lib/today";
import { CX, OUTLINE, POINT, R_IN, R_OUT, at, f1, poly, xy, type Size } from "./geometry";
import { showDate as show } from "./types";

const SIZE: Record<Size, [number, number]> = { big: [24, 20], mid: [21, 17.5], in: [19, 16], sm: [15.5, 13.5], ctr: [33, 27] };
const EXAMPLE = "/matrix/individual-example/personal";

// A link is drawn as arcs through its points, nearest to nearest, bowing away from the centre.
function chain(keys: Letter[]): Letter[] {
  if (keys.length < 3) return keys;
  const pts = keys.map((k) => [k, ...at(k)] as const);
  const cx = pts.reduce((s, p) => s + p[1], 0) / pts.length, cy = pts.reduce((s, p) => s + p[2], 0) / pts.length;
  let cur = pts.reduce((m, p) => Math.hypot(p[1] - cx, p[2] - cy) > Math.hypot(m[1] - cx, m[2] - cy) ? p : m, pts[0]);
  const out = [cur], left = pts.filter((p) => p !== cur);
  while (left.length) {
    let bi = 0;
    left.forEach((p, i) => { if (Math.hypot(p[1] - cur[1], p[2] - cur[2]) < Math.hypot(left[bi][1] - cur[1], left[bi][2] - cur[2])) bi = i; });
    cur = left.splice(bi, 1)[0]; out.push(cur);
  }
  return out.map((p) => p[0]);
}
function routePath(keys: Letter[]) {
  const ks = chain(keys);
  let d = "";
  for (let i = 0; i < ks.length - 1; i++) {
    const [x1, y1] = at(ks[i]), [x2, y2] = at(ks[i + 1]);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, len = Math.hypot(x2 - x1, y2 - y1);
    let nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
    if ((mx - CX) * nx + (my - CX) * ny < 0) { nx = -nx; ny = -ny; }
    const bow = Math.min(64, Math.max(14, len * 0.2));
    d += `${i ? "" : `M${f1(x1)},${f1(y1)}`} Q${f1(mx + nx * bow)},${f1(my + ny * bow)} ${f1(x2)},${f1(y2)}`;
  }
  return d;
}

function Frame({ mini, sky, earth }: { mini: boolean; sky: string; earth: string }) {
  return <>
    {!mini && <>
      <circle className="lm-ring" cx={CX} cy={CX} r={R_OUT + 30} /><circle className="lm-ring" cx={CX} cy={CX} r={R_OUT + 18} />
      {Array.from({ length: 80 }, (_, i) => {
        const a = 180 + i * 4.5, [x1, y1] = xy(a, R_OUT + 18), [x2, y2] = xy(a, R_OUT + (i % 5 ? 23 : 27));
        const age = i % 10 === 0 && i ? xy(a, R_OUT + 39) : null;
        return <g key={i}>
          <line className="lm-tick" x1={f1(x1)} y1={f1(y1)} x2={f1(x2)} y2={f1(y2)} strokeWidth={i % 5 ? 0.7 : 1.3} />
          {age && <text className="lm-age" x={f1(age[0])} y={f1(age[1])}>{i}</text>}
        </g>;
      })}
    </>}
    <polygon className="lm-side" points={poly(OUTLINE, R_OUT)} />
    <polygon className="lm-diag" points={poly([-90, 0, 90, 180], R_IN)} />
    <polygon className="lm-diag" points={poly([-45, 45, 135, 225], R_IN)} />
    {[180, 225, -90, -45].map((a) => { const [x1, y1] = xy(a, R_OUT), [x2, y2] = xy(a + 180, R_OUT); return <line key={a} className="lm-axis" x1={f1(x1)} y1={f1(y1)} x2={f1(x2)} y2={f1(y2)} />; })}
    {!mini && <>
      <text className="lm-lbl" x={CX} y={CX - R_IN + 34}>{sky}</text><text className="lm-lbl" x={CX} y={CX + R_IN - 26}>{sky}</text>
      <text className="lm-lbl" x={CX - R_IN} y={CX - 30}>{earth}</text><text className="lm-lbl" x={CX + R_IN} y={CX - 30}>{earth}</text>
    </>}
  </>;
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

/** "Your matrix has links you cannot see point by point": the visitor's date, its links and one rule of the corpus. */
export default function LinksMap({ sample, sampleFinding, onDate }: {
  sample: string; sampleFinding: string; onDate: (date: { y: number; m: number; d: number }, links: number) => void;
}) {
  const L = useLocale();
  const T = D.individualLinks;
  const TL = D.individualLanding;
  const { arcanumTitle } = arcanaForLocale(L);
  const [input, setInput] = useState(sample);
  const [date, setDate] = useState(() => parseDate(sample)!);
  const [own, setOwn] = useState(false);
  const [err, setErr] = useState(false);
  const [open, setOpen] = useState(0);
  const [focused, setFocused] = useState<number | null>(null);
  const [tip, setTip] = useState<{ lines: string[]; left: number; top: number } | null>(null);
  const [run, setRun] = useState(0);
  const dateReported = useRef(false);
  const values: Values = useMemo(() => valuesOf(date.y, date.m, date.d), [date]);
  const links: MatrixLink[] = useMemo(() => linksOf(L, values), [L, values]);
  const focusI = focused !== null && focused < links.length ? focused : null;
  const by = useMemo(() => { const o: Partial<Record<Letter, number>> = {}; links.forEach((c, i) => c.keys.forEach((k) => { o[k] = i; })); return o; }, [links]);
  const mapRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // the numbers flip in and the links draw themselves after every new date
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
  }, [run]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseDate(input);
    if (!p) { setErr(true); return; }
    setErr(false);
    const mine = own || show(p) !== sample;
    setOwn(mine);
    setDate(p);
    setOpen(0);
    setFocused(null);
    setRun((r) => r + 1);
    if (mine) {
      onDate(p, linksOf(L, valuesOf(p.y, p.m, p.d)).length);
      if (!dateReported.current) track("individual_date");
      dateReported.current = true;
    }
    if (innerWidth < 1000) mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const tipFor = (k: Letter, el: Element) => {
    const val = values[k], i = by[k];
    const r = el.getBoundingClientRect(), w = wrapRef.current!.getBoundingClientRect();
    setTip({
      lines: [`**${val} · ${arcanumTitle(val)}**`, `${cap(role(L, k))} — ${place(L, k)}`, ...(i === undefined ? [] : [`${T.inLink[L]} ${formulaLabel(links[i])}`])],
      left: Math.min(Math.max(r.left + r.width / 2 - w.left, 110), w.width - 110), top: r.top - w.top - 6,
    });
  };

  const svg = (mini: boolean, list: MatrixLink[]) => {
    const owner: Partial<Record<Letter, number>> = {};
    list.forEach((c, i) => c.keys.forEach((k) => { owner[k] = i; }));
    const node = (k: Letter) => {
      const [x, y] = at(k), i = owner[k], lit = i !== undefined, size = POINT[k].size, [r, fs] = SIZE[size];
      if (mini) return <circle key={k} cx={f1(x)} cy={f1(y)} r={lit ? r * 0.9 : 7} fill={lit ? list[i].color : "#2b4366"} />;
      return <g key={k} className={`lm-node lm-${size}${lit ? " lm-on" : ""}${lit && i === focusI ? " lm-f" : ""}`} tabIndex={0}
        onMouseEnter={(e) => tipFor(k, e.currentTarget)} onMouseLeave={() => setTip(null)}
        onClick={(e) => { tipFor(k, e.currentTarget); if (lit) setOpen(i); setFocused(lit ? i : null); }}>
        <circle className="lm-halo" cx={f1(x)} cy={f1(y)} r={r + 5} stroke={lit ? list[i].color : "none"} />
        <circle className="lm-b" cx={f1(x)} cy={f1(y)} r={r} />
        <text x={f1(x)} y={f1(y + 1)} fontSize={fs}>{values[k]}</text>
      </g>;
    };
    return <svg className={`lm-oct${mini ? " lm-m" : ""}${!mini && focusI !== null ? " lm-focus" : ""}`} viewBox={mini ? "28 28 564 564" : "8 8 604 604"} role="img" aria-label={T.chart[L]}>
      <Frame mini={mini} sky={T.sky[L]} earth={T.earth[L]} />
      <g className="lm-routes">{list.map((c, i) => <path key={i} className={`lm-route${!mini && i === focusI ? " lm-f" : ""}`} d={routePath(c.keys)} stroke={c.color} />)}</g>
      <g className="lm-nodes">{ORDER.filter((k) => k !== "E").map(node)}{node("E")}</g>
    </svg>;
  };

  const n = links.length;
  return (
    <section id="map" className="lm-host" aria-label={T.section[L]}>
      <div className="lm-night">
        <div className="lm-wrap lm-hero">
          <div className="lm-hero-copy">
            <div className="lm-kicker">{TL.kicker[L]}</div>
            <h2 className="lm-h1">{T.titleStart[L]}<em>{T.titleAccent[L]}</em></h2>
            <p className="lm-sub">{T.sub[L]}</p>
            <form className="lm-dform" autoComplete="off" onSubmit={submit}>
              <label htmlFor="lm-bd">{T.dateLabel[L]}</label>
              <input id="lm-bd" inputMode="numeric" placeholder={T.placeholder[L]} value={input} maxLength={10} aria-describedby="lm-dnote"
                onChange={(e) => {
                  const dgt = e.target.value.replace(/\D/g, "").slice(0, 8);
                  setInput(dgt.slice(0, 2) + (dgt.length > 2 ? "." + dgt.slice(2, 4) : "") + (dgt.length > 4 ? "." + dgt.slice(4) : ""));
                }} />
              <button className="lm-btn lm-btn-gold" type="submit">{T.showLinks[L]}</button>
              <div className={`lm-dnote${err ? " lm-err" : ""}`} id="lm-dnote">{err ? T.badDate[L] : own ? T.ownNote[L] : T.sampleNote[L]}</div>
            </form>
          </div>

          <div className="lm-hero-map">
            <div className="lm-map-sticky" ref={wrapRef}>
              <div ref={mapRef}>{svg(false, links)}</div>
              <div className={`lm-tip${tip ? " lm-show" : ""}`} style={tip ? { left: tip.left, top: tip.top } : undefined}>
                {tip?.lines.map((line, i) => i === 0 ? <RichText key={i} text={line} /> : <span key={i}><br />{line}</span>)}
              </div>
              <div className="lm-map-cap">
                <span><b>{show(date)}</b> · {own ? T.ownDate[L] : T.sampleDate[L]}</span>
                <span className="lm-legend"><span><i />{T.legendLink[L]}</span><span><s />{T.legendPoint[L]}</span></span>
              </div>
            </div>
          </div>

          <div className="lm-hero-rest">
            <div className="lm-count">
              <div className="lm-num">{n}</div>
              <h3 className="lm-count-h">{T.countTitle[L](n, own)}</h3>
              <p><RichText text={countSub(L, links)} /></p>
            </div>
            <ol className="lm-stations">
              {links.map((c, i) => {
                const shown = c.k > 3 ? 2 : c.k;
                const isOpen = i === open;
                return <li key={`${c.n}-${i}`} className={`lm-st${isOpen ? " lm-open" : ""}`} style={{ ["--c" as string]: c.color }}>
                  <button className="lm-st-head" type="button" aria-expanded={isOpen} onClick={() => { setOpen(isOpen ? -1 : i); setFocused(isOpen ? null : i); }}>
                    <span className="lm-st-bar" /><span className="lm-st-f">{formulaLabel(c)}</span>
                    <span><span className="lm-st-t">{riddle(L, c)}</span>
                      <span className="lm-st-m"><span>{arcanumTitle(c.n)}</span><span className="lm-rare">{rarity(L, c.p)}</span>
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
                        <figure className="lm-fc"><img src={arcanumImage(c.n, true)} alt={arcanumTitle(c.n)} loading="lazy" /><figcaption>{cap(role(L, k))}</figcaption></figure>
                      </span>)}
                      {c.k > 3 && <><span className="lm-fop">=</span><span className="lm-fmore">{T.morePoints[L](c.k - shown)}</span></>}
                    </div>
                    <div className="lm-where">
                      <div className="lm-mini">{svg(true, [c])}</div>
                      <ul className="lm-places">
                        {c.keys.slice(0, 6).map((k) => <li key={k}><b>{cap(role(L, k))}</b> — {place(L, k)}</li>)}
                        {c.k > 6 && <li>{T.andMore[L](T.morePoints[L](c.k - 6))}</li>}
                      </ul>
                    </div>
                    {c.free
                      ? <div className="lm-rule">
                        <span className="lm-kicker">{T.freeKicker[L]}</span>
                        <p><RichText text={sumText(L, c, arcanumTitle)} /></p>
                        {c.rules.slice(0, 2).map((r, j) => <p key={j}><RichText text={r.t} /></p>)}
                        <p className="lm-next">{T.next[L](spheres(L, c))}{!own && <>{T.nextSample[L](sampleFinding)}
                          <a href="#findFrag">{T.excerpt[L]}</a>{T.or[L]}<Link href={EXAMPLE}>{T.wholeSample[L]}</Link></>}</p>
                        <p className="lm-src">{sourceText(L, c)}</p>
                      </div>
                      : <div className="lm-lockp"><span className="lm-ic"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.6" /><path d="M5.2 7V5.2a2.8 2.8 0 015.6 0V7" stroke="currentColor" strokeWidth="1.6" /></svg></span>
                        <div>{T.locked[L](spheres(L, c))}<small>{T.lockedRules[L](c.rules.length)}</small></div></div>}
                  </div></div>
                </li>;
              })}
            </ol>
            <div className="lm-more-cta">
              <h3>{T.moreTitle[L](n)}</h3>
              <p>{T.moreText[L]}</p>
              <div className="lm-btns">
                <a className="lm-btn lm-btn-gold" href="#toc">{T.whatInMine[L]}</a>
                <Link className="lm-btn lm-btn-ghost" href={EXAMPLE}>{T.seeExample[L]}</Link>
              </div>
              <p className="lm-fine">{T.fine[L]}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
