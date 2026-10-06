// Framework-independent reader for generated encyclopedia content.
// The caller supplies filesystem, bundled or other content through ContentSource.

import { chakraRow, type ChakraCorpus } from "./chakraRow";
import type { Lang as Locale } from "./i18n/hosts";
import { forLocale as localizedPublicLabels } from "./i18n/publicLabels";
import type { Matrix } from "./matrix";
import { ENERGY_FIELD_KEY, type ChakraReadingRow } from "./readingTypes";
import { chakraAtlas } from "./i18n/dict/chakraAtlas";
import { plainText } from "./richText";

type Bag = Record<string, unknown>;

export type Block =
  | { h3: string }
  | { ul: string[] }
  | { ol: string[] }
  | { table: { head: string[]; rows: string[][] } }
  | { slot: Slot }
  | { chakra_reading: ChakraReadingItem };

// Source form: { "chakra_reading": { "chakra": "manipura", "triple": "7-7-14", "note": "…" } };
// the reader resolves it against the paid-report corpus.
export interface ChakraReadingItem {
  id: string;
  number?: number;
  note?: string;
  row: ChakraReadingRow;
}

// Places where a page inserts its own component inside the article.
export const SLOTS = ["calc"] as const;
export type Slot = (typeof SLOTS)[number];

// Body text allows only `**bold**`; headings and table heads stay plain.
export type Paragraph = string | Block;

export interface Section {
  h2: string;
  paragraphs: Paragraph[];
}

export function paragraphText(p: Paragraph): string {
  if (typeof p === "string") return plainText(p);
  if ("h3" in p) return p.h3;
  if ("ul" in p) return p.ul.map(plainText).join(" ");
  if ("ol" in p) return p.ol.map(plainText).join(" ");
  if ("slot" in p) return "";
  if ("chakra_reading" in p) {
    const { row, note } = p.chakra_reading;
    return [row.heading, ...row.cells.map((cell) => cell.caption), ...row.paragraphs, note ?? ""].map(plainText).join(" ");
  }
  return [...p.table.head, ...p.table.rows.flat()].map(plainText).join(" ");
}

export interface QA {
  q: string;
  a: string;
}

/** Статья категории по схеме `.agents/skills/arcana-product-skill/references/content-format.md`, «Схема по категориям»: проза в полях, связи — списком ключей. */
export interface ArticleContent {
  key: string;
  title: string;
  seo: { title: string; description: string; queries: string[] };
  short: string;
  intro: Paragraph[];
  sections: Section[];
  faq: QA[];
  /** Short reading of a karmic tail for the paid report; the article itself stays on the site. */
  report: Paragraph[];
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
  /** Полная статья аркана: если она есть, страница рисуется по ней, а `meaning` и панели уходят. */
  article?: ChakraArticle;
}

export interface PositionContent {
  key: string;
  kind: "section" | "point";
  title: string;
  /** Редакционный заголовок статьи; без него h1 — название позиции. */
  h1?: string;
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

export interface PositionArcanumRow {
  position: string;
  arcanum: number;
  frequency: number;
  /** Головной запрос есть только у записи, которую видит поиск: без спроса заявлять его нельзя. */
  primaryQuery: string | null;
  /** Другие формулировки того же вопроса из Вордстата: «матрица судьбы любовь 7» при главном «отношения 7». */
  queries: string[];
  wording: string;
  wordings: Record<string, number>;
  publication: { index: boolean; follow: boolean };
}

export interface ChakraContent {
  key: string;
  title: string;
  hint: string;
  level: string[];
  personalIntro: string;
  columns: Array<{ key: string; title: string; text: string }>;
  seo: { title: string; description: string };
  sections: Section[];
  readings: Array<{ n: number; physics?: string; energy?: string; emotions?: string }>;
  examples: Array<{ birth: string; numbers: number[]; paragraphs: string[] }>;
  faq: QA[];
  article?: ChakraArticle;
}

export interface ChakraArticle {
  title: string;
  short: string;
  seo: { title: string; description: string };
  intro: Paragraph[];
  sections: Section[];
  faq: QA[];
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

/* ── матрицы: 5544 тройки (день, месяц, год) из engine/precompute.py ── */

export interface MatrixItem {
  slug: string;
  day: number;
  month: number;
  year: number;
  matrix: Matrix;
  arcana: number[];
}

export interface ContentSource {
  read(file: string, locale: Locale, shared?: boolean): unknown;
}

/** A locale-bound view; safe to use alongside other languages. */
export function createContent(L: Locale, source: ContentSource) {
  const { chakraHint, chakraTitle } = localizedPublicLabels(L);

  // Корпус лежит по каталогам языка; предрасчёт матриц один на все языки и остаётся уровнем выше.

  function readItems(file: string, shared = false): Bag[] {
    try {
      const parsed = source.read(file, L, shared);
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
    if (!v.every((value) => typeof value === "string" && value.trim().length > 20)) {
      return null;
    }
    return v as string[];
  }

  function stringMap(v: unknown): Record<string, string> | null {
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Bag)) {
      if (typeof val !== "string") continue;
      if (!val.trim()) return null;
      out[k] = val;
    }
    return Object.keys(out).length ? out : null;
  }

