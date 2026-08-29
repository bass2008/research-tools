// Чтение сгенерированного контента энциклопедии из web/content на сборке.
// Файлы пишет генератор (content/encyclopedia), и он может быть не готов или писать
// прямо во время сборки — поэтому загрузка терпимая: любая проблема означает
// «берём встроенный корпус», а не падение сборки.
import fs from "node:fs";
import path from "node:path";

import { builtInPositionText } from "./positionTexts";
import type { Matrix } from "./matrix";

const DIR = path.join(process.cwd(), "content");

type Bag = Record<string, unknown>;

// Гигиена текста. Реклама гадания разрешена без документов, а народная медицина и
// целительство требуют разрешения органа власти субъекта РФ — получить его невозможно.
// Поэтому любое поле с медицинской лексикой отбрасывается целиком, даже если оно
// пришло из генератора и даже если слово стоит в отрицании: приёмка ловит грепом,
// а не смыслом. Отброшенное поле заменяется встроенным корпусом.
// Границы корня обязательны: без них «влечение» и «развлечения» ловились как «лечение», и
// вместе с ними отбрасывались целые статьи — на страницу вставала встроенная заглушка.
// `\b` в JS кириллицу не знает, поэтому граница задана явно. Тот же список, что в
// content/validate.py: расхождение означало бы, что приёмка и показ проверяют разное.
const BANNED = [
  "лечени", "лечить", "лечит", "лечен(ие|ия|ию|ием)", "диагноз", "заболеван", "исцел",
  "целител", "болезн", "симптом", "терапи", "препарат", "набор веса", "алкогол", "похуден",
  "выздоравл", "недуг", "иммунит", "хроническ", "врач", "клиник", "гарантиру",
  "уязвимые зоны",
].map((root) => new RegExp(`(^|[^а-яёa-z0-9])${root}`, "i"));

let rejected = 0;
// статьи, отброшенные целиком: без счётчика сданная статья просто не появлялась на сайте, и
// причину приходилось искать глазами
let dropped = 0;

function safe(text: string): boolean {
  if (BANNED.some((re) => re.test(text))) {
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
    return Array.isArray(items) ? (items as Bag[]) : [];
  } catch {
    return [];
  }
}

function strings(v: unknown, min = 1): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.filter((x): x is string => typeof x === "string" && x.trim().length > 20);
  if (out.length < min) return null;
  return out.every(safe) ? out : null;
}

function stringMap(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Bag)) {
    if (typeof val === "string" && val.trim() && safe(val)) out[k] = val;
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
}

// Статья попадает на сайт целиком или не попадает вовсе: половина полей — это страница без
// первого экрана или без текста, а такую лучше не публиковать, чем публиковать пустой шаблон.
function articleOf(raw: Bag, keyField: string): ArticleContent | null {
  const key = raw[keyField];
  const id = typeof key === "number" ? String(key) : typeof key === "string" ? key.trim() : "";
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const seo = seoOf(raw.seo);
  const short = typeof raw.short === "string" ? raw.short.trim() : "";
  const sections = sectionsOf(raw.sections);
  if (!id || !title || !seo || short.length < 60 || !sections) {
    dropped++;
    return null;
  }
  if (!safe(title) || !safe(short)) {
    dropped++;
    return null;
  }
  // queries уходят в keywords разметки, то есть публикуются: гигиена им нужна такая же, как
  // прозе, иначе медицинская формулировка обходит фильтр через поле «поисковые запросы»
  const queries = Array.isArray((raw.seo as Bag | undefined)?.queries)
    ? ((raw.seo as Bag).queries as unknown[]).filter(
        (x): x is string => typeof x === "string" && safe(x),
      )
    : [];
  return {
    key: id,
    title,
    seo: { ...seo, queries },
    short,
    sections,
    faq: faqOf(raw.faq) ?? [],
    related: keys(raw.related) ?? [],
    arcana: numbers(raw.arcana) ?? [],
  };
}

function articles(file: string, keyField = "key"): Map<string, ArticleContent> {
  const m = new Map<string, ArticleContent>();
  for (const raw of readItems(file)) {
    const item = articleOf(raw, keyField);
    if (item) m.set(item.key, item);
  }
  return m;
}

