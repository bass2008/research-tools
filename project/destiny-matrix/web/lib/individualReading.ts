import type { Paragraph, Section } from "./contentReader";
import type { Lang } from "./i18n/lang";

export const INDIVIDUAL_KINDS = {
  personal: { ru: "Личный разбор", en: "Personal reading", product: "personal" },
  pair: { ru: "Совместимость пары", en: "Couple compatibility", product: "pair" },
} as const;
export type IndividualKind = keyof typeof INDIVIDUAL_KINDS;

export interface IndividualCard { arcanum: number; label: string; caption: string; points?: string[] }
export interface IndividualSource { title: string; url: string; note: string }
export interface IndividualChakraBlock { chakra: string }
export interface IndividualSection extends Omit<Section, "paragraphs"> {
  paragraphs: (Paragraph | IndividualChakraBlock)[]; cards?: IndividualCard[]; sources?: IndividualSource[];
}
export interface IndividualArticle { version?: undefined; title: string; lead: string; sections: IndividualSection[] }

export type FormulaOperator = "+" | "=" | "↔" | "→";
export interface FormulaItem { arcanum: number; label: string; points?: string[] }
export interface Formula { items: (FormulaItem | FormulaOperator)[]; caption?: string }
export interface Finding { title: string; formula?: Formula | null; text: string[]; action?: string }
export interface TimelineItem { age: string; arcanum: number; title: string; text: string; now?: boolean }
export interface SelfCheckItem { arcanum: number; label: string; points?: string[]; plus: string[]; minus: string[] }
export type ReportBlock = Paragraph | IndividualChakraBlock | { formula: Formula } | { finding: Finding }
  | { timeline: TimelineItem[] } | { selfcheck: SelfCheckItem[] } | { insert: "chakras" | "karmic_tail" };
export type ChapterKind = "key" | "findings" | "character" | "talents" | "money" | "relations" | "family" | "karma"
  | "body" | "chakras" | "zodiac" | "close" | "time" | "selfcheck" | "plan" | "year" | "quarter" | "month" | "other";
export const CHAPTER_LABEL: Record<ChapterKind, [string, string]> = {
  key: ["Ключ матрицы", "The key"],
  findings: ["Чего нет в автоматическом разборе", "Beyond the automatic reading"],
  character: ["Характер", "Character"],
  talents: ["Таланты и дело", "Talents and work"],
  money: ["Деньги", "Money"],
  relations: ["Отношения", "Relationships"],
  family: ["Род и семья", "Family"],
  karma: ["Кармический хвост", "Karmic tail"],
  body: ["Тело и отдых", "Body and rest"],
  chakras: ["Чакры", "Chakras"],
  zodiac: ["Знак в Таро", "Your sign in the Tarot"],
  close: ["Для близких", "For those close to you"],
  time: ["Время", "Timeline"],
  selfcheck: ["Самопроверка", "Self-check"],
  plan: ["План", "Plan"],
  year: ["Матрица года", "The year matrix"],
  quarter: ["Периоды года", "Periods of the year"],
  month: ["Месяц", "Month"],
  other: ["Глава", "Chapter"],
};
export interface ReportChapter {
  kind: ChapterKind; h2: string; conclusion: string; cards?: IndividualCard[]; blocks: ReportBlock[]; actions?: string[];
}
export interface ReportQuestion { q: string; a: Paragraph[] }
export interface IndividualReport {
  version: 2; title: string; lead: string; summary: string[]; chapters: ReportChapter[];
  faq?: ReportQuestion[]; sources?: IndividualSource[];
}
export interface ReportInserts {
  chakras?: import("./readingTypes").LongformReading;
  karmic_tail?: { title?: string | null; paragraphs: Paragraph[] };
}
export interface IndividualReading {
  id: number; kind: IndividualKind; product: "personal" | "pair"; inputs: Record<string, unknown>;
  year: number | null; matrix?: import("./matrix").Matrix | import("./pair/engine").PairResult;
  locale: Lang; status: "pending" | "review" | "done"; title: string | null;
  created_at: string; approved_at: string | null; href: string;
  email?: string; comment?: string; automatic_reading?: unknown;
  article?: IndividualArticle | IndividualReport | null; inserts?: ReportInserts;
  email_errors?: number; can_pdf?: boolean;
  example?: string;
}
export interface IndividualPage { items: IndividualReading[]; total: number; page: number; page_size: number }
export interface IndividualRequest {
  year: number | null; product: "personal" | "pair";
  userId: number; kind: IndividualKind; inputs: Record<string, unknown>; locale: Lang; comment: string;
}

export function individualKind(row: Pick<IndividualReading, "kind" | "year">, L: Lang): string {
  return row.year ? (L === "en" ? `Year ${row.year}` : `Год ${row.year}`) : INDIVIDUAL_KINDS[row.kind]?.[L] ?? String(row.kind);
}

export function individualDates(row: IndividualReading, birthLabel: (birth: string) => string): string {
  const inputs = row.inputs as { birth?: string; a?: { birth?: string }; b?: { birth?: string } };
  if (inputs.birth) return birthLabel(inputs.birth);
  return inputs.a?.birth && inputs.b?.birth ? `${birthLabel(inputs.a.birth)} + ${birthLabel(inputs.b.birth)}` : "";
}