  function seoOf(v: unknown): { title: string; description: string } | null {
    const m = stringMap(v);
    if (!m?.title || !m?.description) return null;
    if (m.title.length < 10 || m.description.length < 60) return null;
    return { title: m.title, description: m.description };
  }

  function cells(v: unknown, allowEmpty: boolean): string[] | null {
    if (!Array.isArray(v) || !v.length) return null;
    const ok = v.every((x) => typeof x === "string" && (allowEmpty || x.trim()));
    return ok ? (v as string[]) : null;
  }

  let chakraCorpus: ChakraCorpus | undefined;
  let chakraNumbers: Map<string, number> | undefined;

  function chakraReadingOf(v: unknown): ChakraReadingItem | null {
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const { chakra, triple, note, ...rest } = v as Bag;
    if (Object.keys(rest).length || typeof chakra !== "string" || typeof triple !== "string" ||
        !/^\d+-\d+-\d+$/.test(triple) || (note !== undefined && (typeof note !== "string" || !note.trim()))) {
      return null;
    }
    chakraCorpus ??= source.read("chakra-personal.json", L) as ChakraCorpus;
    chakraNumbers ??= new Map(readItems("chakras.json").map((row) => [String(row.key), Number(row.number)]));
    const field = chakra === ENERGY_FIELD_KEY;
    const copy = field ? chakraCorpus.energy_field?.readings[triple] : chakraCorpus.chakras[chakra]?.readings[triple];
    const number = field ? undefined : chakraNumbers.get(chakra);
    if (!copy || (!field && !number)) return null;
    const numbers = triple.split("-").map(Number);
    const row = chakraRow(chakraCorpus, L, chakra, field ? chakraAtlas.energyField[L] : chakraTitle(chakra), numbers, copy);
    return {
      id: `combination-${triple}`, ...(number ? { number } : {}), ...(note ? { note: note.trim() } : {}),
      row: field ? { ...row, topic: chakraAtlas.energyFieldTopic[L] } : row,
    };
  }

  function blockOf(v: unknown): Block | null {
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const raw = v as Bag;
    if (Object.keys(raw).length !== 1) return null;
    if ("h3" in raw) {
      return typeof raw.h3 === "string" && raw.h3.trim() ? { h3: raw.h3.trim() } : null;
    }
    if ("ul" in raw) {
      const ul = cells(raw.ul, false);
      return ul ? { ul } : null;
    }
    if ("ol" in raw) {
      const ol = cells(raw.ol, false);
      return ol ? { ol } : null;
    }
    if ("slot" in raw) {
      return SLOTS.includes(raw.slot as Slot) ? { slot: raw.slot as Slot } : null;
    }
    if ("chakra_reading" in raw) {
      const item = chakraReadingOf(raw.chakra_reading);
      return item ? { chakra_reading: item } : null;
    }
    if ("table" in raw) {
      const table = raw.table as Bag | null;
      const head = cells(table?.head, true);
      const rows = Array.isArray(table?.rows) && table.rows.length
        ? (table.rows as unknown[]).map((row) => cells(row, true))
        : null;
      if (!head || !rows || rows.some((row) => !row || row.length !== head.length)) return null;
      return { table: { head, rows: rows as string[][] } };
    }
    return null;
  }

  function paragraphsOf(v: unknown): Paragraph[] | null {
    if (!Array.isArray(v) || !v.length) return null;
    const out: Paragraph[] = [];
    for (const item of v) {
      if (typeof item === "string") {
        if (item.trim().length <= 20) return null;
        out.push(item);
        continue;
      }
      const block = blockOf(item);
      if (!block) return null;
      out.push(block);
    }
    return out;
  }

