// Порт engine/sections.py. Медицинских формулировок и обещаний гарантий здесь быть не должно:
// гадание рекламируется без документов, целительство — только с разрешением органа власти.
//
// Модуль серверный. Здесь лежит то, за что платят: толкования и подписи позиций восемнадцати
// платных разделов. Клиентские компоненты берут публичную половину из
// components/publicSpec.ts; импорт этого модуля из кода с "use client" положил бы платные
// тексты в чанк, а чанк видно в исходнике страницы (сторож — scripts/check-build.cjs).
import {
  CATALOG,
  FREE_DETAIL,
  arcanumHref,
  type Access,
  type PositionOut,
  type SectionDetail,
  type PositionTexts,
  type SectionOut,
} from "../components/publicSpec";
import { arcanumInPosition } from "./content";
import type { Matrix } from "./matrix";

export type { Access, PositionOut, PositionTexts, SectionOut };
export { arcanumHref };

export interface SectionSpec {
  key: string;
  title: string;
  lead: string;
  access: Access;
  positions: (m: Matrix) => Array<[string, number]>;
}

const PAID_DETAIL: Record<string, SectionDetail> = {
  profession: {
    lead: "Через какое дело ваша энергия превращается в результат.",
    positions: (m) => [
      ["Талант", m.talent[0]],
      ["Как раскрывается талант", m.talent[1]],
      ["Итог линии таланта", m.talent[2]],
    ],
  },
  realisation: {
    lead: "Куда ведёт ваша линия, если не сопротивляться.",
    positions: (m) => [
      ["Миссия", m.mission],
      ["Личное предназначение", m.purpose_personal],
      ["Социальное предназначение", m.purpose_social],
    ],
  },
  karma40: {
    lead: "Что нужно пройти в первой половине пути.",
    positions: (m) => [
      ["Полученное наследие", m.inheritance],
      ["Комфорт через личность", m.comfort_west],
    ],
  },
  resources: {
    lead: "Канал, по которому в жизнь приходит достаток.",
    positions: (m) => [
      ["Денежный канал", m.money[0]],
      ["Условие потока", m.money[1]],
    ],
  },
  family_gifts: {
    lead: "Что род передал вам как силу.",
    positions: (m) => [
      ["Мужская линия рода", m.father_line],
      ["Женская линия рода", m.mother_line],
      ["Итог мужской ветви", m.social_male[2]],
      ["Итог женской ветви", m.social_female[2]],
    ],
  },
  soul_tasks: {
    lead: "Работа, которую видно только изнутри.",
    positions: (m) => [
      ["Итог неба", m.sky[2]],
      ["Первая задача неба", m.sky[0]],
      ["Вторая задача неба", m.sky[1]],
    ],
  },
  past_lives: {
    lead: "Кармический хвост: то, что пришло с вами.",
    positions: (m) => [
      ["Корень хвоста", m.karmic_tail[0]],
      ["Проявление хвоста", m.karmic_tail[1]],
      ["Итог хвоста", m.karmic_tail[2]],
    ],
  },
  purpose: {
    lead: "Четыре уровня: личный, социальный, духовный и планетарный.",
    positions: (m) => [
      ["Личное предназначение", m.purpose_personal],
      ["Социальное предназначение", m.purpose_social],
      ["Духовная гармония", m.harmony],
      ["Планетарная задача", m.planetary],
    ],
  },
  money: {
    lead: "Где деньги приходят легко, а где перекрыт канал.",
    positions: (m) => [
      ["Денежный канал", m.money[0]],
      ["Условие потока", m.money[1]],
      ["Итог денежной линии", m.money[2]],
      ["Итог земли", m.ground[2]],
    ],
  },
  money40: {
    lead: "Вторая половина пути живёт по другой энергии.",
    positions: (m) => [
      ["Условие потока", m.money[1]],
      ["Опора в материальном", m.comfort_east],
    ],
  },
  relations: {
    lead: "Что вы приносите в пару и что ищете в другом.",
    positions: (m) => [
      ["Линия отношений", m.love[0]],
      ["Как проявляется линия", m.love[1]],
      ["Итог линии отношений", m.love[2]],
      ["Комфорт в отношениях", m.comfort_north],
    ],
  },
  parents_children: {
    lead: "Что передано вам и что вы передаёте дальше.",
    positions: (m) => [
      ["Мужская линия рода", m.father_line],
      ["Женская линия рода", m.mother_line],
      ["Дети и продолжение", m.descendants],
    ],
  },
  ancestry: {
    lead: "Программа рода и ваша роль в ней.",
    positions: (m) => [
      ["Полученное наследие", m.inheritance],
      ["Итог мужской ветви", m.social_male[2]],
      ["Итог женской ветви", m.social_female[2]],
      ["Планетарная задача", m.planetary],
    ],
  },
  body_resource: {
    lead: "Как вы наполняетесь и где теряете силы. Это не медицинская рекомендация.",
    positions: (m) => [
      ["Опора тела", m.chakras[6].physics],
      ["Энергия опоры", m.chakras[6].energy],
      ["Итог опоры тела", m.chakras[6].emotions],
    ],
  },
  chakras: {
    lead: "Семь уровней в трёх колонках: материя, энергия и чувства.",
    positions: (m) => [
      ...m.chakras.map((r) => [`${r.title} · физика`, r.physics] as [string, number]),
      ["Итог физики", m.chakra_totals.physics],
      ["Итог энергии", m.chakra_totals.energy],
      ["Итог эмоций", m.chakra_totals.emotions],
    ],
  },
  rest: {
    lead: "Чем вы восстанавливаетесь по-настоящему.",
    positions: (m) => [
      ["Радость и творчество", m.chakras[5].emotions],
      ["Центр карты", m.center],
    ],
  },
  loops: {
    lead: "Сюжеты, которые возвращаются, пока не пройдены.",
    positions: (m) => [
      ["Итог хвоста", m.karmic_tail[2]],
      ["Центр карты", m.center],
      ["Духовная гармония", m.harmony],
    ],
  },
  years: {
    lead: "Какая энергия ведёт вас в каждом десятилетии.",
    positions: (m) => m.age_scale.map((p) => [`${p.from}–${p.to} лет`, p.arcanum] as [string, number]),
  },
};

