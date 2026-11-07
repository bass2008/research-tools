// Links of the couple's matrix after Lisovskaya's "Compatibility": point meanings of ch. 3, adding up repeats
// and reading points together (ch. 2–3), and where the card stands in each partner's own matrix
// (step 3 of her consultation, without her conclusions about who causes trouble).
import { D } from "./i18n";
import type { Lang } from "./i18n/hosts";
import {
  formulaLabel, groupLinks, joinAnd, orderLinks, rarest, rarityOf, riddleOf, rolesOf, spheresOf, sumOf, valuesOf,
  type Link, type LinksModel, type Rule,
} from "./individualLinks";
import { fold } from "./matrix";
import { computePair, type Points } from "./pair/engine";

export type PairLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "R1" | "R2";
// The green points S and T do not belong to the couple's matrix (Lisovskaya, ch. 3).
export const PAIR_ORDER: PairLetter[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "R1", "R2"];
// Amplifiers and continuations have no meaning of their own: a link of these points alone says nothing.
const MINOR = new Set(["H", "I", "K", "P", "N", "O", "Q"]);
// Step 3: the outer wheel, the centre, the money and relationship lines of each partner.
const OWN_POINTS = ["A", "B", "C", "D", "F", "G", "H", "I", "E", "L", "R2", "R", "R1", "M"] as const;

const T = D.pairLinks, TL = D.individualLinks;
const point = (L: Lang, k: string) => T.points[L][k as PairLetter];
const roles = (L: Lang, keys: string[]) => rolesOf(L, keys, (k) => point(L, k)[0]);
const rarity = (L: Lang, p: number) => rarityOf(p, T.inHundred[L], T.inThousand[L], T.rarer[L]);

// How often the same card falls on these points of a couple: a fixed sample of couples born 1960–2008.
let base: { rows: Int8Array; size: number } | null = null;
const freqCache = new Map<string, number>();
function freq(keys: string[]): number {
  const id = keys.join(",");
  const hit = freqCache.get(id);
  if (hit !== undefined) return hit;
  const w = PAIR_ORDER.length;
  if (!base) {
    const start = Date.UTC(1960, 0, 1), days = Math.round((Date.UTC(2008, 11, 31) - start) / 864e5) + 1;
    const own = new Int8Array(days * w);
    for (let i = 0; i < days; i++) {
      const dt = new Date(start + i * 864e5);
      const v = valuesOf(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
      PAIR_ORDER.forEach((k, j) => { own[i * w + j] = k === "Q" ? fold(v.C + v.L) : v[k]; });
    }
    const size = 40000, rows = new Int8Array(size * w);
    let seed = 20261107;
    const next = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed % days; };
    for (let s = 0; s < size; s++) {
      const a = next() * w, b = next() * w;
      for (let j = 0; j < w; j++) rows[s * w + j] = fold(own[a + j] + own[b + j]);
    }
    base = { rows, size };
  }
  const { rows, size } = base, idx = keys.map((k) => PAIR_ORDER.indexOf(k as PairLetter));
  let c = 0;
  for (let s = 0; s < size; s++) {
    const o = s * w, v = rows[o + idx[0]];
    if (idx.every((j) => rows[o + j] === v)) c++;
  }
  freqCache.set(id, c / size);
  return c / size;
}

function rulesFor(L: Lang, keys: string[], sym: string[], spiritual: boolean): Rule[] {
  const has = (k: string) => keys.includes(k);
  const listed = (ks: string[]) => joinAnd(L, roles(L, ks));
  const bold = (ks: string[]) => joinAnd(L, roles(L, ks).map((x) => `**${x}**`));
  // amplifiers have no sphere of their own: the centre or the task "shows in" real spheres only
  const spheresBut = (ex: string) => keys.filter((k) => k !== ex && k !== "H" && k !== "I");
  const money = ["L", "R2", "R"].filter(has), love = ["R1", "M"].filter(has);
  const ch3 = T.chapter[L]("3");
  const r: Rule[] = [];
  if (has("A") && has("B")) r.push({ w: 4, ch: ch3, t: T.ruleMeet[L] });
  if (has("F") && has("G")) r.push({ w: 4, ch: ch3, t: T.ruleFillSpoil[L] });
  if (has("C") && has("D")) r.push({ w: 3, ch: ch3, t: T.ruleMaterialTask[L] });
  if (money.length && love.length) r.push({ w: 3, ch: ch3, t: T.ruleMoney[L](bold(money), bold(love)) });
  if (spiritual) r.push({ w: 3, ch: ch3, t: T.ruleSpiritual[L] });
  if (has("E") && spheresBut("E").length) r.push({ w: 2, ch: ch3, t: T.ruleCentre[L](listed(spheresBut("E"))) });
  if (has("D") && spheresBut("D").length) r.push({ w: 2, ch: ch3, t: T.ruleTask[L](listed(spheresBut("D"))) });
  if (has("H") || has("I")) r.push({ w: 2, ch: ch3, t: T.ruleAmplifier[L](listed(keys.filter((k) => k !== "H" && k !== "I"))) });
  if (sym.length) r.push({ w: 1, ch: T.chapter[L]("2"), t: T.ruleMirror[L](sym.join("; ")) });
  return r.sort((a, b) => b.w - a.w);
}

