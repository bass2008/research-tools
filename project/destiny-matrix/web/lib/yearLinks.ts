// Links of the year matrix after Lisovskaya's "Prognostics": repeated cards on the points of the year and in its
// thirds ("look at which energies repeat and on which points"), read by her plus/minus split of the points,
// and where the card stands in the personal matrix (our editorial method of the year reading).
import { D } from "./i18n";
import type { Lang } from "./i18n/hosts";
import {
  ORDER, formulaLabel, joinAnd, orderLinks, rarest, rarityOf, riddleOf, rolesOf, spheresOf, valuesOf,
  type Link, type LinksModel, type Rule,
} from "./individualLinks";
import { yearPoints, type YearKey } from "./yearMatrix";

export const YEAR_ORDER: YearKey[] = ["E", "A", "B", "C", "D", "F", "G", "H", "I", "P1", "P2", "P3"];
const THIRDS = ["P1", "P2", "P3"];

export interface YearLinksModel extends LinksModel {
  frame: "year";
  wheel: string[];
  accent?: string;
  example: string;
  sampleNext: string;
  moreTitle: (n: number) => string;
}

const T = D.yearLinks, TL = D.individualLinks;
const point = (L: Lang, k: string) => T.points[L][k as YearKey];
function roles(L: Lang, keys: string[]): string[] {
  let ks = [...keys];
  const out: string[] = [];
  if (ks.includes("H") && ks.includes("I")) { ks = ks.filter((k) => k !== "H" && k !== "I"); out.push(T.bothHints[L]); }
  return [...ks.map((k) => point(L, k)[0]), ...out];
}
const rarity = (L: Lang, p: number) => rarityOf(p, TL.inHundred[L], TL.inThousand[L], TL.rarer[L]);

// How often the same card falls on these points of the year: birth dates 1960–2008, counted once per year asked.
const bases = new Map<number, { rows: Int8Array; days: number }>();
const freqCache = new Map<string, number>();
function freq(year: number, keys: string[]): number {
  const id = `${year}:${keys.join(",")}`;
  const hit = freqCache.get(id);
  if (hit !== undefined) return hit;
  const w = YEAR_ORDER.length;
  let base = bases.get(year);
  if (!base) {
    const start = Date.UTC(1960, 0, 1), days = Math.round((Date.UTC(2008, 11, 31) - start) / 864e5) + 1;
    const rows = new Int8Array(days * w);
    for (let i = 0; i < days; i++) {
      const dt = new Date(start + i * 864e5);
      const v = yearPoints({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() }, year);
      YEAR_ORDER.forEach((k, j) => { rows[i * w + j] = v[k]; });
    }
    base = { rows, days };
    bases.set(year, base);
  }
  const { rows, days } = base, idx = keys.map((k) => YEAR_ORDER.indexOf(k as YearKey));
  let c = 0;
  for (let i = 0; i < days; i++) {
    const o = i * w, v = rows[o + idx[0]];
    if (idx.every((j) => rows[o + j] === v)) c++;
  }
  freqCache.set(id, c / days);
  return c / days;
}

function rulesFor(L: Lang, keys: string[]): Rule[] {
  const has = (k: string) => keys.includes(k);
  const others = (ex: string[]) => joinAnd(L, roles(L, keys.filter((k) => !ex.includes(k))));
  const bold = (ks: string[]) => joinAnd(L, roles(L, ks).map((x) => `**${x}**`));
  const plus = ["B", "F"].filter(has), minus = ["C", "D"].filter(has);
  const thirds = THIRDS.filter(has), onChart = keys.filter((k) => !THIRDS.includes(k));
  const how = T.howToRead[L], block = T.thirdsChapter[L];
  const r: Rule[] = [];
  if (plus.length && minus.length) r.push({ w: 4, ch: how, t: T.rulePlusMinus[L](bold(plus), bold(minus)) });
  if (has("C") && has("D")) r.push({ w: 4, ch: how, t: T.ruleMinusPair[L] });
  if (has("B") && has("F")) r.push({ w: 3, ch: how, t: T.rulePlusPair[L] });
  if (has("E")) r.push({ w: 3, ch: how, t: T.ruleCentre[L](others(["E"])) });
  if (has("P1") && has("P2")) r.push({ w: 3, ch: block, t: T.ruleThirds[L] });
  if (has("P3") && keys.length > 1) r.push({ w: 2, ch: block, t: T.ruleLast[L](others(["P3"])) });
  const early = thirds.filter((k) => k !== "P3");
  if (early.length && onChart.length) r.push({ w: 2, ch: block, t: T.ruleThird[L](joinAnd(L, early.map((k) => point(L, k)[0])), joinAnd(L, roles(L, onChart))) });
  if (has("G")) r.push({ w: 2, ch: how, t: T.ruleWeak[L](others(["G"])) });
  if (has("A")) r.push({ w: 1, ch: how, t: T.rulePeople[L](others(["A"])) });
  if (has("H") || has("I")) r.push({ w: 1, ch: how, t: T.ruleHint[L](others(["H", "I"])) });
  r.push({ w: 0, ch: how, t: T.ruleRepeat[L](keys.length) });
  return r.sort((a, b) => b.w - a.w);
}

