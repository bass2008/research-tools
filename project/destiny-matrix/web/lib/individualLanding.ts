// Data of the Individual landing, taken from the sample personal reading of the page's language:
// its summary, findings and chapters. Page numbers estimate the A4 print of that reading.
import arcanaEn from "@/content/en/arcana.json";
import arcanaRu from "@/content/ru/arcana.json";
import { D } from "./i18n";
import type { Lang } from "./i18n/hosts";
import { CHAPTER_LABEL, type ChapterKind, type Finding, type IndividualReport, type ReportBlock, type TimelineItem } from "./individualReading";
import { individualExample } from "./individualExamples";
import { lettersOf, type Letter, type Values } from "./individualLinks";
import { calculate, type Matrix } from "./matrix";

export interface Mark { age: number; now?: boolean; n?: number }
export interface SummaryItem {
  text: string; points: Letter[]; cards: number[]; legend: string;
  off?: string[]; chains?: Letter[][]; marks?: Mark[]; dim?: boolean;
}
export interface ChapterExtra {
  list?: string[]; groups?: { h: string; items: string[] }[];
  timeline?: { age: string; arcanum: number; title: string; now?: boolean }[]; scene?: string;
}
export interface LandingChapter {
  kind: ChapterKind; label: string; h2: string; conclusion: string; cards: { n: number; label: string }[];
  action?: string; page: number; extra?: ChapterExtra;
}
export interface LandingFinding extends Finding { page: number }
export interface LandingData {
  birth: string; sample: string; values: Values; chakraTotals: [number, number, number];
  title: string; lead: string; pages: number;
  summary: SummaryItem[]; findings: LandingFinding[]; strength: number; chapters: LandingChapter[];
  faq: string[]; faqPage: number; notRecognized: { q: string; a: string };
  autoText: string;
}

// Which points each "main point in a minute" of the sample stands on; its caption is in
// `D.individualLanding.summaryLegends`. Follows the sample's summary item by item.
const SUMMARY_MAP: Pick<SummaryItem, "points" | "cards" | "chains" | "marks" | "dim">[] = [
  { points: ["B", "P", "H"], cards: [8] },
  { points: ["A", "E"], cards: [12, 10] },
  { points: ["G"], cards: [11], marks: [{ age: 34, now: true }] },
  { points: ["R2", "D", "R"], chains: [["R2", "D"]], cards: [5, 19] },
  { points: ["M", "R1", "R"], cards: [15, 7, 19] },
  { points: ["F", "G", "H", "I", "L", "J", "R", "E"], chains: [["F", "L"], ["G", "J"], ["H", "R"], ["I", "E"]], cards: [4, 22, 19, 10] },
  { points: [], dim: true, cards: [5, 8], marks: [{ age: 34, now: true }, { age: 35, n: 5 }, { age: 37.5, n: 8 }] },
];

// The A4 print of the Russian sample has 63 pages for its 14,572 words.
const WORDS_PER_PAGE = 231;
const words = (o: unknown): number => typeof o === "string" ? (o.match(/[\p{L}\p{N}]+/gu) ?? []).length
  : Array.isArray(o) ? o.reduce((s: number, x) => s + words(x), 0)
  : o && typeof o === "object" ? Object.entries(o).reduce((s, [k, v]) => s + (k === "url" ? 0 : words(v)), 0) : 0;
const pageAt = (w: number) => 1 + Math.floor(w / WORDS_PER_PAGE);

const strings = (blocks: ReportBlock[]) => blocks.filter((b): b is string => typeof b === "string");
function h3Index(blocks: ReportBlock[]) {
  return blocks.map((b, i) => [b, i] as const).filter(([b]) => typeof b === "object" && b !== null && "h3" in b)
    .map(([b, i]) => ({ h: String((b as { h3: string }).h3), next: blocks[i + 1] }));
}
const listOf = (b: ReportBlock | undefined): string[] =>
  typeof b === "string" ? [b] : b && typeof b === "object" && "ul" in b ? (b as { ul: string[] }).ul : [];

export function landingData(L: Lang): LandingData {
  const row = individualExample("personal", L)!;
  const art = row.article as IndividualReport;
  const en = L === "en";
  const birth = String(row.inputs.birth);
  const m = calculate(birth, (row.inputs.sex as Matrix["sex"]) ?? "f");
  const values = lettersOf(m);

  let cursor = words([art.title, art.lead, art.summary]);
  const findings: LandingFinding[] = [];
  const chapters: LandingChapter[] = art.chapters.map((c) => {
    const page = pageAt(cursor);
    if (c.kind === "findings") {
      let inner = cursor + words([c.h2, c.conclusion]);
      for (const b of c.blocks) {
        if (typeof b === "object" && b && "finding" in b) findings.push({ ...b.finding, page: pageAt(inner) });
        inner += words(b);
      }
    }
    cursor += words(c);
    const h3 = h3Index(c.blocks);
    let extra: ChapterExtra | undefined;
    if (c.kind === "close" && h3.length > 3) extra = { groups: [h3[1], h3[3]].map((g) => ({ h: g.h, items: listOf(g.next).slice(0, 2) })) };
    if (c.kind === "plan" && h3.length > 3) extra = { groups: [h3[1], h3[2], h3[3]].map((g, i) => ({ h: g.h, items: listOf(g.next).slice(0, i ? 3 : 1) })) };
    if (c.kind === "time") {
      const tl = c.blocks.find((b): b is { timeline: TimelineItem[] } => typeof b === "object" && b !== null && "timeline" in b);
      if (tl) extra = { timeline: tl.timeline.map(({ age, arcanum, title, now }) => ({ age, arcanum, title, now })) };
    }
    if (c.kind === "character") {
      const scene = strings(c.blocks).find((s) => /^(Сцена|A scene)/.test(s));
      if (scene) extra = { scene };
    }
    return {
      kind: c.kind, label: CHAPTER_LABEL[c.kind][en ? 1 : 0], h2: c.h2, conclusion: c.conclusion,
      cards: (c.cards ?? []).map((x) => ({ n: x.arcanum, label: x.label })), action: c.actions?.[0], page, extra,
    };
  });
  const byKind = Object.fromEntries(chapters.map((c) => [c.kind, c]));
  if (byKind.findings) byKind.findings.extra = { list: findings.map((f) => f.title) };
  const faq = art.faq ?? [];
  const faqPage = pageAt(cursor);
  cursor += words(faq);
  const nr = faq.find((q) => /узна|recogni/i.test(q.q)) ?? faq[0];
  const strength = Math.max(0, findings.findIndex((f) => /сила рода|strength of your family/i.test(f.title)));
  const arcana = (en ? arcanaEn : arcanaRu) as unknown as { items: { in_positions: Record<string, string> }[] };
  const auto = arcana.items[values.G - 1]?.in_positions.mother_line ?? "";
  const ct = m.chakra_totals;

  return {
    birth, sample: birth.split("-").reverse().join("."), values, chakraTotals: [ct.physics, ct.energy, ct.emotions],
    title: art.title, lead: art.lead, pages: pageAt(cursor),
    summary: art.summary.map((text, i) => {
      const [legend, off] = D.individualLanding.summaryLegends[L][i] ?? ["", []];
      return { ...(SUMMARY_MAP[i] ?? { points: [], cards: [] }), text, legend, off };
    }),
    findings, strength, chapters, faq: faq.map((q) => q.q), faqPage,
    notRecognized: { q: nr?.q ?? "", a: typeof nr?.a[0] === "string" ? nr.a[0] : "" },
    autoText: auto.split(" · ").slice(2).join(" · "),
  };
}