function index<K extends string | number>(items: Bag[], key: string): Map<K, Bag> {
  const m = new Map<K, Bag>();
  for (const it of items) {
    const k = it[key];
    if (typeof k === "string" || typeof k === "number") m.set(k as K, it);
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

export function karmicTail(key: string): ArticleContent | null {
  return KARMIC_TAILS.get(key) ?? null;
}

export function karmicTailKeys(): string[] {
  return [...KARMIC_TAILS.keys()];
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

// Порядок статей задан смыслом, а не алфавитом ключей: сначала как считается матрица, потом
// понятия, «Об авторе» — последней.
const HUB_ORDER = ["o-metode", "energii", "programmy", "karmicheskaya-matrica", "avtor"];

export function hubKeys(): string[] {
  const keys = [...HUBS.keys()];
  return keys.sort((a, b) => {
    const ia = HUB_ORDER.indexOf(a);
    const ib = HUB_ORDER.indexOf(b);
    return (ia < 0 ? HUB_ORDER.length : ia) - (ib < 0 ? HUB_ORDER.length : ib);
  });
}

if (dropped > 0) {
  console.warn(
    `[content] ${dropped} статей отброшено валидацией: нужны key, title, seo.title, ` +
      "seo.description, short от 60 знаков и хотя бы одна секция с абзацем",
  );
}

export interface ArcanumContent {
  short?: string;
  keywords?: string[];
  meaning?: string[];
  inPositions?: Record<string, string>;
  plus?: string[];
  minus?: string[];
  seo?: { title: string; description: string };
  sections?: Section[];
  faq?: QA[];
}

export function arcanumContent(n: number): ArcanumContent | null {
  const raw = ARCANA_JSON.get(n);
  if (!raw) return null;
  const out: ArcanumContent = {};
  if (typeof raw.short === "string" && raw.short.length > 10 && safe(raw.short)) out.short = raw.short;
  const kw = Array.isArray(raw.keywords)
    ? raw.keywords.filter((x): x is string => typeof x === "string" && x.length > 1)
    : null;
  if (kw && kw.length >= 3 && kw.every(safe)) out.keywords = kw;
  const meaning = strings(raw.meaning, 3);
  if (meaning) out.meaning = meaning;
  const pos = stringMap(raw.in_positions);
  if (pos) out.inPositions = pos;
  const plus = Array.isArray(raw.plus) ? raw.plus.filter((x): x is string => typeof x === "string") : null;
  if (plus && plus.length >= 3 && plus.every(safe)) out.plus = plus;
  const minus = Array.isArray(raw.minus) ? raw.minus.filter((x): x is string => typeof x === "string") : null;
  if (minus && minus.length >= 3 && minus.every(safe)) out.minus = minus;
  const seo = seoOf(raw.seo);
  if (seo) out.seo = seo;
  const sections = sectionsOf(raw.sections);
  if (sections) out.sections = sections;
  const faq = faqOf(raw.faq);
  if (faq) out.faq = faq;
  return Object.keys(out).length ? out : null;
}

export interface PositionContent {
  meaning?: string[];
  reading?: string;
  seo?: { title: string; description: string };
  sections?: Section[];
  faq?: QA[];
}

export function positionContent(key: string): PositionContent | null {
  const raw = POSITIONS_JSON.get(key);
  if (!raw) return null;
  const out: PositionContent = {};
  const meaning = strings(raw.meaning, 2);
  if (meaning) out.meaning = meaning;
  if (typeof raw.reading === "string" && raw.reading.length > 40 && safe(raw.reading)) out.reading = raw.reading;
  const seo = seoOf(raw.seo);
  if (seo) out.seo = seo;
  const sections = sectionsOf(raw.sections);
  if (sections) out.sections = sections;
  const faq = faqOf(raw.faq);
  if (faq) out.faq = faq;
  return Object.keys(out).length ? out : null;
}

export interface ChakraContent {
  level?: string[];
  columns?: Array<{ title: string; text: string }>;
  seo?: { title: string; description: string };
}

export function chakraContent(key: string): ChakraContent | null {
  const raw = CHAKRAS_JSON.get(key);
  if (!raw) return null;
  const out: ChakraContent = {};
  const level = strings(raw.level, 1);
  if (level) out.level = level;
  if (Array.isArray(raw.columns)) {
    const cols = (raw.columns as Bag[])
      .map((c) => ({ title: String(c.title ?? ""), text: String(c.text ?? "") }))
      .filter((c) => c.title && c.text.length > 40 && safe(c.text) && safe(c.title));
    if (cols.length) out.columns = cols;
  }
  const seo = seoOf(raw.seo);
  if (seo) out.seo = seo;
  return Object.keys(out).length ? out : null;
}

export interface CombinationContent {
  title?: string;
  short?: string;
  meaning?: string[];
  seo?: { title: string; description: string };
}

export function combinationContent(slug: string): CombinationContent | null {
  const raw = COMBINATIONS_JSON.get(slug);
  if (!raw) return null;
  const out: CombinationContent = {};
  if (typeof raw.title === "string" && raw.title.length > 4 && safe(raw.title)) out.title = raw.title;
  if (typeof raw.short === "string" && raw.short.length > 10 && safe(raw.short)) out.short = raw.short;
  // генератор пишет абзацы в paragraphs; meaning оставлен как совместимость со старым форматом
  const meaning = strings(raw.paragraphs, 2) ?? strings(raw.meaning, 2);
  if (meaning) out.meaning = meaning;
  const seo = seoOf(raw.seo);
  if (seo) out.seo = seo;
  return Object.keys(out).length ? out : null;
}

/** Текст «аркан n в позиции key»: сгенерированный, если он прошёл гигиену, иначе встроенный. */
export function arcanumInPosition(n: number, key: string): string {
  // Сгенерированный пул chakras описывает карту целиком («верх наполнен, низ пуст»), поэтому
  // не годится как толкование одного аркана в одной строке. Отчёт уже использует позиционную
  // рамку; справочник обязан показывать тот же текст.
  if (key === "chakras") return builtInPositionText(n, key);
  const generated = arcanumContent(n)?.inPositions?.[key];
  return generated && generated.length > 40 ? generated : builtInPositionText(n, key);
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
    dropped,
  };
}