  function sectionsOf(v: unknown, where: string): Section[] | null {
    if (!Array.isArray(v)) return null;
    const out: Section[] = [];
    for (const [i, raw] of (v as Bag[]).entries()) {
      const h2 = typeof raw?.h2 === "string" ? raw.h2.trim() : "";
      const paragraphs = paragraphsOf(raw?.paragraphs);
      if (!h2 || !paragraphs) {
        throw new Error(`[content] ${where}: раздел ${i + 1} «${h2}» — пустой h2, абзац короче 21 знака или неверный блок`);
      }
      out.push({ h2, paragraphs });
    }
    return out.length ? out : null;
  }

  function faqOf(v: unknown, where: string): QA[] | null {
    if (!Array.isArray(v)) return null;
    const out: QA[] = [];
    for (const [i, raw] of (v as Bag[]).entries()) {
      const q = typeof raw?.q === "string" ? raw.q.trim() : "";
      const a = typeof raw?.a === "string" ? raw.a.trim() : "";
      // короткий ответ в FAQPage бесполезен и поиску, и человеку
      if (q.length <= 8 || a.length <= 40) {
        throw new Error(`[content] ${where}: вопрос FAQ ${i + 1} — вопрос от 9 знаков, ответ от 41`);
      }
      out.push({ q, a });
    }
    return out.length ? out : null;
  }

  function numbers(v: unknown): number[] | null {
    if (!Array.isArray(v)) return null;
    const out = v.filter((x): x is number => typeof x === "number" && x >= 1 && x <= 22);
    return out.length ? out : null;
  }

  // Указатель связи: ключ статьи («energies», «18-9-9») либо путь вида «arcanum/7»,
  // «position/center», «year/8». Слэш разрешён обязательно: без него терялись все связи, кроме
  // внутрикатегорийных, — у шапки «на год» из двенадцати оставалась одна.
  function keys(v: unknown): string[] | null {
    if (!Array.isArray(v)) return null;
    const out = v.filter(
      (x): x is string => typeof x === "string" && /^[\w-]{1,40}(\/[\w-]{1,40})?$/.test(x),
    );
    return out.length ? out : null;
  }

  // Статья попадает на сайт целиком или не попадает вовсе: половина полей — это страница без
  // первого экрана или без текста, а такую лучше не публиковать, чем публиковать пустой шаблон.
  function articleOf(raw: Bag, keyField: string): ArticleContent {
    const key = raw[keyField];
    const id = typeof key === "number" ? String(key) : typeof key === "string" ? key.trim() : "";
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    const seo = seoOf(raw.seo);
    const short = typeof raw.short === "string" ? raw.short.trim() : "";
    const sections = sectionsOf(raw.sections, `статья ${id || "без ключа"}`);
    const intro = raw.intro === undefined ? [] : paragraphsOf(raw.intro);
    const report = raw.report === undefined ? [] : paragraphsOf(raw.report);
    if (!id || !title || !seo || short.length < 60 || !sections || !intro || !report) {
      throw new Error(`[content] статья ${id || "без ключа"} не прошла обязательную схему`);
    }
    const queries = Array.isArray((raw.seo as Bag | undefined)?.queries)
      ? ((raw.seo as Bag).queries as unknown[]).filter(
        (x): x is string => typeof x === "string",
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
      intro,
      sections,
      faq: faqOf(raw.faq, `статья ${id}`) ?? [],
      report,
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
    ["positions.json", POSITIONS_JSON.size, 38],
    ["chakras.json", CHAKRAS_JSON.size, 7],
    ["combinations.json", COMBINATIONS_JSON.size, 231],
    ["karmic-tails.json", KARMIC_TAILS.size, 26],
    ["year-arcana.json", YEAR_ARCANA.size, 23],
    ["category-hubs.json", CATEGORY_HUBS.size, 7],
    ["hubs.json", HUBS.size, 10],
  ] as const) {
    if (actual !== expected) throw new Error(`[content] ${name}: ожидалось ${expected}, получено ${actual}`);
  }

  function karmicTail(key: string): ArticleContent | null {
    return KARMIC_TAILS.get(key) ?? null;
  }

  function karmicTailKeys(): string[] {
    return [...KARMIC_TAILS.keys()];
  }

