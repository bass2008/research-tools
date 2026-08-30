// Публичная половина спецификации отчёта — всё, что можно отдать браузеру: имена двадцати
// разделов, подписи позиций двух бесплатных и подписи точек карты.
//
// Толкования и подписи позиций восемнадцати платных разделов лежат в lib/sections.ts, и
// импортирует её только серверный код. Разделение не косметическое: клиентский чанк виден в
// исходнике страницы, поэтому один импорт lib/sections.ts из компонента с "use client"
// выкладывает наружу то, за что платят (сторож — scripts/check-build.cjs).
import type { Matrix } from "./matrix";

export type Access = "free" | "paid";

export interface PositionOut {
  label: string;
  arcanum: number;
  href: string;
  /** толкование этого аркана именно в этой позиции — за него и платят */
  text?: string;
}

/** Толкования «аркан → текст» по ключу раздела. Клиенту сервер отдаёт только бесплатные. */
export type PositionTexts = Record<string, Record<number, string>>;

export interface SectionOut {
  key: string;
  title: string;
  lead: string;
  access: Access;
  positions: PositionOut[];
  teaser?: string;
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
  positions: (m: Matrix) => Array<[string, number]>;
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
  entityType: "karmic_tail" | "position";
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

export const CATALOG: SectionMeta[] = (catalog.items as SectionMeta[]).map((s) => ({
  key: s.key,
  title: s.title,
  access: s.access,
}));

export const FREE_DETAIL: Record<string, SectionDetail> = {
  character: {
    lead: "Как вы устроены и что в вас видят люди с первого взгляда.",
    positions: (m) => [
      ["Портрет личности", m.day],
      ["Духовная задача", m.month],
      ["Материальная задача", m.year],
    ],
  },
  comfort: {
    lead: "Центр E и две внутренние точки каналов на вертикальной оси.",
    positions: (m) => [
      ["Центр карты", m.center],
      ["Вход линии отношений и хвоста", m.comfort_south],
      ["Внутренняя точка таланта", m.comfort_north],
    ],
  },
};

/**
 * Разбор для браузера: два бесплатных раздела посчитаны, восемнадцать платных — только именем.
 * Толкования и позиции платных приходят с сервера отрисованной страницей, здесь их нет и быть
 * не может.
 */
// Позиции, у которых есть собственное толкование. Без этой карты весь раздел печатался пулом
// ведущей позиции: под «Комфортом в отношениях» стоял текст про центр карты.
export const POINT_KEY: Record<string, string> = {
  "Портрет личности": "day",
  "Духовная задача": "month",
  "Материальная задача": "year",
  "Центр карты": "center",
  "Вход линии отношений и хвоста": "comfort_south",
  "Внутренняя точка таланта": "comfort_north",
  "Внутренняя левая точка": "comfort_west",
  "Вход денежной линии": "comfort_east",
  "Кармическая задача": "mission",
  "Личное предназначение": "purpose_personal",
  "Социальное предназначение": "purpose_social",
  "Духовное предназначение": "harmony",
  "Планетарное предназначение": "planetary",
  "Материальная женская линия рода": "inheritance",
  "Духовная мужская линия рода": "father_line",
  "Духовная женская линия рода": "mother_line",
  "Материальная мужская линия рода": "descendants",
};

export function buildFree(m: Matrix, texts?: PositionTexts): SectionOut[] {
  return CATALOG.map((meta) => {
    const detail = meta.access === "free" ? FREE_DETAIL[meta.key] : undefined;
    return {
      key: meta.key,
      title: meta.title,
      lead: detail?.lead ?? "",
      access: meta.access,
      positions: (() => {
        // текст ключуется позицией, а не разделом; повтор аркана внутри раздела печатался
        // дословно дважды — вместо второго абзаца отсылка к первому
        const seen = new Map<string, string>();
        return (detail?.positions(m) ?? []).map(([label, arcanum]) => {
          const key = POINT_KEY[label] ?? meta.key;
          const mark = `${key}:${arcanum}`;
          const first = seen.get(mark);
          if (!first) seen.set(mark, label);
          return {
            label,
            arcanum,
            href: arcanumHref(arcanum),
            text: first
              ? `Тот же аркан, что и в позиции «${first}»: толкование выше.`
              : texts?.[key]?.[arcanum],
          };
        });
      })(),
    };
  });
}

// Точки карты: ключи считает тип, поэтому новое числовое поле матрицы не проскочит без
// подписи, а исчезнувшее уронит сборку.
type ScalarKey = { [K in keyof Matrix]-?: Matrix[K] extends number ? K : never }[keyof Matrix];

export const POINT_LABELS: Record<ScalarKey, string> = {
  day: "Портрет личности — точка A",
  month: "Духовная задача — точка B",
  year: "Материальная задача — точка C",
  mission: "Кармическая задача — точка D",
  center: "Центр карты — зона комфорта",
  father_line: "Духовная мужская линия рода — точка F",
  mother_line: "Духовная женская линия рода — точка G",
  descendants: "Материальная мужская линия рода — точка H",
  inheritance: "Материальная женская линия рода — точка I",
  comfort_west: "Внутренняя левая точка — J",
  comfort_north: "Внутренняя точка таланта — K",
  comfort_east: "Вход денежной линии — L",
  comfort_south: "Вход линии отношений и хвоста — M",
  harmony: "Духовное предназначение",
  planetary: "Планетарное предназначение",
  purpose_personal: "Личное предназначение",
  purpose_social: "Социальное предназначение",
};

export const POINT_KEYS = Object.keys(POINT_LABELS) as ScalarKey[];
