// Серверная половина спецификации отчёта. Платные подписи и ключи позиций не попадают
// в клиентский чанк; сам корпус трактовок читается строго из web/content/arcana.json.
import sectionSpec from "./__fixtures__/sections.json";
import { buildCharacterReading, characterRoleTemplate } from "./character";
import { characterHref, type CharacterPositionKey } from "./characterTypes";
import { arcanumInPosition } from "./content";
import type { Matrix } from "./matrix";
import {
  CATALOG,
  arcanumHref,
  type Access,
  type PositionOut,
  type PositionTextValue,
  type PositionTexts,
  type SectionOut,
} from "./publicSpec";
import {
  positionKeys,
  resolveSectionPositions,
  type SectionPositionDefinition,
} from "./sectionResolver";

export type { Access, PositionOut, PositionTexts, SectionOut };
export { arcanumHref };

export interface SectionSpec {
  key: string;
  title: string;
  lead: string;
  access: Access;
  positions: (matrix: Matrix) => Array<[string, number, string]>;
}

interface PrivateSectionRow {
  key: string;
  title: string;
  lead: string;
  access: Access;
  positions: SectionPositionDefinition[];
}

const PRIVATE_ROWS = sectionSpec.sections as PrivateSectionRow[];
const PRIVATE_BY_KEY = new Map(PRIVATE_ROWS.map((row) => [row.key, row]));
if (PRIVATE_ROWS.length !== 20 || PRIVATE_BY_KEY.size !== 20) {
  throw new Error(`sections.json: ожидалось 20 уникальных разделов, получено ${PRIVATE_ROWS.length}`);
}

/** Двадцать разделов: публичные метаданные и серверная схема сверяются при импорте. */
export const SPEC: SectionSpec[] = CATALOG.map((meta) => {
  const row = PRIVATE_BY_KEY.get(meta.key);
  if (!row || row.title !== meta.title || row.access !== meta.access || !row.positions.length) {
    throw new Error(`публичная и серверная спецификации раздела ${meta.key} не совпадают`);
  }
  return {
    key: row.key,
    title: row.title,
    lead: row.lead,
    access: row.access,
    positions: (matrix) => resolveSectionPositions(row.positions, matrix),
  };
});

export const FREE_KEYS: string[] = SPEC.filter((section) => section.access === "free").map((section) => section.key);
export const PAID_KEYS: string[] = SPEC.filter((section) => section.access === "paid").map((section) => section.key);
export const SECTION_KEYS: string[] = SPEC.map((section) => section.key);

/** Собрать разделы. При unlocked=false платные приходят без позиций — только анонс. */
export function build(matrix: Matrix, unlocked = false): SectionOut[] {
  return SPEC.map((spec) => {
    const seen = new Map<string, string>();
    const positions = spec.positions(matrix).map(([label, arcanum, positionKey]) => {
      const mark = `${positionKey}:${arcanum}`;
      const first = seen.get(mark);
      if (!first) seen.set(mark, label);
      return {
        label,
        arcanum,
        href: arcanumHref(arcanum),
        text: first
          ? `Тот же аркан, что и в позиции «${first}»: толкование выше.`
          : arcanumInPosition(arcanum, positionKey),
      };
    });
    const out: SectionOut = {
      key: spec.key,
      title: spec.title,
      lead: spec.lead,
      access: spec.access,
      positions,
      ...(spec.key === "character"
        ? {
            personalHref: characterHref(matrix),
            longform: buildCharacterReading(matrix),
          }
        : {}),
    };
    if (spec.access === "paid" && !unlocked) {
      out.teaser = `${positions.length} позиций в полном разборе`;
      out.positions = [];
    }
    return out;
  });
}

/** Толкования бесплатных разделов для браузера: платные сюда не попадают намеренно. */
export function freePositionTexts(): PositionTexts {
  const out: PositionTexts = {};
  const isCharacterPosition = (key: string): key is CharacterPositionKey =>
    key === "day" || key === "month" || key === "year";
  for (const spec of SPEC) {
    if (spec.access !== "free") continue;
    const definition = PRIVATE_BY_KEY.get(spec.key)!;
    for (const key of positionKeys(definition.positions)) {
      const byArcanum: Record<number, PositionTextValue> = {};
      for (let n = 1; n <= 22; n++) {
        const text = arcanumInPosition(n, key);
        byArcanum[n] = isCharacterPosition(key)
          ? { characterRole: characterRoleTemplate(n, key) }
          : text;
      }
      out[key] = byArcanum;
    }
  }
  return out;
}

/** Все арканы, на которые ссылается отчёт — для перелинковки с энциклопедией. */
export function referencedArcana(matrix: Matrix): number[] {
  const seen = new Set<number>();
  for (const spec of SPEC) {
    for (const [, arcanum] of spec.positions(matrix)) seen.add(arcanum);
  }
  return [...seen].sort((a, b) => a - b);
}

export function sectionByKey(key: string): SectionSpec | undefined {
  return SPEC.find((section) => section.key === key);
}