  function indexedKarmicTailKeys(): string[] {
    return [...KARMIC_TAILS.values()].filter((item) => item.publication.index).map((item) => item.key);
  }

  function karmicTails(): ArticleContent[] {
    return [...KARMIC_TAILS.values()];
  }

  // В одном файле лежат и «N на год» (ключ 1…22), и год-штамп «на 2026» (ключ 2026): у них общий
  // шаблон и общий адрес /year/<ключ>, различается только подача.
  function yearArcanum(key: string | number): ArticleContent | null {
    return YEAR_ARCANA.get(String(key)) ?? null;
  }

  function yearKeys(): string[] {
    return [...YEAR_ARCANA.keys()];
  }

  function categoryHub(key: string): ArticleContent | null {
    return CATEGORY_HUBS.get(key) ?? null;
  }

  function hub(key: string): ArticleContent | null {
    return HUBS.get(key) ?? null;
  }

  function hubKeys(): string[] {
    return [...HUBS.values()]
      .sort((a, b) => {
        if (a.order === undefined || b.order === undefined) {
          throw new Error(`[content] у хаба ${a.order === undefined ? a.key : b.key} нет order`);
        }
        return a.order - b.order;
      })
      .map((item) => item.key);
  }

  function arcanumContent(n: number): ArcanumContent | null {
    const raw = ARCANA_JSON.get(n);
    if (!raw) return null;
    const title = typeof raw.title === "string" ? raw.title : null;
    const slug = typeof raw.slug === "string" ? raw.slug : null;
    const roman = typeof raw.roman === "string" ? raw.roman : null;
    const short = typeof raw.short === "string" && raw.short.length > 10 ? raw.short : null;
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
        typeof item.short === "string",
    );
    if (
      raw.n !== n ||
      !title ||
      !slug ||
      !roman ||
      !short ||
      keywords.length < 3 ||
      !meaning ||
      !inPositions ||
      Object.keys(inPositions).length !== 38 ||
      plus.length < 3 ||
      minus.length < 3 ||
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
      sections: sectionsOf(raw.sections, `аркан ${n}`) ?? [],
      faq: faqOf(raw.faq, `аркан ${n}`) ?? [],
      article: raw.article === undefined ? undefined : chakraArticleOf(raw.article, String(n), `аркан ${n}, статья`),
    };
  }

  // Реестр страниц «аркан N в позиции X»: его строит tools/seo/build-position-arcanum.py из
  // оплаченного Вордстата и достижимых значений метода. Какие адреса бывают, решает метод; какие
  // из них видит поиск — спрос. Плоская генерация 22 × 38 адресов была бы тем самым тонким
  // корпусом, который уже дал 76 страниц хвостов на один показ. `readItems` сверяет `count`,
  // поэтому обрезанный файл упадёт на загрузке.
  const POSITION_ARCANUM: PositionArcanumRow[] = readItems("position-arcanum.json").map((raw) => {
    const position = typeof raw.position === "string" ? raw.position : "";
    const arcanum = typeof raw.arcanum === "number" ? raw.arcanum : NaN;
    const wording = typeof raw.wording === "string" ? raw.wording : "";
    const query = typeof raw.primary_query === "string" ? raw.primary_query : null;
    const publication = (raw.publication ?? {}) as Bag;
    const index = typeof publication.index === "boolean" ? publication.index : true;
    if (!position || !Number.isInteger(arcanum) || !wording || (index && !query)) {
      throw new Error(`[content] негодная запись position-arcanum: ${JSON.stringify(raw)}`);
    }
    return {
      position,
      arcanum,
      frequency: typeof raw.frequency === "number" ? raw.frequency : 0,
      primaryQuery: query,
      queries: Array.isArray(raw.queries) ? raw.queries.filter((q): q is string => typeof q === "string" && q.trim() !== "") : [],
      wording,
      wordings: (raw.wordings ?? {}) as Record<string, number>,
      publication: {
        index,
        follow: typeof publication.follow === "boolean" ? publication.follow : true,
      },
    };
  });

  /** Пересечения, которые видит поиск: карта сайта строится по ним, а не по всему реестру. */
  function indexedPositionArcanumRows(): PositionArcanumRow[] {
    return POSITION_ARCANUM.filter((row) => row.publication.index);
  }

  function positionArcanumRows(): PositionArcanumRow[] {
    return POSITION_ARCANUM;
  }

