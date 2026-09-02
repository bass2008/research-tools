// Strict server-side reader for generated encyclopedia content. Missing or malformed canonical
// data is a failed build, never a reason to publish a second embedded version of an article.
import fs from "node:fs";
import path from "node:path";

import type { Matrix } from "./matrix";
import { isBlockedText } from "./textPolicy";

const DIR = path.join(process.cwd(), "content");

type Bag = Record<string, unknown>;

let rejected = 0;

function safe(text: string): boolean {
  if (isBlockedText(text)) {
    rejected++;
    return false;
  }
  return true;
}

function readItems(file: string): Bag[] {
  try {
    const raw = fs.readFileSync(path.join(DIR, file), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const items = (parsed as { items?: unknown })?.items ?? parsed;
    if (!Array.isArray(items)) throw new Error("корень должен содержать массив items");
    const count = (parsed as { count?: unknown })?.count;
    if (typeof count === "number" && count !== items.length) {
      throw new Error(`count=${count}, фактически ${items.length}`);
    }
    return items as Bag[];
  } catch (error) {
    throw new Error(`[content] не удалось загрузить ${file}: ${String(error)}`, { cause: error });
  }
}

function strings(v: unknown, min = 1): string[] | null {
  if (!Array.isArray(v) || v.length < min) return null;
  if (!v.every((value) => typeof value === "string" && value.trim().length > 20 && safe(value))) {
    return null;
  }
  return v as string[];
}

function stringMap(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Bag)) {
    if (typeof val !== "string") continue;
    if (!val.trim() || !safe(val)) return null;
    out[k] = val;
  }
  return Object.keys(out).length ? out : null;
}

function seoOf(v: unknown): { title: string; description: string } | null {
  const m = stringMap(v);
  if (!m?.title || !m?.description) return null;
  if (m.title.length < 10 || m.description.length < 60) return null;
  if (!safe(m.title) || !safe(m.description)) return null;
  return { title: m.title, description: m.description };
}

export interface Section {
  h2: string;
  paragraphs: string[];
}

export interface QA {
  q: string;
  a: string;
}

function sectionsOf(v: unknown): Section[] | null {
  if (!Array.isArray(v)) return null;
  const out: Section[] = [];
  for (const raw of v as Bag[]) {
    const h2 = typeof raw?.h2 === "string" ? raw.h2.trim() : "";
    const paragraphs = strings(raw?.paragraphs, 1);
    if (h2 && safe(h2) && paragraphs) out.push({ h2, paragraphs });
  }
  return out.length ? out : null;
}

function faqOf(v: unknown): QA[] | null {
  if (!Array.isArray(v)) return null;
  const out: QA[] = [];
  for (const raw of v as Bag[]) {
    const q = typeof raw?.q === "string" ? raw.q.trim() : "";
    const a = typeof raw?.a === "string" ? raw.a.trim() : "";
    // короткий ответ в FAQPage бесполезен и поиску, и человеку
    if (q.length > 8 && a.length > 40 && safe(q) && safe(a)) out.push({ q, a });
  }
  return out.length ? out : null;
}

function numbers(v: unknown): number[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.filter((x): x is number => typeof x === "number" && x >= 1 && x <= 22);
  return out.length ? out : null;
}

// Указатель связи: ключ статьи («energii», «18-9-9») либо путь вида «arcanum/7»,
// «position/center», «na-god/8». Слэш разрешён обязательно: без него терялись все связи, кроме
// внутрикатегорийных, — у шапки «на год» из двенадцати оставалась одна.
function keys(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.filter(
    (x): x is string => typeof x === "string" && /^[\w-]{1,40}(\/[\w-]{1,40})?$/.test(x),
  );
  return out.length ? out : null;
}

/** Статья категории по схеме `article-requirements.md` D2: проза в полях, связи — списком ключей. */
export interface ArticleContent {
  key: string;
  title: string;
  seo: { title: string; description: string; queries: string[] };
  short: string;
  sections: Section[];
  faq: QA[];
  related: string[];
  arcana: number[];
  entityType?: string;
  crumb?: string;
  order?: number;
  publication: {
    index: boolean;
    follow: boolean;
    primaryQuery: string | null;
    exactFrequency: number | null;
    reviewedAt: string | null;
  };
}

