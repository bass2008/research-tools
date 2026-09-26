import chakrasEn from "@/content/en/chakras.json";
import hubsEn from "@/content/en/hubs.json";
import positionsEn from "@/content/en/positions.json";
import chakrasRu from "@/content/ru/chakras.json";
import hubsRu from "@/content/ru/hubs.json";
import positionsRu from "@/content/ru/positions.json";
import method from "./__fixtures__/method.json";
import { forLocale as localizedArcana } from "./arcana";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "./i18n/lang";
import { localized } from "./i18n/localized";

export interface PositionPage {
  key: string;
  kind: "section" | "point";
  title: string;
}

export interface ChakraPage {
  key: string;
  title: string;
  hint: string;
  index: number;
  physics: string;
  energy: string;
}

interface HubRoute {
  key: string;
  crumb: string;
}

/** A locale-bound view; safe to use alongside other languages. */
export const forLocale = localized((L: Locale) => {
  const chakras = ({ ru: chakrasRu, en: chakrasEn } as const)[L];
  const hubs = ({ ru: hubsRu, en: hubsEn } as const)[L];
  const positions = ({ ru: positionsRu, en: positionsEn } as const)[L];
  const { ARCANA } = localizedArcana(L);

  function unique<T>(rows: T[], key: (row: T) => string, expected: number, name: string): T[] {
    if (rows.length !== expected || new Set(rows.map(key)).size !== expected) {
      throw new Error(`${name}: ожидалось ${expected} уникальных записей, получено ${rows.length}`);
    }
    return rows;
  }

  const POSITIONS: PositionPage[] = unique(
    positions.items.map((row) => ({ key: row.key, kind: row.kind as PositionPage["kind"], title: row.title })),
    (row) => row.key,
    38,
    "positions.json",
  );

  const POSITION_KEYS = POSITIONS.map((position) => position.key);

  const POSITION_BY_KEY = new Map(POSITIONS.map((position) => [position.key, position]));

  const CHAKRA_METHOD = new Map(method.chakras.map((chakra) => [chakra.key, chakra]));

  const CHAKRA_PAGES: ChakraPage[] = unique(
    chakras.items.map((row) => {
      const definition = CHAKRA_METHOD.get(row.key);
      if (!definition) throw new Error(`method.json: нет формулы чакры ${row.key}`);
      return {
        key: row.key,
        title: row.title,
        hint: row.hint,
        index: row.number,
        physics: definition.physics,
        energy: definition.energy,
      };
    }),
    (row) => row.key,
    7,
    "chakras.json",
  );

  const CHAKRA_BY_KEY = new Map(CHAKRA_PAGES.map((chakra) => [chakra.key, chakra]));

  function positionByKey(key: string): PositionPage | undefined {
    return POSITION_BY_KEY.get(key);
  }

  function chakraByKey(key: string): ChakraPage | undefined {
    return CHAKRA_BY_KEY.get(key);
  }

  function arcanumHref(n: number): string {
    return `/encyclopedia/arcanum/${n}`;
  }

  function positionHref(key: string): string {
    return `/encyclopedia/position/${key}`;
  }

  function chakraHref(key: string): string {
    return `/encyclopedia/chakra/${key}`;
  }

  function combinationHref(a: number, b: number): string {
    const [low, high] = a <= b ? [a, b] : [b, a];
    return `/encyclopedia/combination/${low}-${high}`;
  }

  function allCombinationSlugs(): string[] {
    const result: string[] = [];
    for (let a = 1; a <= 22; a++) {
      for (let b = a + 1; b <= 22; b++) result.push(`${a}-${b}`);
    }
    return result;
  }

  function parseCombinationSlug(slug: string): [number, number] | null {
    const match = /^(\d{1,2})-(\d{1,2})$/.exec(slug);
    if (!match) return null;
    const a = Number(match[1]);
    const b = Number(match[2]);
    return a >= 1 && a < b && b <= 22 ? [a, b] : null;
  }

  const KARMIC_TAIL_HUB = "/encyclopedia/karmic-tail";

  const YEAR_HUB = "/year";

  // Шапка каждого типа страниц справочника. Хаб обязан лежать на префиксе своих листьев:
  // `/encyclopedia/combination` над `/encyclopedia/combination/8-11`. Так адрес совпадает с
  // заявленным в крошке родителем, и уровень «Сочетания арканов» перестаёт быть фильтром
  // `?sec=cmb`, которого как страницы не существует.
  const ARCANUM_HUB = "/encyclopedia/arcanum";

  const CHAKRA_HUB = "/encyclopedia/chakra";

  const COMBINATION_HUB = "/encyclopedia/combination";

  const POSITION_HUB = "/encyclopedia/position";

  function karmicTailHref(key: string): string {
    return `${KARMIC_TAIL_HUB}/${key}`;
  }

  function yearHref(key: string | number): string {
    return `${YEAR_HUB}/${key}`;
  }

  const HUB_ROUTES: HubRoute[] = hubs.items.map((item) => {
    const crumb = "crumb" in item && typeof item.crumb === "string" ? item.crumb : "";
    if (!item.key || !crumb) throw new Error(`hubs.json: у ${item.key || "записи"} нет crumb`);
    return { key: item.key, crumb };
  });

  const ROOT_HUBS = HUB_ROUTES.map((route) => route.key);

  const HUB_CRUMBS = new Map(HUB_ROUTES.map((route) => [route.key, route.crumb]));

  function hubCrumb(key: string): string {
    const value = HUB_CRUMBS.get(key);
    if (!value) throw new Error(`нет корневого хаба ${key}`);
    return value;
  }

  function hubHref(key: string): string {
    return `/${key}`;
  }

  function hasHubRoute(key: string): boolean {
    return HUB_CRUMBS.has(key);
  }

  /** Parse an ordered karmic-tail key without sorting its identity. */
  function parseTail(key: string): number[] | null {
    const parts = key.split("-");
    if (parts.length !== 3) return null;
    const result: number[] = [];
    for (const raw of parts) {
      if (!/^\d{1,2}$/.test(raw)) return null;
      const value = Number(raw);
      if (value < 1 || value > 22) return null;
      result.push(value);
    }
    return result;
  }

  function tailShape(arcana: number[]): string {
    return [...arcana].sort((a, b) => a - b).join("-");
  }

  function tailByFormula(
    arcana: number[],
  ): { triple: [number, number, number]; sampleBirth: string } | null {
    if (arcana.length !== 3) return null;
    const item = method.reachable_karmic_tails.find((tail) => tail.triple === arcana.join("-"));
    const triple = item ? parseTail(item.triple) : null;
    return item && triple
      ? { triple: triple as [number, number, number], sampleBirth: item.sample_birth }
      : null;
  }

  function encyclopediaIndex() {
    return {
      arcana: ARCANA.map((arcanum) => ({
        ...arcanum,
        href: arcanumHref(arcanum.n),
      })),
      positions: POSITIONS.map((position) => ({
        ...position,
        href: positionHref(position.key),
      })),
      chakras: CHAKRA_PAGES.map((chakra) => ({
        ...chakra,
        href: chakraHref(chakra.key),
      })),
      combinations_count: allCombinationSlugs().length,
    };
  }

  const ENCYCLOPEDIA_PAGE_COUNT =
    1 + ARCANA.length + POSITIONS.length + allCombinationSlugs().length + CHAKRA_PAGES.length;
  return { POSITIONS, POSITION_KEYS, CHAKRA_PAGES, positionByKey, chakraByKey, arcanumHref, positionHref, chakraHref, combinationHref, allCombinationSlugs, parseCombinationSlug, KARMIC_TAIL_HUB, YEAR_HUB, ARCANUM_HUB, CHAKRA_HUB, COMBINATION_HUB, POSITION_HUB, karmicTailHref, yearHref, ROOT_HUBS, hubCrumb, hubHref, hasHubRoute, parseTail, tailShape, tailByFormula, encyclopediaIndex, ENCYCLOPEDIA_PAGE_COUNT };
});

// Compatibility for callers that explicitly use the deployment default.
export const { POSITIONS, POSITION_KEYS, CHAKRA_PAGES, positionByKey, chakraByKey, arcanumHref, positionHref, chakraHref, combinationHref, allCombinationSlugs, parseCombinationSlug, KARMIC_TAIL_HUB, YEAR_HUB, ARCANUM_HUB, CHAKRA_HUB, COMBINATION_HUB, POSITION_HUB, karmicTailHref, yearHref, ROOT_HUBS, hubCrumb, hubHref, hasHubRoute, parseTail, tailShape, tailByFormula, encyclopediaIndex, ENCYCLOPEDIA_PAGE_COUNT } = forLocale(defaultLocale);