function carriers(L: Lang, n: number, a: Points, b: Points, names: { a: string; b: string }): string {
  const where = (m: Points) => [...OWN_POINTS.filter((k) => m[k] === n).map((k) => TL.points[L][k][0]), ...(m.spiritual === n ? [T.spiritual[L]] : [])];
  const inA = where(a), inB = where(b);
  const line = T.carriers[L]([[names.a, inA], [names.b, inB]].map(([name, at]) => `**${name}** — ${at.length ? joinAnd(L, at as string[]) : T.carrierNone[L]}`).join("; "));
  const tail = inA.length && inB.length ? T.carriersBoth[L] : inA.length ? T.carriersOne[L](names.a) : inB.length ? T.carriersOne[L](names.b) : T.carriersNone[L];
  return `${line} ${tail}`;
}

interface PairLink extends Link<string> { note: string }

export function pairLinksOf(L: Lang, aBirth: string, bBirth: string, names: { a: string; b: string }): { links: PairLink[]; p: Points } {
  const { a, b, p } = computePair(aBirth, bBirth, L);
  const links = orderLinks(groupLinks(L, PAIR_ORDER, p).filter((c) => !c.keys.every((k) => MINOR.has(k))).map((c) => ({
    ...c, p: freq(c.keys), rules: rulesFor(L, c.keys, c.sym, p.spiritual === c.n), note: carriers(L, c.n, a, b, names),
  })));
  return { links, p };
}

export function pairModel(L: Lang, aBirth: string, bBirth: string, names: { a: string; b: string }): LinksModel {
  const { links, p } = pairLinksOf(L, aBirth, bBirth, names);
  const spheres = (c: Link<string>) => spheresOf(L, c.keys, (k) => point(L, k)[2]);
  const dmy = (iso: string) => iso.split("-").reverse().join(".");
  return {
    copy: { kicker: D.individualSale.pairOfferKicker[L], title: T.titleStart[L], sub: T.sub[L], section: T.section[L], chart: T.chart[L],
      moreText: T.moreText[L], sky: "", earth: "" },
    caption: [`${dmy(aBirth)} + ${dmy(bBirth)}`, T.dates[L]],
    // Lisovskaya gives the couple no age scale
    ages: false,
    values: p, links, nodes: [...PAIR_ORDER.filter((k) => k !== "E"), "E"],
    role: (k) => point(L, k)[0], place: (k) => point(L, k)[1],
    formula: formulaLabel, riddle: (c) => riddleOf(L, roles(L, c.keys)), rarity: (x) => rarity(L, x), spheres,
    explain: (c, name) => [sumOf(L, c, name, T.sumOnChart[L], T.sumWeak[L], (keys) => roles(L, keys)),
      ...c.rules.slice(0, 2).map((r) => r.t), (c as PairLink).note],
    next: (c) => T.next[L](spheres(c)),
    source: (c) => T.source[L]([...new Set([T.chapter[L]("2"), ...c.rules.slice(0, 2).map((r) => r.ch)])].sort().join(", ")),
    locked: (c) => T.locked[L](spheres(c)), lockedNote: (c) => TL.lockedRules[L](c.rules.length),
    countTitle: (n) => T.countTitle[L](n),
    countSub: () => { const r = rarest(links, (x) => rarity(L, x)); return r ? T.countSub[L](...r) : ""; },
  };
}
