// "Links" of the landing: equal cards in different points of the chart, how rare each repetition is,
// and the rule of the corpus that applies to it. Texts are in `D.individualLinks`.
import { D } from "./i18n";
import type { Lang } from "./i18n/hosts";
import { MAP_POINTS } from "./matrixMap";
import { fold, foldYear, fromPoints, type Matrix } from "./matrix";
import { materialKarmaOf } from "./materialKarmaRow";

export type Letter = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "S" | "T" | "R" | "R1" | "R2";
export const ORDER: Letter[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "S", "T", "R", "R1", "R2"];
export type Values = Record<Letter, number>;

const KEY_BY_LETTER = Object.fromEntries(MAP_POINTS.map((p) => [p.symbol, p.key])) as Record<Letter, string>;

/** Numbers of the chart by the letters the readings and the method use. */
export function lettersOf(m: Matrix): Values {
  const row = (key: string) => m.chakras.find((c) => c.key === key)!;
  const flat: Record<string, number> = {
    day: m.day, month: m.month, year: m.year, mission: m.mission, center: m.center,
    father_line: m.father_line, mother_line: m.mother_line, descendants: m.descendants, inheritance: m.inheritance,
    comfort_west: m.comfort_west, comfort_north: m.comfort_north, comfort_east: m.comfort_east, comfort_south: m.comfort_south,
    karmic_tail_middle: m.karmic_tail[1], material_attitude: materialKarmaOf(m)[1], ajna_physics: row("ajna").physics, ajna_energy: row("ajna").energy,
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

// pairs of points opposite each other, in the order of the mirror names in the dictionary
export const MIRRORS: [string, string][] = [["A", "C"], ["B", "D"], ["F", "G"], ["I", "H"], ["F", "I"], ["G", "H"], ["J", "L"], ["K", "M"]];
export const COLORS = ["#d4ab55", "#4fc1b3", "#e8806a", "#a99bf3", "#67b2ec", "#e48aaf", "#a8cf6a", "#dcc391", "#8fb1d2"];
// the same hues, darker: the light gold block needs contrast the night of the landing does not
export const LIGHT_COLORS = ["#b07d12", "#11897a", "#d1543a", "#6c58dc", "#2a7cc4", "#c64a7f", "#5f9220", "#9c7f3c", "#4b77a6"];

export interface Rule { w: number; ch: string; t: string }
export interface Link<K extends string = Letter> {
  n: number; keys: K[]; k: number; sym: string[]; p: number; sum: number; sumAt: K[];
  rules: Rule[]; free: boolean; color: string;
}

// What the links block draws and says: the personal chart and the couple's chart fill it the same way.
export interface LinksModel {
  copy: { kicker: string; title: string; sub: string; section: string; chart: string; moreText: string; sky: string; earth: string };
  // the dates under the chart and what they are, when the chart is not of the visitor's input
  caption?: [string, string];
  // the age scale around the chart belongs to a person's matrix only
  ages: boolean;
  values: Record<string, number>;
  links: Link<string>[];
  nodes: string[];
  role(k: string): string;
  place(k: string): string;
  formula(c: Link<string>): string;
  riddle(c: Link<string>): string;
  rarity(p: number): string;
  spheres(c: Link<string>): string;
  explain(c: Link<string>, name: (n: number) => string): string[];
  next(c: Link<string>): string;
  source(c: Link<string>): string;
  locked(c: Link<string>): string;
  lockedNote(c: Link<string>): string;
  countTitle(n: number, own: boolean): string;
  countSub(): string;
}

const T = D.individualLinks;
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const joinAnd = (L: Lang, a: string[]) => a.length < 2 ? (a[0] ?? "") : `${a.slice(0, -1).join(", ")} ${T.and[L]} ${a[a.length - 1]}`;
export const role = (L: Lang, k: string) => T.points[L][k as Letter][0];
export const place = (L: Lang, k: string) => T.points[L][k as Letter][1];

export function rolesOf(L: Lang, keys: string[], name: (k: string) => string): string[] {
  let ks = [...keys];
  const out: string[] = [];
  if (ks.includes("H") && ks.includes("I")) { ks = ks.filter((k) => k !== "H" && k !== "I"); out.push(T.bothAmplifiers[L]); }
  if (ks.includes("S") && ks.includes("T")) { ks = ks.filter((k) => k !== "S" && k !== "T"); out.push(T.bothLove[L]); }
  return [...ks.map(name), ...out];
}
const roles = (L: Lang, keys: string[]) => rolesOf(L, keys, (k) => role(L, k));

export function groupLinks(L: Lang, order: readonly string[], v: Record<string, number>): Omit<Link<string>, "p" | "rules">[] {
  const groups = new Map<number, string[]>();
  order.forEach((k) => groups.set(v[k], [...(groups.get(v[k]) ?? []), k]));
  return [...groups].filter(([, keys]) => keys.length > 1).map(([n, keys]) => {
    const sum = fold(n * keys.length);
    return { n, keys, k: keys.length, sum, sumAt: sum === n ? [] : order.filter((k) => v[k] === sum), free: false, color: "",
      sym: MIRRORS.map((m, i) => [m, T.mirrors[L][i]] as const).filter(([[a, b]]) => keys.includes(a) && keys.includes(b)).map(([, text]) => text) };
  });
}

// the rarest first; the one the books say most about goes on top and is explained for free
export function orderLinks<C extends Link<string>>(list: C[]): C[] {
  if (!list.length) return list;
  const score = (c: C) => c.rules.reduce((s, r) => s + r.w, 0) + (c.sumAt.length ? 2 : 0) + (c.k >= 3 ? 1 : 0) + (c.p < 0.01 ? 2 : c.p < 0.03 ? 1 : 0);
  list.sort((a, b) => a.p - b.p);
  const free = [...list].sort((a, b) => score(b) - score(a) || a.p - b.p)[0];
  free.free = true;
  const ordered = [free, ...list.filter((c) => c !== free)];
  ordered.forEach((c, i) => { c.color = COLORS[i % COLORS.length]; });
  return ordered;
}

function rulesFor(L: Lang, keys: string[], sym: string[]): Rule[] {
  const has = (k: string) => keys.includes(k);
  const others = (ex: string[]) => joinAnd(L, roles(L, keys.filter((k) => !ex.includes(k))));
  const bold = (ks: string[]) => joinAnd(L, roles(L, ks).map((x) => `**${x}**`));
  const money = ["L", "R2", "R"].filter(has);
  const linked = ["B", "P", "K", "C", "Q", "M", "N", "D", "G"].filter(has);
  const r: Rule[] = [];
  if (has("F") && has("G")) r.push({ w: 4, ch: T.chapter[L]("10"), t: T.ruleInspiration[L] });
  if (money.length && linked.length) r.push({ w: 3, ch: T.chapter[L]("6"), t: T.ruleMoney[L](bold(money), bold(linked)) });
  if (has("E")) r.push({ w: 2, ch: T.chapter[L]("11"), t: T.ruleCentre[L](others(["E"])) });
  if (has("H") || has("I")) r.push({ w: 2, ch: T.chapter[L]("1"), t: T.ruleAmplifier[L](others(["H", "I"])) });
  if (has("G") && !has("F")) r.push({ w: 2, ch: T.chapter[L]("1"), t: T.rulePressure[L](others(["G"])) });
  if (sym.length) r.push({ w: 2, ch: T.compatChapter[L], t: T.ruleMirror[L](sym.join("; ")) });
  return r.sort((a, b) => b.w - a.w);
}

export function linksOf(L: Lang, v: Values): Link[] {
  return orderLinks(groupLinks(L, ORDER, v).map((c) => ({ ...c, p: freq(c.keys as Letter[]), rules: rulesFor(L, c.keys, c.sym) }))) as Link[];
}

export function formulaLabel(c: Link<string>) {
  if (c.k >= 3) return `${c.n} × ${c.k}`;
  return c.sym.length ? `${c.n} ↔ ${c.n}` : `${c.n} = ${c.n}`;
}

export function rarityOf(p: number, inHundred: (n: number) => string, inThousand: (n: number) => string, rarer: string) {
  if (p >= 0.01) return inHundred(Math.round(p * 100));
  const n = Math.round(p * 1000);
  return n >= 1 ? inThousand(n) : rarer;
}
export const rarity = (L: Lang, p: number) => rarityOf(p, T.inHundred[L], T.inThousand[L], T.rarer[L]);

export function riddleOf(L: Lang, r: string[]) {
  const head = r.length > 4 ? `${r.slice(0, 3).join(", ")} ${T.andMore[L](T.morePoints[L](r.length - 3))}` : joinAnd(L, r);
  return `${cap(head)} — ${T.oneCard[L]}`;
}
export const riddle = (L: Lang, c: Link<string>) => riddleOf(L, roles(L, c.keys));

export const spheresOf = (L: Lang, keys: string[], spheres: (k: string) => string) =>
  joinAnd(L, [...new Set(keys.flatMap((k) => spheres(k).split("|")).filter(Boolean))]);
export const spheres = (L: Lang, c: Link<string>) => spheresOf(L, c.keys, (k) => T.points[L][k as Letter][2]);

// Lisovskaya's "add up the repeats": a sum that is not on the chart sounds only as a background
export function sumOf(L: Lang, c: Link<string>, name: (n: number) => string, onChart: (roles: string) => string, weak: string, rolesFor: (keys: string[]) => string[]) {
  const parts = c.k <= 4 ? Array(c.k).fill(c.n).join(" + ") : `${c.n} × ${c.k}`;
  const tail = c.sum === c.n ? T.sumSame[L] : c.sumAt.length ? onChart(joinAnd(L, rolesFor(c.sumAt))) : weak;
  return T.sumHead[L](parts, c.n * c.k, c.sum, name(c.sum)) + tail;
}
export const sumText = (L: Lang, c: Link<string>, name: (n: number) => string) =>
  sumOf(L, c, name, T.sumOnChart[L], T.sumWeak[L], (keys) => roles(L, keys));

export function sourceText(L: Lang, c: Link<string>) {
  const chapters = [T.chapter[L]("11"), ...c.rules.slice(0, 2).map((r) => r.ch)].filter((x, i, a) => a.indexOf(x) === i).join(", ");
  return T.source[L](chapters, c.sum !== c.n);
}

export function rarest(links: Link<string>[], rarityText: (p: number) => string): [string, string, number, number] | null {
  if (!links.length) return null;
  const rare = [...links].sort((a, b) => a.p - b.p)[0];
  return [formulaLabel(rare), rarityText(rare.p).replace(/ /g, "\u00a0"), links.filter((c) => c.p < 0.01).length, links.length];
}
export function countSub(L: Lang, links: Link<string>[]) {
  const r = rarest(links, (p) => rarity(L, p));
  return r ? T.countSub[L](...r) : "";
}

export function personalModel(L: Lang, v: Values): LinksModel {
  const links = linksOf(L, v);
  return {
    copy: { kicker: D.individualLanding.kicker[L], title: T.titleStart[L], sub: T.sub[L], section: T.section[L], chart: T.chart[L],
      moreText: T.moreText[L], sky: T.sky[L], earth: T.earth[L] },
    ages: true,
    values: v, links, nodes: [...ORDER.filter((k) => k !== "E"), "E"],
    role: (k) => role(L, k), place: (k) => place(L, k),
    formula: formulaLabel, riddle: (c) => riddle(L, c), rarity: (p) => rarity(L, p), spheres: (c) => spheres(L, c),
    explain: (c, name) => [sumText(L, c, name), ...c.rules.slice(0, 2).map((r) => r.t)],
    next: (c) => T.next[L](spheres(L, c)), source: (c) => sourceText(L, c),
    locked: (c) => T.locked[L](spheres(L, c)), lockedNote: (c) => T.lockedRules[L](c.rules.length),
    countTitle: (n, mine) => T.countTitle[L](n, mine), countSub: () => countSub(L, links),
  };
}
