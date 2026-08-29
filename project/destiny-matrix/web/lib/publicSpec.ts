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
      ["Личность", m.day],
      ["Дано от рождения", m.month],
      ["Опора рода", m.year],
    ],
  },
  comfort: {
    lead: "Состояние, в котором вы восстанавливаетесь, а не тратитесь.",
    positions: (m) => [
      ["Центр карты", m.center],
      ["Комфорт в деле", m.comfort_south],
      ["Комфорт в отношениях", m.comfort_north],
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
  Личность: "day",
  "Дано от рождения": "month",
  "Опора рода": "year",
  "Центр карты": "center",
  "Комфорт в деле": "comfort_south",
  "Комфорт в отношениях": "comfort_north",
  "Комфорт через личность": "comfort_west",
  "Опора в материальном": "comfort_east",
  Миссия: "mission",
  "Личное предназначение": "purpose_personal",
  "Социальное предназначение": "purpose_social",
  "Духовная гармония": "harmony",
  "Планетарная задача": "planetary",
  "Полученное наследие": "inheritance",
  "Мужская линия рода": "father_line",
  "Женская линия рода": "mother_line",
  "Дети и продолжение": "descendants",
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
  day: "Личность — день рождения",
  month: "Дано от рождения — месяц",
  year: "Опора рода — год",
  mission: "Миссия",
  center: "Центр карты — зона комфорта",
  father_line: "Мужская линия рода",
  mother_line: "Женская линия рода",
  descendants: "Дети и продолжение",
  inheritance: "Полученное наследие",
  comfort_west: "Комфорт через личность",
  comfort_north: "Комфорт в отношениях",
  comfort_east: "Опора в материальном",
  comfort_south: "Комфорт в деле",
  harmony: "Духовная гармония",
  planetary: "Планетарная задача",
  purpose_personal: "Личное предназначение",
  purpose_social: "Социальное предназначение",
};

export const POINT_KEYS = Object.keys(POINT_LABELS) as ScalarKey[];
