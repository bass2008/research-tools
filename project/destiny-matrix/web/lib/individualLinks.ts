// "Links" of the landing: equal cards in different points of the chart, how rare each repetition is,
// and the rule of the corpus that applies to it. Texts are in `D.individualLinks`.
import { D } from "./i18n";
import type { Lang } from "./i18n/hosts";
import { MAP_POINTS } from "./matrixMap";
import { fold, foldYear, fromPoints, type Matrix } from "./matrix";

export type Letter = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N" | "O" | "P" | "S" | "T" | "R" | "R1" | "R2";
export const ORDER: Letter[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "S", "T", "R", "R1", "R2"];
export type Values = Record<Letter, number>;

const KEY_BY_LETTER = Object.fromEntries(MAP_POINTS.map((p) => [p.symbol, p.key])) as Record<Letter, string>;

/** Numbers of the chart by the letters the readings and the method use. */
export function lettersOf(m: Matrix): Values {
  const row = (key: string) => m.chakras.find((c) => c.key === key)!;
  const flat: Record<string, number> = {
    day: m.day, month: m.month, year: m.year, mission: m.mission, center: m.center,
    father_line: m.father_line, mother_line: m.mother_line, descendants: m.descendants, inheritance: m.inheritance,
    comfort_west: m.comfort_west, comfort_north: m.comfort_north, comfort_east: m.comfort_east, comfort_south: m.comfort_south,
    karmic_tail_middle: m.karmic_tail[1], ajna_physics: row("ajna").physics, ajna_energy: row("ajna").energy,
    anahata_physics: row("anahata").physics, anahata_energy: row("anahata").energy,
    money_love_crossing: m.money[2], love_middle: m.love[1], money_middle: m.money[1],
  };
  return Object.fromEntries(ORDER.map((k) => [k, flat[KEY_BY_LETTER[k]]])) as Values;
}

export const valuesOf = (y: number, mo: number, d: number): Values =>
  lettersOf(fromPoints(fold(d), fold(mo), foldYear(y), `${y}-${mo}-${d}`));

