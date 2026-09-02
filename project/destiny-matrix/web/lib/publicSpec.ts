// Публичная половина спецификации отчёта — всё, что можно отдать браузеру: имена двадцати
// разделов, подписи позиций двух бесплатных и подписи точек карты.
//
// Толкования и подписи позиций восемнадцати платных разделов лежат в lib/sections.ts, и
// импортирует её только серверный код. Разделение не косметическое: клиентский чанк виден в
// исходнике страницы, поэтому один импорт lib/sections.ts из компонента с "use client"
// выкладывает наружу то, за что платят (сторож — scripts/check-build.cjs).
import type { Matrix } from "./matrix";
import {
  CHARACTER_ROLE_META,
  buildCharacterConclusion,
  characterHref,
  type CharacterPositionKey,
  type CharacterRoleReading,
} from "./characterTypes";
import type {
  LongformReading,
  ReadingConclusion,
  ReadingRole,
  ReadingRoleTemplate,
} from "./readingTypes";
import { buildComfortConclusion, comfortHref, comfortRoleMeta } from "./comfortReading";
import { resolveSectionPositions, type SectionPositionDefinition } from "./sectionResolver";

export type Access = "free" | "paid";

export interface PositionOut {
  label: string;
  arcanum: number;
  href: string;
  /** толкование этого аркана именно в этой позиции — за него и платят */
  text?: string;
  /** Позиционный абзац разложен на четыре переиспользуемых кубика роли. */
  role?: ReadingRole;
}

/** Толкования «аркан → текст» по ключу раздела. Клиенту сервер отдаёт только бесплатные. */
export type PositionTextValue =
  | string
  | { role: ReadingRoleTemplate };
export type PositionTexts = Record<string, Record<number, PositionTextValue>>;

export interface SectionOut {
  key: string;
  title: string;
  lead: string;
  access: Access;
  positions: PositionOut[];
  teaser?: string;
  /** Полноэкранный персональный материал для разделов, где нужен связный разбор сочетания. */
  personalHref?: string;
  /** Компактный итог раздела без длинных связей персональной статьи. */
  conclusion?: ReadingConclusion;
  /** Сервер вкладывает полный текст в оплаченный/PDF-отчёт; браузер бесплатного расчёта — нет. */
  longform?: LongformReading;
  /** Для ordered-хвоста отчёт печатает готовую статью дословно, без сборки из трёх арканов. */
  fullArticle?: {
    short: string;
    sections: Array<{ h2: string; paragraphs: string[] }>;
    faq: Array<{ q: string; a: string }>;
  };
}

/** Имя раздела — публичное: оно и в энциклопедии, и в списке «под замком». */
export interface SectionMeta {
  key: string;
  title: string;
  access: Access;
}

/** Содержимое раздела: толкование и подписи позиций. Для платных живёт на сервере. */
export interface SectionDetail {
  lead: string;
  positions: (m: Matrix) => Array<[string, number, string]>;
}

export function arcanumHref(arcanum: number): string {
  return `/encyclopedia/arcanum/${arcanum}`;
}

export function positionHref(key: string): string {
  return `/encyclopedia/position/${key}`;
}

export interface SectionEntityLink {
  href: string;
  label: string;
  entityType: "character" | "comfort" | "profession" | "section_reading" | "karmic_tail" | "position";
  positionKey: string;
  entityKey: string;
}

/**
 * Одна точка принятия решения для ссылок из бесплатного и платного разбора.
 * Только раздел M–N–D является кармическим хвостом. Любая другая тройка остаётся
 * occurrence конкретной позиции и не получает ошибочную хвостовую статью лишь из-за
 * того, что рядом оказались три числа.
 */
export function sectionEntityLink(section: SectionOut): SectionEntityLink {
  if (
    (section.key === "character" || section.key === "comfort" || section.key === "profession")
    && section.personalHref
    && section.positions.length === 3
  ) {
    const key = section.positions.map((position) => position.arcanum).join("-");
    const labels = {
      character: `Подробнее про характер ${key} в энциклопедии →`,
      comfort: `Подробнее про центр и внутренние точки ${key} в энциклопедии →`,
      profession: `Подробнее про профессию и дело по душе ${key} в энциклопедии →`,
    } as const;
    return {
      href: section.personalHref,
      label: labels[section.key],
      entityType: section.key,
      positionKey: section.key,
      entityKey: key,
    };
  }
  if (section.key === "past_lives" && section.positions.length === 3) {
    const key = section.positions.map((position) => position.arcanum).join("-");
    return {
      href: `/encyclopedia/karmic-tail/${key}`,
      label: `Подробнее про кармический хвост ${key} в энциклопедии →`,
      entityType: "karmic_tail",
      positionKey: section.key,
      entityKey: key,
    };
  }
  if (section.personalHref) {
    const key = section.personalHref.split("/").at(-1)?.split("?")[0] ?? section.key;
    return {
      href: section.personalHref,
      label: `Подробнее про ваш раздел «${section.title}» в энциклопедии →`,
      entityType: "section_reading",
      positionKey: section.key,
      entityKey: key,
    };
  }
  return {
    href: positionHref(section.key),
    label: `Подробнее про раздел «${section.title}» в энциклопедии →`,
    entityType: "position",
    positionKey: section.key,
    entityKey: section.key,
  };
}