function natalNote(L: Lang, n: number, birth: { y: number; m: number; d: number }) {
  const v = valuesOf(birth.y, birth.m, birth.d);
  const at = ORDER.filter((k) => v[k] === n);
  return at.length ? T.natal[L](joinAnd(L, rolesOf(L, at, (k) => TL.points[L][k as keyof typeof TL.points.ru][0]))) : T.natalNone[L];
}

export function yearLinksOf(L: Lang, birth: { y: number; m: number; d: number }, year: number): { links: Link<string>[]; values: Record<YearKey, number> } {
  const values = yearPoints(birth, year);
  const groups = new Map<number, string[]>();
  YEAR_ORDER.forEach((k) => groups.set(values[k], [...(groups.get(values[k]) ?? []), k]));
  const links = orderLinks([...groups].filter(([, keys]) => keys.length > 1).map(([n, keys]) => ({
    n, keys, k: keys.length, sym: [], sum: n, sumAt: [], free: false, color: "", p: freq(year, keys), rules: rulesFor(L, keys),
  })));
  return { links, values };
}

export function yearModel(L: Lang, birth: { y: number; m: number; d: number }, year: number): YearLinksModel {
  const { links, values } = yearLinksOf(L, birth, year);
  const spheres = (c: Link<string>) => spheresOf(L, c.keys, (k) => point(L, k)[2]);
  const dmy = `${String(birth.d).padStart(2, "0")}.${String(birth.m).padStart(2, "0")}.${birth.y}`;
  const none = !links.length;
  return {
    frame: "year", wheel: T.wheel[L], example: "/matrix/individual-example/year", sampleNext: T.sampleNext[L],
    moreTitle: (n) => T.moreTitle[L](n),
    accent: none ? T.zeroAccent[L] : undefined,
    copy: { kicker: D.individualSale.yearBannerKicker[L], title: none ? T.zeroTitle[L](year) : T.title[L](year), sub: T.sub[L],
      section: T.section[L], chart: T.chart[L], moreText: T.moreText[L], sky: "", earth: "" },
    caption: [`${dmy} → ${year}`, ""],
    ages: false,
    values, links, nodes: [...YEAR_ORDER.filter((k) => k !== "E"), "E"],
    role: (k) => point(L, k)[0], place: (k) => point(L, k)[1],
    formula: formulaLabel, riddle: (c) => riddleOf(L, roles(L, c.keys)), rarity: (p) => rarity(L, p), spheres,
    explain: (c) => [...c.rules.slice(0, 2).map((r) => r.t), natalNote(L, c.n, birth)],
    next: (c) => T.next[L](spheres(c)),
    source: (c) => T.source[L]([...new Set(c.rules.slice(0, 2).map((r) => r.ch))].join(", ")),
    locked: (c) => T.locked[L](spheres(c), year), lockedNote: (c) => TL.lockedRules[L](c.rules.filter((r) => r.w > 0).length),
    countTitle: (n, own) => T.countTitle[L](n, own, year),
    countSub: () => { const r = rarest(links, (x) => rarity(L, x)); return r ? T.countSub[L](r[0], r[1], year) : ""; },
  };
}
