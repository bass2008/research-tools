import chakras from "@/content/chakras.json";
import hubs from "@/content/hubs.json";
import positions from "@/content/positions.json";

import { ARCANA } from "./arcana";
import method from "./__fixtures__/method.json";

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

function unique<T>(rows: T[], key: (row: T) => string, expected: number, name: string): T[] {
  if (rows.length !== expected || new Set(rows.map(key)).size !== expected) {
    throw new Error(`${name}: ожидалось ${expected} уникальных записей, получено ${rows.length}`);
  }
  return rows;
}

export const POSITIONS: PositionPage[] = unique(
  positions.items.map((row) => ({ key: row.key, kind: row.kind as PositionPage["kind"], title: row.title })),
  (row) => row.key,
  37,
  "positions.json",
);

export const POSITION_KEYS = POSITIONS.map((position) => position.key);
const POSITION_BY_KEY = new Map(POSITIONS.map((position) => [position.key, position]));

const CHAKRA_METHOD = new Map(method.chakras.map((chakra) => [chakra.key, chakra]));

export const CHAKRA_PAGES: ChakraPage[] = unique(
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

export function positionByKey(key: string): PositionPage | undefined {
  return POSITION_BY_KEY.get(key);
}

export function chakraByKey(key: string): ChakraPage | undefined {
  return CHAKRA_BY_KEY.get(key);
}

export function arcanumHref(n: number): string {
  return `/encyclopedia/arcanum/${n}`;
}

export function positionHref(key: string): string {
  return `/encyclopedia/position/${key}`;
}

export function chakraHref(key: string): string {
  return `/encyclopedia/chakra/${key}`;
}

export function combinationHref(a: number, b: number): string {
  const [low, high] = a <= b ? [a, b] : [b, a];
  return `/encyclopedia/combination/${low}-${high}`;
}

export function allCombinationSlugs(): string[] {
  const result: string[] = [];
  for (let a = 1; a <= 22; a++) {
    for (let b = a + 1; b <= 22; b++) result.push(`${a}-${b}`);
  }
  return result;
}

export function parseCombinationSlug(slug: string): [number, number] | null {
  const match = /^(\d{1,2})-(\d{1,2})$/.exec(slug);
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  return a >= 1 && a < b && b <= 22 ? [a, b] : null;
}

export const KARMIC_TAIL_HUB = "/encyclopedia/karmic-tail";
export const YEAR_HUB = "/na-god";

export function karmicTailHref(key: string): string {
  return `${KARMIC_TAIL_HUB}/${key}`;
}

export function yearHref(key: string | number): string {
  return `${YEAR_HUB}/${key}`;
}

interface HubRoute {
  key: string;
  crumb: string;
}

const HUB_ROUTES: HubRoute[] = hubs.items.map((item) => {
  const crumb = "crumb" in item && typeof item.crumb === "string" ? item.crumb : "";
  if (!item.key || !crumb) throw new Error(`hubs.json: у ${item.key || "записи"} нет crumb`);
  return { key: item.key, crumb };
});

export const ROOT_HUBS = HUB_ROUTES.map((route) => route.key);
const HUB_CRUMBS = new Map(HUB_ROUTES.map((route) => [route.key, route.crumb]));

export function hubCrumb(key: string): string {
  const value = HUB_CRUMBS.get(key);
  if (!value) throw new Error(`нет корневого хаба ${key}`);
  return value;
}

export function hubHref(key: string): string {
  return `/${key}`;
}

export function hasHubRoute(key: string): boolean {
  return HUB_CRUMBS.has(key);
}

/** Parse an ordered karmic-tail key without sorting its identity. */
export function parseTail(key: string): number[] | null {
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

export function tailShape(arcana: number[]): string {
  return [...arcana].sort((a, b) => a - b).join("-");
}

export function tailByFormula(
  arcana: number[],
): { triple: [number, number, number]; sampleBirth: string } | null {
  if (arcana.length !== 3) return null;
  const item = method.reachable_karmic_tails.find((tail) => tail.triple === arcana.join("-"));
  const triple = item ? parseTail(item.triple) : null;
  return item && triple
    ? { triple: triple as [number, number, number], sampleBirth: item.sample_birth }
    : null;
}

export function encyclopediaIndex() {
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

export const ENCYCLOPEDIA_PAGE_COUNT =
  1 + ARCANA.length + POSITIONS.length + allCombinationSlugs().length + CHAKRA_PAGES.length;
