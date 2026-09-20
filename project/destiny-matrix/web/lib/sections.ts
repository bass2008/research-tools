// Серверная половина спецификации отчёта. Платные подписи и ключи позиций не попадают
// в клиентский чанк; сам корпус трактовок читается строго из web/content/arcana.json.
import sectionSpec from "./__fixtures__/sections.json";
import { sectionLabels } from "./i18n/methodLabels";
import { buildCharacterReading, characterRoleTemplate } from "./character";
import { characterHref, type CharacterPositionKey } from "./characterTypes";
import { arcanumInPosition, karmicTail } from "./content";
import { D, L } from "./i18n";
import type { Matrix } from "./matrix";
import {
  buildSectionReading,
  sectionReadingHref,
  sectionRoleTemplate,
  type PersonalSectionKey,
} from "./sectionReadings";
import { PERSONAL_SECTION_KEYS } from "./sectionReadingShared";
import {
  CATALOG,
  FREE_POSITION_KEYS,
  arcanumHref,
  type Access,
  type PositionArticle,
  type PositionArticles,
  type PositionOut,
  type PositionTextValue,
  type PositionTexts,
  type SectionOut,
} from "./publicSpec";
import {
  positionArcanumHref,
  positionArcanumLabel,
  registryItem,
} from "./positionArcanum";
import {
  positionKeys,
  resolveSectionPositions,
  type SectionPositionDefinition,
} from "./sectionResolver";

export type { Access, PositionArticle, PositionArticles, PositionOut, PositionTexts, SectionOut };
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

// Схема (селекторы и ключи точек) — контракт, слова — словарь языка сборки. Подпись позиции
// ключуется её местом в разделе: в одном разделе бывает несколько позиций одной точки.
const PRIVATE_ROWS: PrivateSectionRow[] = (sectionSpec.sections as PrivateSectionRow[]).map(
  (row) => {
    const text = sectionLabels(row.key);
    return {
      ...row,
      title: text.title,
      lead: text.lead,
      positions: row.positions.map((position, index) =>
        position.label ? { ...position, label: text.positions[index] } : position,
      ),
    };
  },
);
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
          ? D.report.sameArcanum[L](first)
          : arcanumInPosition(arcanum, positionKey),
      };
    });
    const personalSection = (PERSONAL_SECTION_KEYS as readonly string[]).includes(spec.key)
      ? spec.key as PersonalSectionKey
      : null;
    const hasLongform = spec.access === "free" || unlocked;
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
        : spec.key === "past_lives" && hasLongform
          ? (() => {
              const key = matrix.karmic_tail.join("-");
              const article = karmicTail(key);
              if (!article) throw new Error(`[sections] нет ordered-хвоста ${key}`);
              return {
                personalHref: `/encyclopedia/karmic-tail/${key}`,
                fullArticle: {
                  short: article.short,
                  sections: article.sections,
                  faq: article.faq,
                },
              };
            })()
        : personalSection && hasLongform
          ? {
              personalHref: sectionReadingHref(personalSection, matrix),
              longform: buildSectionReading(personalSection, matrix),
            }
        : {}),
    };
    if (spec.access === "paid" && !unlocked) {
      out.teaser = D.report.positionsInFull[L](positions.length);
      out.positions = [];
    }
    return out;
  });
}

/** Ссылки «карточка → статья» для готового разбора.
 *
 *  Отдельным проходом, а не внутри `build`: её результат сверяется с Python-движком дословно
 *  (`spec/golden.json`), а реестр пересечений — артефакт сайта, движку метода он неизвестен.
 *  Повтор аркана внутри раздела уже отослан к первой карточке, второй ссылки на ту же статью
 *  там быть не должно. */
export function withPositionArticles(matrix: Matrix, sections: SectionOut[]): SectionOut[] {
  return sections.map((section) => {
    const spec = SPEC.find((row) => row.key === section.key);
    if (!spec || !section.positions.length) return section;
    const resolved = spec.positions(matrix);
    const seen = new Set<string>();
    return {
      ...section,
      positions: section.positions.map((position, index) => {
        const key = resolved[index]?.[2];
        if (!key) return position;
        const mark = `${key}:${position.arcanum}`;
        if (seen.has(mark)) return position;
        seen.add(mark);
        const article = positionArticle(key, position.arcanum);
        return article ? { ...position, article } : position;
      }),
    };
  });
}

/** Статья про аркан именно в этой точке — только если она есть в реестре пересечений.
 *
 *  Реестр держит не все пары: часть точек метода вообще не разобрана отдельными страницами, и
 *  придумывать адрес под карточку нельзя — он приведёт в 404. */
function positionArticle(positionKey: string, arcanum: number): PositionArticle | undefined {
  const item = registryItem(positionKey, arcanum);
  if (!item) return undefined;
  return {
    href: positionArcanumHref(positionKey, arcanum),
    label: positionArcanumLabel(item),
  };
}

/** Ссылки «позиция → статья» бесплатных разделов для браузера: реестр читает корпус с диска. */
export function freePositionArticles(): PositionArticles {
  const out: PositionArticles = {};
  for (const key of FREE_POSITION_KEYS) {
    const byArcanum: Record<number, PositionArticle> = {};
    for (let n = 1; n <= 22; n++) {
      const article = positionArticle(key, n);
      if (article) byArcanum[n] = article;
    }
    if (Object.keys(byArcanum).length) out[key] = byArcanum;
  }
  return out;
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
          ? { role: characterRoleTemplate(n, key) }
          : spec.key === "comfort"
            ? { role: sectionRoleTemplate("comfort", n, key) }
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
