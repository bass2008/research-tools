import type { Lang } from "./i18n/hosts";
import type { SectionOut } from "./publicSpec";

/** Version 1 is additive: installed applications must keep understanding these blocks. */
export type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string; level: 2 | 3 }
  | { type: "list"; items: string[]; ordered: boolean }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "link"; label: string; href: string }
  | { type: "matrix"; points: Record<string, number>; highlight: string[] }
  | { type: "cards"; cards: Array<{ arcanum: number; label: string; href?: string }> };

export interface MobileArticle {
  schemaVersion: 1;
  path: string;
  locale: Lang;
  title: string;
  lead: string;
  breadcrumbs: Array<{ label: string; href?: string }>;
  blocks: ContentBlock[];
  access: "public" | "locked" | "private";
  accessUntil: string | null;
}

export interface MobileSections { schemaVersion: 1; sections: SectionOut[] }

const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === "string");
const link = (v: unknown): boolean => record(v) && typeof v.label === "string" && (v.href === undefined || typeof v.href === "string");
const arcanum = (v: unknown): boolean => Number.isInteger(v) && Number(v) >= 1 && Number(v) <= 22;

export function isContentBlock(value: unknown): value is ContentBlock {
  if (!record(value)) return false;
  switch (value.type) {
    case "paragraph": return typeof value.text === "string";
    case "heading": return typeof value.text === "string" && (value.level === 2 || value.level === 3);
    case "list": return strings(value.items) && typeof value.ordered === "boolean";
    case "table": return strings(value.head) && Array.isArray(value.rows) && value.rows.every(strings);
    case "link": return link(value) && typeof value.href === "string";
    case "matrix": return record(value.points) && Object.values(value.points).every(arcanum) && strings(value.highlight);
    case "cards": return Array.isArray(value.cards) && value.cards.every((c) => link(c) && record(c) && arcanum(c.arcanum));
    default: return false;
  }
}

export function isMobileArticle(value: unknown): value is MobileArticle {
  return record(value) && value.schemaVersion === 1 && typeof value.path === "string"
    && (value.locale === "ru" || value.locale === "en") && typeof value.title === "string"
    && typeof value.lead === "string" && Array.isArray(value.breadcrumbs) && value.breadcrumbs.every(link)
    && Array.isArray(value.blocks) && value.blocks.every(isContentBlock)
    && ["public", "locked", "private"].includes(String(value.access))
    && (value.accessUntil === null || (typeof value.accessUntil === "string" && Number.isFinite(Date.parse(value.accessUntil))));
}

export function isMobileSections(value: unknown): value is MobileSections {
  return record(value) && value.schemaVersion === 1 && Array.isArray(value.sections)
    && value.sections.every((s) => record(s) && typeof s.key === "string" && typeof s.title === "string"
      && typeof s.lead === "string" && (s.access === "free" || s.access === "paid")
      && (s.locked === undefined || typeof s.locked === "boolean") && Array.isArray(s.positions)
      && s.positions.every((p) => link(p) && record(p) && arcanum(p.arcanum) && typeof p.href === "string"
        && (p.text === undefined || typeof p.text === "string") && (p.role === undefined || readingRole(p.role))
        && (p.article === undefined || link(p.article)))
      && (s.personalHref === undefined || typeof s.personalHref === "string")
      && (s.conclusion === undefined || conclusion(s.conclusion))
      && (s.longform === undefined || longform(s.longform))
      && (s.tripleReading === undefined || chakraRow(s.tripleReading))
      && (s.tailReading === undefined || (record(s.tailReading) && Array.isArray(s.tailReading.paragraphs)
        && s.tailReading.paragraphs.every(corpusParagraph))));
}

function stringFields(v: unknown, keys: string[]): v is Record<string, unknown> {
  return record(v) && keys.every((key) => typeof v[key] === "string");
}
function roleParts(v: unknown): boolean { return stringFields(v, ["essence", "strength", "risk", "action"]); }
function conclusion(v: unknown): boolean { return stringFields(v, ["summary", "strength", "tension", "practice"]); }
function readingRole(v: unknown): boolean {
  return stringFields(v, ["key", "label", "question", "title"]) && arcanum(v.arcanum) && roleParts(v)
    && (v.sameAs === undefined || stringFields(v.sameAs, ["key", "label"]));
}
function chakraRow(v: unknown): boolean {
  return stringFields(v, ["key", "title", "topic", "heading"]) && strings(v.paragraphs) && Array.isArray(v.cells)
    && v.cells.every((cell) => stringFields(cell, ["column", "title", "caption"]) && arcanum(cell.arcanum));
}
function corpusParagraph(v: unknown): boolean {
  if (typeof v === "string") return true;
  if (!record(v)) return false;
  if (typeof v.h3 === "string" || strings(v.ul) || strings(v.ol)) return true;
  if (record(v.table) && strings(v.table.head) && Array.isArray(v.table.rows) && v.table.rows.every(strings)) return true;
  if (v.slot === "calc" || v.slot === "pair") return true;
  return record(v.chakra_reading) && chakraRow(v.chakra_reading.row);
}
function longform(v: unknown): boolean {
  return stringFields(v, ["slug", "title", "lead", "rolesTitle", "rolesLead", "interactionsTitle", "interactionsLead", "testId"])
    && conclusion(v) && Array.isArray(v.roles) && v.roles.every(readingRole)
    && Array.isArray(v.interactions) && v.interactions.every((i) => stringFields(i, ["key", "title"])
      && strings(i.roles) && strings(i.paragraphs) && (i.href === undefined || typeof i.href === "string")
      && (i.linkLabel === undefined || typeof i.linkLabel === "string"))
    && (v.chakraRows === undefined || (Array.isArray(v.chakraRows) && v.chakraRows.every(chakraRow)))
    && (v.energyField === undefined || chakraRow(v.energyField))
    && (v.agePeriods === undefined || (Array.isArray(v.agePeriods) && v.agePeriods.every((p) => stringFields(p, ["title"])
      && roleParts(p) && arcanum(p.arcanum) && typeof p.from === "number" && typeof p.to === "number"
      && typeof p.current === "boolean" && typeof p.next === "boolean")));
}