// Статья попадает на сайт целиком или не попадает вовсе: половина полей — это страница без
// первого экрана или без текста, а такую лучше не публиковать, чем публиковать пустой шаблон.
function articleOf(raw: Bag, keyField: string): ArticleContent {
  const key = raw[keyField];
  const id = typeof key === "number" ? String(key) : typeof key === "string" ? key.trim() : "";
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const seo = seoOf(raw.seo);
  const short = typeof raw.short === "string" ? raw.short.trim() : "";
  const sections = sectionsOf(raw.sections);
  if (!id || !title || !seo || short.length < 60 || !sections) {
    throw new Error(`[content] статья ${id || "без ключа"} не прошла обязательную схему`);
  }
  if (!safe(title) || !safe(short)) {
    throw new Error(`[content] статья ${id} содержит запрещённую лексику`);
  }
  // queries уходят в keywords разметки, то есть публикуются: гигиена им нужна такая же, как
  // прозе, иначе медицинская формулировка обходит фильтр через поле «поисковые запросы»
  const queries = Array.isArray((raw.seo as Bag | undefined)?.queries)
    ? ((raw.seo as Bag).queries as unknown[]).filter(
        (x): x is string => typeof x === "string" && safe(x),
      )
    : [];
  const publicationRaw =
    raw.publication && typeof raw.publication === "object" && !Array.isArray(raw.publication)
      ? (raw.publication as Bag)
      : null;
  return {
    key: id,
    title,
    seo: { ...seo, queries },
    short,
    sections,
    faq: faqOf(raw.faq) ?? [],
    related: keys(raw.related) ?? [],
    arcana: numbers(raw.arcana) ?? [],
    entityType: typeof raw.entity_type === "string" ? raw.entity_type : undefined,
    crumb: typeof raw.crumb === "string" && raw.crumb.trim() ? raw.crumb.trim() : undefined,
    order: typeof raw.order === "number" ? raw.order : undefined,
    publication: {
      // Старые категории до переезда на publication-registry остаются индексируемыми. Для
      // хвостов поле обязательно проверяет build-content.py, поэтому fallback здесь их не
      // маскирует.
      index: typeof publicationRaw?.index === "boolean" ? publicationRaw.index : true,
      follow: typeof publicationRaw?.follow === "boolean" ? publicationRaw.follow : true,
      primaryQuery:
        typeof publicationRaw?.primary_query === "string" ? publicationRaw.primary_query : null,
      exactFrequency:
        typeof publicationRaw?.exact_frequency === "number"
          ? publicationRaw.exact_frequency
          : null,
      reviewedAt:
        typeof publicationRaw?.reviewed_at === "string" ? publicationRaw.reviewed_at : null,
    },
  };
}

function articles(file: string, keyField = "key"): Map<string, ArticleContent> {
  const m = new Map<string, ArticleContent>();
  for (const raw of readItems(file)) {
    const item = articleOf(raw, keyField);
    if (m.has(item.key)) throw new Error(`[content] ${file}: повтор ключа ${item.key}`);
    m.set(item.key, item);
  }
  return m;
}

function index<K extends string | number>(items: Bag[], key: string): Map<K, Bag> {
  const m = new Map<K, Bag>();
  for (const it of items) {
    const k = it[key];
    if (typeof k !== "string" && typeof k !== "number") {
      throw new Error(`[content] запись без ключа ${key}`);
    }
    if (m.has(k as K)) throw new Error(`[content] повтор ключа ${String(k)}`);
    m.set(k as K, it);
  }
  return m;
}

const ARCANA_JSON = index<number>(readItems("arcana.json"), "n");
const POSITIONS_JSON = index<string>(readItems("positions.json"), "key");
const CHAKRAS_JSON = index<string>(readItems("chakras.json"), "key");
const COMBINATIONS_JSON = (() => {
  const items = readItems("combinations.json");
  const m = new Map<string, Bag>();
  for (const it of items) {
    const slug =
      typeof it.slug === "string"
        ? it.slug
        : typeof it.a === "number" && typeof it.b === "number"
          ? `${Math.min(it.a, it.b)}-${Math.max(it.a, it.b)}`
          : null;
    if (slug) m.set(slug, it);
  }
  return m;
})();