/** Двадцать разделов: имена и порядок — из каталога, содержимое — из двух половин. */
export const SPEC: SectionSpec[] = CATALOG.map((meta) => {
  const detail = meta.access === "free" ? FREE_DETAIL[meta.key] : PAID_DETAIL[meta.key];
  if (!detail) throw new Error(`раздел ${meta.key} без содержимого`);
  return { key: meta.key, title: meta.title, access: meta.access, ...detail };
});

export const FREE_KEYS: string[] = SPEC.filter((s) => s.access === "free").map((s) => s.key);
export const PAID_KEYS: string[] = SPEC.filter((s) => s.access === "paid").map((s) => s.key);
export const SECTION_KEYS: string[] = SPEC.map((s) => s.key);

// Разбор открыт целиком или не открыт вовсе: тарифов, открывающих часть разделов, больше нет.
// Решает это апстрим по правам на конкретную матрицу, здесь только печать.

/** Собрать разделы. При unlocked=false платные приходят без позиций — только анонс. */
export function build(m: Matrix, unlocked = false): SectionOut[] {
  return SPEC.map((spec) => {
    const positions = spec.positions(m).map(([label, arcanum]) => ({
      label,
      arcanum,
      href: arcanumHref(arcanum),
      // толкование именно этого аркана в этом разделе: универсальное описание аркана
      // человек и так прочитает в энциклопедии, платит он за разбор своего случая
      text: arcanumInPosition(arcanum, spec.key),
    }));
    const out: SectionOut = {
      key: spec.key,
      title: spec.title,
      lead: spec.lead,
      access: spec.access,
      positions,
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
  for (const spec of SPEC) {
    if (spec.access !== "free") continue;
    const byArcanum: Record<number, string> = {};
    for (let n = 1; n <= 22; n++) byArcanum[n] = arcanumInPosition(n, spec.key);
    out[spec.key] = byArcanum;
  }
  return out;
}

/** Все арканы, на которые ссылается отчёт — для перелинковки с энциклопедией. */
export function referencedArcana(m: Matrix): number[] {
  const seen = new Set<number>();
  for (const spec of SPEC) for (const [, arcanum] of spec.positions(m)) seen.add(arcanum);
  return [...seen].sort((a, b) => a - b);
}

export function sectionByKey(key: string): SectionSpec | undefined {
  return SPEC.find((s) => s.key === key);
}