/**
 * Каталог разделов — снимок из движка (`web/scripts/make-catalog.py` по `engine/sections.py`).
 *
 * Список жил в трёх местах сразу, и переименование раздела ломало то витрину, то эталон
 * тестов. Теперь источник один: правится в движке, снимок пересобирается вместе с контентом.
 */
import catalog from "@/content/sections.json";
import pointCatalog from "@/content/points-catalog.json";

interface PublicSectionRow extends SectionMeta {
  lead?: string;
  positions?: SectionPositionDefinition[];
}

const ROWS = catalog.items as PublicSectionRow[];

if (ROWS.length !== 20 || new Set(ROWS.map((row) => row.key)).size !== 20) {
  throw new Error(`sections.json: ожидалось 20 уникальных разделов, получено ${ROWS.length}`);
}

export const CATALOG: SectionMeta[] = ROWS.map((s) => ({
  key: s.key,
  title: s.title,
  access: s.access,
}));

export const FREE_DETAIL: Record<string, SectionDetail> = Object.fromEntries(
  ROWS.filter((row) => row.access === "free").map((row) => {
    if (!row.lead || !row.positions?.length) {
      throw new Error(`sections.json: у бесплатного раздела ${row.key} нет содержимого`);
    }
    return [
      row.key,
      { lead: row.lead, positions: (matrix: Matrix) => resolveSectionPositions(row.positions!, matrix) },
    ];
  }),
);

/** Точки, значения которых уже видны в двух бесплатных разделах. */
export const FREE_POSITION_KEYS: string[] = [
  ...new Set(
    ROWS.filter((row) => row.access === "free").flatMap((row) =>
      (row.positions ?? []).map((position) => position.position_key),
    ),
  ),
];

/**
 * Разбор для браузера: два бесплатных раздела посчитаны, восемнадцать платных — только именем.
 * Толкования и позиции платных приходят с сервера отрисованной страницей, здесь их нет и быть
 * не может.
 */
export function buildFree(m: Matrix, texts?: PositionTexts): SectionOut[] {
  return CATALOG.map((meta) => {
    const detail = meta.access === "free" ? FREE_DETAIL[meta.key] : undefined;
    const positions = (() => {
      // текст ключуется позицией, а не разделом; повтор аркана внутри раздела печатался
      // дословно дважды — вместо второго абзаца отсылка к первому
      const seen = new Map<string, string>();
      return (detail?.positions(m) ?? []).map(([label, arcanum, key]) => {
        const mark = `${key}:${arcanum}`;
        const first = seen.get(mark);
        if (!first) seen.set(mark, label);
        const source = texts?.[key]?.[arcanum];
        const text = typeof source === "string" ? source : undefined;
        const template = typeof source === "object" ? source.role : undefined;
        const roleMeta = meta.key === "character"
          ? CHARACTER_ROLE_META[key as CharacterPositionKey]
          : meta.key === "comfort"
            ? comfortRoleMeta(key)
            : null;
        return {
          label,
          arcanum,
          href: arcanumHref(arcanum),
          text: first ? `Тот же аркан, что и в позиции «${first}»: толкование выше.` : text,
          ...(template && roleMeta
            ? {
                role: {
                  ...roleMeta,
                  arcanum,
                  ...template,
                },
              }
            : {}),
        };
      });
    })();
    const readingRoles = positions.flatMap((position) =>
      position.role ? [position.role] : [],
    );
    return {
      key: meta.key,
      title: meta.title,
      lead: detail?.lead ?? "",
      access: meta.access,
      ...(meta.key === "character"
        ? { personalHref: characterHref(m) }
        : meta.key === "comfort"
          ? { personalHref: comfortHref(m) }
          : {}),
      ...(readingRoles.length === 3
        ? {
            conclusion: meta.key === "character"
              ? buildCharacterConclusion(readingRoles as CharacterRoleReading[])
              : buildComfortConclusion(readingRoles),
          }
        : {}),
      positions,
    };
  });
}

// Подписи точек приходят из content/data/points.json через компактный клиентский каталог.
// Полный positions.json сюда импортировать нельзя: вместе с подписями он положил бы в браузер
// весь корпус энциклопедии.
type ScalarKey = { [K in keyof Matrix]-?: Matrix[K] extends number ? K : never }[keyof Matrix];

const POINT_ROWS = pointCatalog.items as Array<{ key: ScalarKey; report_label: string }>;
if (
  POINT_ROWS.length !== 17
  || new Set(POINT_ROWS.map((row) => row.key)).size !== POINT_ROWS.length
  || POINT_ROWS.some((row) => !row.key || !row.report_label)
) {
  throw new Error("points-catalog.json: ожидалось 17 уникальных подписанных точек");
}

export const POINT_LABELS = Object.fromEntries(
  POINT_ROWS.map((row) => [row.key, row.report_label]),
) as Record<ScalarKey, string>;

export const POINT_KEYS = POINT_ROWS.map((row) => row.key);