/* ── новые категории: тройки-хвосты, «аркан на год», концепт-хабы ── */

const KARMIC_TAILS = articles("karmic-tails.json");
// шапки категорий («что такое кармический хвост», «что такое матрица на год») лежат отдельно
// от корневых хабов: у них свой адрес внутри категории, а не слаг первого уровня
const CATEGORY_HUBS = articles("category-hubs.json");
const YEAR_ARCANA = articles("year-arcana.json", "n");
const HUBS = articles("hubs.json");

for (const [name, actual, expected] of [
  ["arcana.json", ARCANA_JSON.size, 22],
  ["positions.json", POSITIONS_JSON.size, 37],
  ["chakras.json", CHAKRAS_JSON.size, 7],
  ["combinations.json", COMBINATIONS_JSON.size, 231],
  ["karmic-tails.json", KARMIC_TAILS.size, 26],
  ["year-arcana.json", YEAR_ARCANA.size, 23],
  ["category-hubs.json", CATEGORY_HUBS.size, 2],
  ["hubs.json", HUBS.size, 5],
] as const) {
  if (actual !== expected) throw new Error(`[content] ${name}: ожидалось ${expected}, получено ${actual}`);
}

export function karmicTail(key: string): ArticleContent | null {
  return KARMIC_TAILS.get(key) ?? null;
}

export function karmicTailKeys(): string[] {
  return [...KARMIC_TAILS.keys()];
}

export function indexedKarmicTailKeys(): string[] {
  return [...KARMIC_TAILS.values()].filter((item) => item.publication.index).map((item) => item.key);
}

export function karmicTails(): ArticleContent[] {
  return [...KARMIC_TAILS.values()];
}

// В одном файле лежат и «N на год» (ключ 1…22), и год-штамп «на 2026» (ключ 2026): у них общий
// шаблон и общий адрес /na-god/<ключ>, различается только подача.
export function yearArcanum(key: string | number): ArticleContent | null {
  return YEAR_ARCANA.get(String(key)) ?? null;
}

export function yearKeys(): string[] {
  return [...YEAR_ARCANA.keys()];
}

export function categoryHub(key: string): ArticleContent | null {
  return CATEGORY_HUBS.get(key) ?? null;
}

export function hub(key: string): ArticleContent | null {
  return HUBS.get(key) ?? null;
}

export function hubKeys(): string[] {
  return [...HUBS.values()]
    .sort((a, b) => {
      if (a.order === undefined || b.order === undefined) {
        throw new Error(`[content] у хаба ${a.order === undefined ? a.key : b.key} нет order`);
      }
      return a.order - b.order;
    })
    .map((item) => item.key);
}

export interface ArcanumContent {
  n: number;
  slug: string;
  title: string;
  roman: string;
  short: string;
  keywords: string[];
  meaning: string[];
  inPositions: Record<string, string>;
  plus: string[];
  minus: string[];
  /** Что даёт удвоение темы, когда один аркан стоит сразу в двух ролях раздела. */
  repeat: string;
  combinations: Array<{ with: number; title: string; href: string; short: string }>;
  seo: { title: string; description: string };
  sections: Section[];
  faq: QA[];
}

