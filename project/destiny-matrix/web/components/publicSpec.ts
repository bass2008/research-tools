// Публичная половина спецификации отчёта — всё, что можно отдать браузеру: имена двадцати
// разделов, подписи позиций шести бесплатных и подписи точек карты.
//
// Толкования и подписи позиций четырнадцати платных разделов лежат в lib/sections.ts, и
// импортирует её только серверный код. Разделение не косметическое: клиентский чанк виден в
// исходнике страницы, поэтому один импорт lib/sections.ts из компонента с "use client"
// выкладывает наружу 14 толкований и 57 подписей позиций — то, за что платят.
//
// Путь до lib относительный, а не через алиас `@/`: модуль подтягивается в vitest через
// lib/sections.ts, а vitest.config.ts алиасов не знает.
import type { Matrix } from "../lib/matrix";

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

/** Порядок разделов — здесь: SPEC в lib/sections.ts собирается по этому списку. */
export const CATALOG: SectionMeta[] = [
  { key: "character", title: "Характер и личные качества", access: "free" },
  { key: "comfort", title: "Что даёт вам внутренний комфорт", access: "free" },
  { key: "profession", title: "Профессия и дело по душе", access: "paid" },
  { key: "realisation", title: "Путь самореализации", access: "paid" },
  { key: "karma40", title: "Кармическая задача до 40 лет", access: "paid" },
  { key: "resources", title: "Что открывает вам блага и ресурс", access: "paid" },
  { key: "family_gifts", title: "Поддержка и дары вашего рода", access: "paid" },
  { key: "soul_tasks", title: "Духовные задачи и уроки души", access: "paid" },
  { key: "past_lives", title: "Задачи прошлых воплощений", access: "paid" },
  { key: "purpose", title: "Ваше предназначение", access: "paid" },
  { key: "money", title: "Деньги в матрице судьбы", access: "paid" },
  { key: "money40", title: "Как меняются деньги после 40 лет", access: "paid" },
  { key: "relations", title: "Отношения в матрице судьбы", access: "paid" },
  { key: "parents_children", title: "Карма отношений с родителями и детьми", access: "paid" },
  { key: "ancestry", title: "Родовые задачи до седьмого колена", access: "paid" },
  { key: "body_resource", title: "Ресурс тела и восстановление", access: "paid" },
  { key: "chakras", title: "Карта энергий по чакрам", access: "paid" },
  { key: "rest", title: "Ваш идеальный формат отдыха", access: "paid" },
  { key: "loops", title: "Программы: что повторяется по кругу", access: "paid" },
  { key: "years", title: "Разбор по годам до 80 лет", access: "paid" },
];

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
export function buildFree(m: Matrix, texts?: PositionTexts): SectionOut[] {
  return CATALOG.map((meta) => {
    const detail = meta.access === "free" ? FREE_DETAIL[meta.key] : undefined;
    const forKey = texts?.[meta.key];
    return {
      key: meta.key,
      title: meta.title,
      lead: detail?.lead ?? "",
      access: meta.access,
      positions: (detail?.positions(m) ?? []).map(([label, arcanum]) => ({
        label,
        arcanum,
        href: arcanumHref(arcanum),
        text: forKey?.[arcanum],
      })),
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