  function positionContent(key: string): PositionContent | null {
    const raw = POSITIONS_JSON.get(key);
    if (!raw) return null;
    const kind = raw.kind === "section" || raw.kind === "point" ? raw.kind : null;
    const title = typeof raw.title === "string" ? raw.title : null;
    const lead = typeof raw.lead === "string" && raw.lead.length > 20 ? raw.lead : null;
    const formula = typeof raw.formula === "string" && raw.formula.length > 5 ? raw.formula : null;
    const meaning = strings(raw.meaning, 2);
    const reading = typeof raw.reading === "string" && raw.reading.length > 40 ? raw.reading : null;
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
      ...(typeof raw.h1 === "string" && raw.h1.trim() ? { h1: raw.h1.trim() } : {}),
      lead,
      formula,
      meaning,
      reading,
      seo,
      sections: sectionsOf(raw.article_sections, `позиция ${key}`) ?? [],
      faq: faqOf(raw.faq, `позиция ${key}`) ?? [],
      points: points.map(({ key: pointKey, title: pointTitle }) => ({
        key: pointKey,
        title: pointTitle,
      })),
      links: Array.isArray(raw.links)
        ? (raw.links as Bag[]).flatMap((link) => {
          const label = typeof link.label === "string" ? link.label.trim() : "";
          const href = typeof link.href === "string" ? link.href : "";
          return label && href.startsWith("/encyclopedia/")
            ? [{ label, href }]
            : [];
        })
        : [],
    };
  }

  function chakraArticleOf(v: unknown, key: string, where = `чакра ${key}, статья`): ChakraArticle {
    const raw = (v && typeof v === "object" && !Array.isArray(v) ? v : {}) as Bag;
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    const short = typeof raw.short === "string" ? raw.short.trim() : "";
    const seo = seoOf(raw.seo);
    const intro = raw.intro === undefined ? [] : paragraphsOf(raw.intro);
    const sections = sectionsOf(raw.sections, where);
    if (!title || short.length < 60 || !seo || !intro || !sections) {
      throw new Error(`[content] ${where} не прошла обязательную схему`);
    }
    return { title, short, seo, intro, sections, faq: faqOf(raw.faq, where) ?? [] };
  }

  function chakraContent(key: string): ChakraContent | null {
    const raw = CHAKRAS_JSON.get(key);
    if (!raw) return null;
    const level = strings(raw.level, 1);
    const personalIntro = typeof raw.personal_intro === "string" ? raw.personal_intro.trim() : "";
    const columns = Array.isArray(raw.columns)
      ? (raw.columns as Bag[]).map((column) => ({
        key: String(column.key ?? ""),
        title: String(column.title ?? ""),
        text: String(column.text ?? ""),
      }))
      : [];
    const seo = seoOf(raw.seo);
    const title = typeof raw.title === "string" ? raw.title : null;
    const hint = typeof raw.hint === "string" ? raw.hint : null;
    if (
      raw.key !== key ||
      !title ||
      !hint ||
      !level ||
      personalIntro.length < 20 ||
      columns.length !== 3 ||
      !columns.every((column) => column.key && column.title && column.text.length > 40) ||
      !seo
    ) {
      throw new Error(`[content] чакра ${key} не прошла обязательную схему`);
    }
    const sections = sectionsOf(raw.article_sections, `чакра ${key}`) ?? [];
    const faq = faqOf(raw.faq, `чакра ${key}`) ?? [];
    const readings: ChakraContent["readings"] = [];
    const examples: ChakraContent["examples"] = [];
    // Старые переводы пока не содержат подробного разбора. Если он задан, не допускаем
    // частично исчезнувших колонок или примеров после проверки текста.
    if (raw.readings !== undefined) {
      if (!Array.isArray(raw.readings) || !raw.readings.length) {
        throw new Error(`[content] чакра ${key}: пустой справочник чисел`);
      }
      for (const item of raw.readings as Bag[]) {
        const n = item.n;
        const entry: ChakraContent["readings"][number] = { n: Number(n) };
        if (!Number.isInteger(n) || Number(n) < 1 || Number(n) > 22 || readings.some((r) => r.n === n)) {
          throw new Error(`[content] чакра ${key}: неверный номер аркана`);
        }
        for (const col of ["physics", "energy", "emotions"] as const) {
          const value = item[col];
          if (value === undefined) continue;
          if (typeof value !== "string" || value.length < 20) {
            throw new Error(`[content] чакра ${key}, аркан ${n}: неверный текст ${col}`);
          }
          entry[col] = value;
        }
        if (!entry.physics && !entry.energy && !entry.emotions) {
          throw new Error(`[content] чакра ${key}, аркан ${n}: нет применимых колонок`);
        }
        readings.push(entry);
      }
    }
    if (raw.examples !== undefined) {
      if (!Array.isArray(raw.examples) || !raw.examples.length) {
        throw new Error(`[content] чакра ${key}: нет примеров`);
      }
      for (const item of raw.examples as Bag[]) {
        const values = numbers(item.numbers);
        const paragraphs = strings(item.paragraphs, 2);
        if (typeof item.birth !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.birth) ||
            !values || values.length !== 3 || !paragraphs ||
            paragraphs.length !== (item.paragraphs as unknown[]).length) {
          throw new Error(`[content] чакра ${key}: неверный пример строки`);
        }
        examples.push({ birth: item.birth, numbers: values, paragraphs });
      }
    }
    if ((raw.article_sections !== undefined && sections.length !== (raw.article_sections as unknown[]).length) ||
        (raw.faq !== undefined && faq.length !== (raw.faq as unknown[]).length)) {
      throw new Error(`[content] чакра ${key}: неполный текст статьи`);
    }
    const article = raw.article === undefined ? undefined : chakraArticleOf(raw.article, key);
    return { key, title, hint, level, personalIntro, columns, seo, sections, readings, examples, faq, article };
  }

  function combinationContent(slug: string): CombinationContent | null {
    const raw = COMBINATIONS_JSON.get(slug);
    if (!raw) return null;
    const title = typeof raw.title === "string" && raw.title.length > 4 ? raw.title : null;
    const short = typeof raw.short === "string" && raw.short.length > 10 ? raw.short : null;
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
  function arcanumInPosition(n: number, key: string): string {
    const generated = arcanumContent(n)?.inPositions[key];
    if (!generated || generated.length <= 40) {
      throw new Error(`[content] нет трактовки аркана ${n} в позиции ${key}`);
    }
    return generated;
  }

  // 11 МБ JSON: читается один раз на процесс и только когда его действительно спросили,
  // чтобы страницы энциклопедии не платили за файл, который им не нужен.
  let MATRICES: Map<string, MatrixItem> | null = null;

  function matrices(): Map<string, MatrixItem> {
    if (MATRICES) return MATRICES;
    const m = new Map<string, MatrixItem>();
    for (const raw of readItems("matrices.json", true)) {
      const it = raw as unknown as MatrixItem;
      if (typeof it.slug === "string" && it.matrix && typeof it.matrix.center === "number") {
        // Предрасчёт один на все языки: числа в нём языка не имеют, а подписи чакр — имеют,
        // и достались они от языка, на котором файл считали. Ставим слова выбранного языка.
        m.set(it.slug, {
          ...it,
          matrix: {
            ...it.matrix,
            chakras: (it.matrix.chakras ?? []).map((row) => ({
              ...row,
              title: chakraTitle(row.key),
              hint: chakraHint(row.key),
            })),
          },
        });
      }
    }
    MATRICES = m;
    return m;
  }

  function matrixSlugs(): string[] {
    return [...matrices().keys()];
  }

  function matrixItem(slug: string): MatrixItem | null {
    return matrices().get(slug) ?? null;
  }

  function matrixCount(): number {
    return matrices().size;
  }

  /** Сколько записей реально подхватилось — для отчёта сборки и тестов. */
  function contentStats() {
    return {
      arcana: ARCANA_JSON.size,
      positions: POSITIONS_JSON.size,
      chakras: CHAKRAS_JSON.size,
      combinations: COMBINATIONS_JSON.size,
      karmicTails: KARMIC_TAILS.size,
      yearArcana: YEAR_ARCANA.size,
      categoryHubs: CATEGORY_HUBS.size,
      hubs: HUBS.size,
    };
  }
  return { karmicTail, karmicTailKeys, indexedKarmicTailKeys, karmicTails, yearArcanum, yearKeys, categoryHub, hub, hubKeys, arcanumContent, indexedPositionArcanumRows, positionArcanumRows, positionContent, chakraContent, combinationContent, arcanumInPosition, matrixSlugs, matrixItem, matrixCount, contentStats };
}