export function arcanumContent(n: number): ArcanumContent | null {
  const raw = ARCANA_JSON.get(n);
  if (!raw) return null;
  const title = typeof raw.title === "string" && safe(raw.title) ? raw.title : null;
  const slug = typeof raw.slug === "string" ? raw.slug : null;
  const roman = typeof raw.roman === "string" ? raw.roman : null;
  const short = typeof raw.short === "string" && raw.short.length > 10 && safe(raw.short) ? raw.short : null;
  const keywords = Array.isArray(raw.keywords)
    ? raw.keywords.filter((value): value is string => typeof value === "string" && value.length > 1)
    : [];
  const meaning = strings(raw.meaning, 3);
  const inPositions = stringMap(raw.in_positions);
  const plus = Array.isArray(raw.plus) ? raw.plus.filter((value): value is string => typeof value === "string") : [];
  const minus = Array.isArray(raw.minus) ? raw.minus.filter((value): value is string => typeof value === "string") : [];
  const repeat = typeof raw.repeat === "string" ? raw.repeat : "";
  const seo = seoOf(raw.seo);
  const combinations = Array.isArray(raw.combinations)
    ? (raw.combinations as Bag[]).map((item) => ({
        with: item.with,
        title: item.title,
        href: item.href,
        short: item.short,
      }))
    : [];
  const validCombinations = combinations.every(
    (item) =>
      typeof item.with === "number" &&
      typeof item.title === "string" &&
      typeof item.href === "string" &&
      typeof item.short === "string" &&
      safe(item.title) &&
      safe(item.short),
  );
  if (
    raw.n !== n ||
    !title ||
    !slug ||
    !roman ||
    !short ||
    keywords.length < 3 ||
    !keywords.every(safe) ||
    !meaning ||
    !inPositions ||
    Object.keys(inPositions).length !== 37 ||
    plus.length < 3 ||
    !plus.every(safe) ||
    minus.length < 3 ||
    !minus.every(safe) ||
    repeat.length < 200 ||
    combinations.length !== 21 ||
    !validCombinations ||
    !seo
  ) {
    throw new Error(`[content] аркан ${n} не прошёл обязательную схему`);
  }
  return {
    n,
    slug,
    title,
    roman,
    short,
    keywords,
    meaning,
    inPositions,
    plus,
    minus,
    repeat,
    combinations: combinations as ArcanumContent["combinations"],
    seo,
    sections: sectionsOf(raw.sections) ?? [],
    faq: faqOf(raw.faq) ?? [],
  };
}

export interface PositionContent {
  key: string;
  kind: "section" | "point";
  title: string;
  lead: string;
  formula: string;
  meaning: string[];
  reading: string;
  seo: { title: string; description: string };
  sections: Section[];
  faq: QA[];
  points: Array<{ key: string; title: string }>;
  /** Связанные материалы раздела: у «Карты энергий» это семь статей уровней. */
  links: Array<{ label: string; href: string }>;
}

export function positionContent(key: string): PositionContent | null {
  const raw = POSITIONS_JSON.get(key);
  if (!raw) return null;
  const kind = raw.kind === "section" || raw.kind === "point" ? raw.kind : null;
  const title = typeof raw.title === "string" && safe(raw.title) ? raw.title : null;
  const lead = typeof raw.lead === "string" && raw.lead.length > 20 && safe(raw.lead) ? raw.lead : null;
  const formula = typeof raw.formula === "string" && raw.formula.length > 5 && safe(raw.formula) ? raw.formula : null;
  const meaning = strings(raw.meaning, 2);
  const reading = typeof raw.reading === "string" && raw.reading.length > 40 && safe(raw.reading) ? raw.reading : null;
  const seo = seoOf(raw.seo);
  const points = Array.isArray(raw.points)
    ? (raw.points as Bag[]).map((point) => ({
        key: typeof point.key === "string" ? point.key : "",
        title: typeof point.title === "string" ? point.title.trim() : "",
        href: typeof point.href === "string" ? point.href : "",
      }))
    : [];
  const validPoints = points.every(
    (point) =>
      point.key &&
      point.title &&
      safe(point.title) &&
      point.href === `/encyclopedia/position/${point.key}` &&
      POSITIONS_JSON.get(point.key)?.kind === "point",
  );
  if (
    raw.key !== key ||
    !kind ||
    !title ||
    !lead ||
    !formula ||
    !meaning ||
    !reading ||
    !seo ||
    !validPoints ||
    (kind === "point" && points.length !== 0)
  ) {
    throw new Error(`[content] позиция ${key} не прошла обязательную схему`);
  }
  return {
    key,
    kind,
    title,
    lead,
    formula,
    meaning,
    reading,
    seo,
    sections: sectionsOf(raw.article_sections) ?? [],
    faq: faqOf(raw.faq) ?? [],
    points: points.map(({ key: pointKey, title: pointTitle }) => ({
      key: pointKey,
      title: pointTitle,
    })),
    links: Array.isArray(raw.links)
      ? (raw.links as Bag[]).flatMap((link) => {
          const label = typeof link.label === "string" ? link.label.trim() : "";
          const href = typeof link.href === "string" ? link.href : "";
          return label && safe(label) && href.startsWith("/encyclopedia/")
            ? [{ label, href }]
            : [];
        })
      : [],
  };
}