// How often the same card falls on these points: dates of 1960–2008, counted once per page.
let base: { rows: Int8Array; days: number } | null = null;
const freqCache = new Map<string, number>();
function freq(keys: Letter[]): number {
  const id = keys.join(",");
  const hit = freqCache.get(id);
  if (hit !== undefined) return hit;
  if (!base) {
    const days = Math.round((Date.UTC(2008, 11, 31) - Date.UTC(1960, 0, 1)) / 864e5) + 1;
    const rows = new Int8Array(days * ORDER.length);
    for (let i = 0; i < days; i++) {
      const dt = new Date(Date.UTC(1960, 0, 1) + i * 864e5);
      const v = valuesOf(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
      ORDER.forEach((k, j) => { rows[i * ORDER.length + j] = v[k]; });
    }
    base = { rows, days };
  }
  const { rows, days } = base, w = ORDER.length, idx = keys.map((k) => ORDER.indexOf(k));
  let c = 0;
  for (let i = 0; i < days; i++) {
    const o = i * w, v = rows[o + idx[0]];
    if (idx.every((j) => rows[o + j] === v)) c++;
  }
  freqCache.set(id, c / days);
  return c / days;
}

const MIRRORS: [Letter, Letter][] = [["A", "C"], ["B", "D"], ["F", "G"], ["I", "H"], ["F", "I"], ["G", "H"], ["J", "L"], ["K", "M"]];
export const COLORS = ["#d4ab55", "#4fc1b3", "#e8806a", "#a99bf3", "#67b2ec", "#e48aaf", "#a8cf6a", "#dcc391", "#8fb1d2"];

export interface Rule { w: number; ch: string; t: string }
export interface Link {
  n: number; keys: Letter[]; k: number; sym: string[]; p: number; sum: number; sumAt: Letter[];
  rules: Rule[]; free: boolean; color: string;
}

const T = D.individualLinks;
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const joinAnd = (L: Lang, a: string[]) => a.length < 2 ? (a[0] ?? "") : `${a.slice(0, -1).join(", ")} ${T.and[L]} ${a[a.length - 1]}`;
export const role = (L: Lang, k: Letter) => T.points[L][k][0];
export const place = (L: Lang, k: Letter) => T.points[L][k][1];

function roles(L: Lang, keys: Letter[]): string[] {
  let ks = [...keys];
  const out: string[] = [];
  if (ks.includes("H") && ks.includes("I")) { ks = ks.filter((k) => k !== "H" && k !== "I"); out.push(T.bothAmplifiers[L]); }
  if (ks.includes("S") && ks.includes("T")) { ks = ks.filter((k) => k !== "S" && k !== "T"); out.push(T.bothLove[L]); }
  return [...ks.map((k) => role(L, k)), ...out];
}

function rulesFor(L: Lang, keys: Letter[], sym: string[]): Rule[] {
  const has = (k: Letter) => keys.includes(k);
  const others = (ex: Letter[]) => joinAnd(L, roles(L, keys.filter((k) => !ex.includes(k))));
  const bold = (ks: Letter[]) => joinAnd(L, roles(L, ks).map((x) => `**${x}**`));
  const money = (["L", "R2", "R"] as Letter[]).filter(has);
  const linked = (["B", "P", "K", "C", "M", "N", "D", "G"] as Letter[]).filter(has);
  const r: Rule[] = [];
  if (has("F") && has("G")) r.push({ w: 4, ch: T.chapter[L]("10"), t: T.ruleInspiration[L] });
  if (money.length && linked.length) r.push({ w: 3, ch: T.chapter[L]("6"), t: T.ruleMoney[L](bold(money), bold(linked)) });
  if (has("E")) r.push({ w: 2, ch: T.chapter[L]("11"), t: T.ruleCentre[L](others(["E"])) });
  if (has("H") || has("I")) r.push({ w: 2, ch: T.chapter[L]("1"), t: T.ruleAmplifier[L](others(["H", "I"])) });
  if (has("G") && !has("F")) r.push({ w: 2, ch: T.chapter[L]("1"), t: T.rulePressure[L](others(["G"])) });
  if (sym.length) r.push({ w: 2, ch: T.compatChapter[L], t: T.ruleMirror[L](sym.join("; ")) });
  return r.sort((a, b) => b.w - a.w);
}

/** Every card standing in two or more points; the one the corpus says most about is explained for free. */
export function linksOf(L: Lang, v: Values): Link[] {
  const groups = new Map<number, Letter[]>();
  ORDER.forEach((k) => groups.set(v[k], [...(groups.get(v[k]) ?? []), k]));
  const list: Link[] = [];
  for (const [n, keys] of groups) {
    if (keys.length < 2) continue;
    const sym = MIRRORS.map((m, i) => [m, T.mirrors[L][i]] as const).filter(([[a, b]]) => keys.includes(a) && keys.includes(b)).map(([, text]) => text);
    const sum = fold(n * keys.length);
    list.push({ n, keys, k: keys.length, sym, p: freq(keys), sum, sumAt: sum === n ? [] : ORDER.filter((k) => v[k] === sum),
      rules: rulesFor(L, keys, sym), free: false, color: "" });
  }
  if (!list.length) return list;
  const score = (c: Link) => c.rules.reduce((s, r) => s + r.w, 0) + (c.sumAt.length ? 2 : 0) + (c.k >= 3 ? 1 : 0) + (c.p < 0.01 ? 2 : c.p < 0.03 ? 1 : 0);
  list.sort((a, b) => a.p - b.p);
  const free = [...list].sort((a, b) => score(b) - score(a) || a.p - b.p)[0];
  free.free = true;
  const ordered = [free, ...list.filter((c) => c !== free)];
  ordered.forEach((c, i) => { c.color = COLORS[i % COLORS.length]; });
  return ordered;
}

export function formulaLabel(c: Link) {
  if (c.k >= 3) return `${c.n} × ${c.k}`;
  return c.sym.length ? `${c.n} ↔ ${c.n}` : `${c.n} = ${c.n}`;
}

export function rarity(L: Lang, p: number) {
  if (p >= 0.01) return T.inHundred[L](Math.round(p * 100));
  const n = Math.round(p * 1000);
  return n >= 1 ? T.inThousand[L](n) : T.rarer[L];
}

export function riddle(L: Lang, c: Link) {
  const r = roles(L, c.keys);
  const head = r.length > 4 ? `${r.slice(0, 3).join(", ")} ${T.andMore[L](T.morePoints[L](r.length - 3))}` : joinAnd(L, r);
  return `${cap(head)} — ${T.oneCard[L]}`;
}

export function spheres(L: Lang, c: Link) {
  return joinAnd(L, [...new Set(c.keys.flatMap((k) => T.points[L][k][2].split("|")))]);
}

export function sumText(L: Lang, c: Link, name: (n: number) => string) {
  const parts = c.k <= 4 ? Array(c.k).fill(c.n).join(" + ") : `${c.n} × ${c.k}`;
  const tail = c.sum === c.n ? T.sumSame[L] : c.sumAt.length ? T.sumOnChart[L](joinAnd(L, roles(L, c.sumAt))) : T.sumWeak[L];
  return T.sumHead[L](parts, c.n * c.k, c.sum, name(c.sum)) + tail;
}

export function sourceText(L: Lang, c: Link) {
  const chapters = [T.chapter[L]("11"), ...c.rules.slice(0, 2).map((r) => r.ch)].filter((x, i, a) => a.indexOf(x) === i).join(", ");
  return T.source[L](chapters, c.sum !== c.n);
}

export function countSub(L: Lang, links: Link[]) {
  if (!links.length) return "";
  const rare = [...links].sort((a, b) => a.p - b.p)[0];
  return T.countSub[L](formulaLabel(rare), rarity(L, rare.p).replace(/ /g, " "), links.filter((c) => c.p < 0.01).length, links.length);
}
