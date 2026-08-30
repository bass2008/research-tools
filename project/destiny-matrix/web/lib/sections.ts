// Порт engine/sections.py. Медицинских формулировок и обещаний гарантий здесь быть не должно:
// гадание рекламируется без документов, целительство — только с разрешением органа власти.
//
// Модуль серверный. Здесь лежит то, за что платят: толкования и подписи позиций восемнадцати
// платных разделов. Клиентские компоненты берут публичную половину из
// lib/publicSpec.ts; импорт этого модуля из кода с "use client" положил бы платные
// тексты в чанк, а чанк видно в исходнике страницы (сторож — scripts/check-build.cjs).
import {
  CATALOG,
  FREE_DETAIL,
  POINT_KEY,
  arcanumHref,
  type Access,
  type PositionOut,
  type SectionDetail,
  type PositionTexts,
  type SectionOut,
} from "./publicSpec";
import { arcanumInPosition } from "./content";
import { builtInPositionText } from "./positionTexts";
import { calculate, type Matrix } from "./matrix";

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
      ["Духовная задача", m.talent[0]],
      ["Средняя точка таланта", m.talent[1]],
      ["Внутренняя точка таланта", m.talent[2]],
    ],
  },
  realisation: {
    lead: "Куда ведёт ваша линия, если не сопротивляться.",
    positions: (m) => [
      ["Кармическая задача", m.mission],
      ["Личное предназначение", m.purpose_personal],
      ["Социальное предназначение", m.purpose_social],
    ],
  },
  karma40: {
    lead: "Что нужно пройти в первой половине пути.",
    positions: (m) => [
      ["Материальная женская линия рода", m.inheritance],
      ["Внутренняя левая точка", m.comfort_west],
    ],
  },
  resources: {
    lead: "Канал, по которому в жизнь приходит достаток.",
    positions: (m) => [
      ["Вход денежной линии", m.money[0]],
      ["Денежное направление", m.money[1]],
    ],
  },
  family_gifts: {
    lead: "Что род передал вам как силу.",
    positions: (m) => [
      ["Духовная мужская линия рода", m.father_line],
      ["Духовная женская линия рода", m.mother_line],
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
      ["Вход линии отношений и хвоста", m.karmic_tail[0]],
      ["Средняя точка хвоста", m.karmic_tail[1]],
      ["Кармическая задача", m.karmic_tail[2]],
    ],
  },
  purpose: {
    lead: "Четыре уровня: личный, социальный, духовный и планетарный.",
    positions: (m) => [
      ["Личное предназначение", m.purpose_personal],
      ["Социальное предназначение", m.purpose_social],
      ["Духовное предназначение", m.harmony],
      ["Планетарное предназначение", m.planetary],
    ],
  },
  money: {
    lead: "Где деньги приходят легко, а где перекрыт канал.",
    positions: (m) => [
      ["Вход денежной линии", m.money[0]],
      ["Денежное направление", m.money[1]],
      ["Пересечение денег и отношений", m.money[2]],
      ["Итог земли", m.ground[2]],
    ],
  },
  money40: {
    lead: "Вторая половина пути живёт по другой энергии.",
    positions: (m) => [
      ["Денежное направление", m.money[1]],
      ["Вход денежной линии", m.comfort_east],
    ],
  },
  relations: {
    lead: "Что вы приносите в пару и что ищете в другом.",
    positions: (m) => [
      ["Вход линии отношений и хвоста", m.love[0]],
      ["Партнёрская точка", m.love[1]],
      ["Пересечение денег и отношений", m.love[2]],
      ["Внутренняя точка таланта", m.comfort_north],
    ],
  },
  parents_children: {
    lead: "Что передано вам и что вы передаёте дальше.",
    positions: (m) => [
      ["Духовная мужская линия рода", m.father_line],
      ["Духовная женская линия рода", m.mother_line],
      ["Материальная мужская линия рода", m.descendants],
    ],
  },
  ancestry: {
    lead: "Программа рода и ваша роль в ней.",
    positions: (m) => [
      ["Материальная женская линия рода", m.inheritance],
      ["Итог мужской ветви", m.social_male[2]],
      ["Итог женской ветви", m.social_female[2]],
      ["Планетарное предназначение", m.planetary],
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
      ["Кармическая задача", m.karmic_tail[2]],
      ["Центр карты", m.center],
      ["Духовное предназначение", m.harmony],
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
    // Один аркан может встать в разделе дважды (итоги мужской и женской ветви часто совпадают).
    // Второй раз печатать тот же абзац дословно незачем — вместо него отсылка к первому.
    const seen = new Map<string, string>();
    const positions = spec.positions(m).map(([label, arcanum]) => {
      const key = POINT_KEY[label] ?? spec.key;
      const mark = `${key}:${arcanum}`;
      const first = seen.get(mark);
      if (!first) seen.set(mark, label);
      return {
        label,
        arcanum,
        href: arcanumHref(arcanum),
        // толкование именно этого аркана в этой позиции: универсальное описание аркана
        // человек и так прочитает в энциклопедии, платит он за разбор своего случая
        text: first
          ? `Тот же аркан, что и в позиции «${first}»: толкование выше.`
          // Пул раздела «чакры» написан как вердикт обо всей карте («верх наполнен, низ пуст»),
          // и под каждым из восьми уровней стояли восемь взаимоисключающих вердиктов. Здесь
          // нужен текст про один уровень, поэтому берём рамку, а не корпус.
          : key === "chakras"
            ? builtInPositionText(arcanum, key)
            : arcanumInPosition(arcanum, key),
      };
    });
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

// подписи позиций от даты не зависят — карта нужна только чтобы получить их список
const SAMPLE = calculate("2000-01-01", "f");

/** Толкования бесплатных разделов для браузера: платные сюда не попадают намеренно. */
export function freePositionTexts(): PositionTexts {
  const out: PositionTexts = {};
  for (const spec of SPEC) {
    if (spec.access !== "free") continue;
    // Ключ пула — позиция, а не раздел: пул раздела «комфорт» на 18 арканах из 22 говорит
    // «такой центр», и эта фраза печаталась под «Комфортом в деле» и «в отношениях».
    const keys = new Set(spec.positions(SAMPLE).map(([label]) => POINT_KEY[label] ?? spec.key));
    for (const key of keys) {
      const byArcanum: Record<number, string> = {};
      for (let n = 1; n <= 22; n++) byArcanum[n] = arcanumInPosition(n, key);
      out[key] = byArcanum;
    }
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