export interface ChakraContent {
  key: string;
  title: string;
  hint: string;
  level: string[];
  columns: Array<{ key: string; title: string; text: string }>;
  seo: { title: string; description: string };
}

export function chakraContent(key: string): ChakraContent | null {
  const raw = CHAKRAS_JSON.get(key);
  if (!raw) return null;
  const level = strings(raw.level, 1);
  const columns = Array.isArray(raw.columns)
    ? (raw.columns as Bag[]).map((column) => ({
        key: String(column.key ?? ""),
        title: String(column.title ?? ""),
        text: String(column.text ?? ""),
      }))
    : [];
  const seo = seoOf(raw.seo);
  const title = typeof raw.title === "string" && safe(raw.title) ? raw.title : null;
  const hint = typeof raw.hint === "string" && safe(raw.hint) ? raw.hint : null;
  if (
    raw.key !== key ||
    !title ||
    !hint ||
    !level ||
    columns.length !== 3 ||
    !columns.every((column) => column.key && column.title && column.text.length > 40 && safe(column.title) && safe(column.text)) ||
    !seo
  ) {
    throw new Error(`[content] чакра ${key} не прошла обязательную схему`);
  }
  return { key, title, hint, level, columns, seo };
}

export interface CombinationContent {
  a: number;
  b: number;
  key: string;
  title: string;
  short: string;
  meaning: string[];
  seo: { title: string; description: string };
}

export function combinationContent(slug: string): CombinationContent | null {
  const raw = COMBINATIONS_JSON.get(slug);
  if (!raw) return null;
  const title = typeof raw.title === "string" && raw.title.length > 4 && safe(raw.title) ? raw.title : null;
  const short = typeof raw.short === "string" && raw.short.length > 10 && safe(raw.short) ? raw.short : null;
  const meaning = strings(raw.paragraphs, 2);
  const seo = seoOf(raw.seo);
  if (
    typeof raw.a !== "number" ||
    typeof raw.b !== "number" ||
    raw.key !== slug ||
    !title ||
    !short ||
    !meaning ||
    !seo
  ) {
    throw new Error(`[content] сочетание ${slug} не прошло обязательную схему`);
  }
  return { a: raw.a, b: raw.b, key: slug, title, short, meaning, seo };
}

/** Текст «аркан n в позиции key» существует только в каноническом собранном корпусе. */
export function arcanumInPosition(n: number, key: string): string {
  const generated = arcanumContent(n)?.inPositions[key];
  if (!generated || generated.length <= 40) {
    throw new Error(`[content] нет трактовки аркана ${n} в позиции ${key}`);
  }
  return generated;
}

/* ── матрицы: 5544 тройки (день, месяц, год) из engine/precompute.py ── */

export interface MatrixItem {
  slug: string;
  day: number;
  month: number;
  year: number;
  matrix: Matrix;
  arcana: number[];
}

// 11 МБ JSON: читается один раз на процесс и только когда его действительно спросили,
// чтобы страницы энциклопедии не платили за файл, который им не нужен.
let MATRICES: Map<string, MatrixItem> | null = null;

function matrices(): Map<string, MatrixItem> {
  if (MATRICES) return MATRICES;
  const m = new Map<string, MatrixItem>();
  for (const raw of readItems("matrices.json")) {
    const it = raw as unknown as MatrixItem;
    if (typeof it.slug === "string" && it.matrix && typeof it.matrix.center === "number") {
      m.set(it.slug, it);
    }
  }
  MATRICES = m;
  return m;
}

export function matrixSlugs(): string[] {
  return [...matrices().keys()];
}

export function matrixItem(slug: string): MatrixItem | null {
  return matrices().get(slug) ?? null;
}

export function matrixCount(): number {
  return matrices().size;
}

/** Сколько записей реально подхватилось — для отчёта сборки и тестов. */
export function contentStats() {
  return {
    arcana: ARCANA_JSON.size,
    positions: POSITIONS_JSON.size,
    chakras: CHAKRAS_JSON.size,
    combinations: COMBINATIONS_JSON.size,
    karmicTails: KARMIC_TAILS.size,
    yearArcana: YEAR_ARCANA.size,
    categoryHubs: CATEGORY_HUBS.size,
    hubs: HUBS.size,
    rejected,
  };
}
