// Совместимость в работе по Лисовской (глава 5, «Сделка, бизнес-партнёр»): складываются не матрицы,
// а даты — день с днём, месяц с месяцем (правило двенадцати месяцев отменяется), год с годом; на
// полученную «дату» строится обычная матрица, блок предназначений не читается.
import { fold, foldYear, fromPoints, type Matrix } from "../matrix";
import type { Lang as Locale } from "../i18n/lang";
import { personalPoints } from "./engine";

/** Точки деловой матрицы — буквы главы 5 в скобках. */
export const BUSINESS_POINTS = [
  "base", // А, центр — на чём держится партнёрство
  "view", // Б — как партнёр видит вас, в чём ваше преимущество
  "plus", // В — плюс сделки, чего достигнете
  "minus", // Д — минусы, с которыми придётся смириться
  "gain", // Г — материальная выгода обоих
  "result", // Е — результаты и выгода
  "trouble", // Ё — трудности сотрудничества
  "hiddenA", // Ж — что другая сторона может скрыть
  "hiddenB", // З — то же
  "finIn", // Н — линия финансов
  "finWay", // М
  "finTotal", // Л — общая точка линий финансов и отношений
  "relCommon", // И — линия отношений
  "relTerms", // К
] as const;
export type BusinessPoint = (typeof BUSINESS_POINTS)[number];
export type BusinessPoints = Record<BusinessPoint, number>;

export function businessDate(aBirth: string, bBirth: string): { day: number; month: number; year: number } {
  const [ay, am, ad] = aBirth.split("-").map(Number);
  const [by, bm, bd] = bBirth.split("-").map(Number);
  return { day: fold(ad + bd), month: fold(am + bm), year: foldYear(ay + by) };
}

export function businessMatrix(aBirth: string, bBirth: string, locale?: Locale): Matrix {
  // даты проверяются тем же расчётом, что и у пары: ошибка — на языке вызова
  personalPoints(aBirth, locale);
  personalPoints(bBirth, locale);
  const { day, month, year } = businessDate(aBirth, bBirth);
  return fromPoints(day, month, year, `${day}.${month}.${year}`);
}

export function businessPoints(m: Matrix): BusinessPoints {
  return {
    base: m.center, view: m.day, plus: m.month, minus: m.mission, gain: m.year,
    result: m.father_line, trouble: m.mother_line, hiddenA: m.descendants, hiddenB: m.inheritance,
    finIn: m.comfort_east, finWay: m.money[1], finTotal: m.money[2],
    relCommon: m.comfort_south, relTerms: m.love[1],
  };
}

export type BusinessSphereId = "base" | "view" | "plus" | "minus" | "gain" | "result" | "trouble" | "hidden" | "finance" | "relations";

/** Сферы раздела — по таблице автора; у линий по блоку на точку, у Ж и З общий смысл. */
export const BUSINESS_SPHERES: Array<{ id: BusinessSphereId; points: BusinessPoint[] }> = [
  { id: "base", points: ["base"] },
  { id: "view", points: ["view"] },
  { id: "plus", points: ["plus"] },
  { id: "minus", points: ["minus"] },
  { id: "gain", points: ["gain"] },
  { id: "result", points: ["result"] },
  { id: "trouble", points: ["trouble"] },
  { id: "hidden", points: ["hiddenA", "hiddenB"] },
  { id: "finance", points: ["finIn", "finWay", "finTotal"] },
  { id: "relations", points: ["relCommon", "relTerms"] },
];

/** Открыто без покупки — как две любовные сферы. */
export const BUSINESS_FREE = ["base", "plus"] as const satisfies readonly (BusinessSphereId & BusinessPoint)[];

/** Семейство юнита точки: у Ж и З один смысл и общий текст. */
export function businessFamily(point: BusinessPoint): string {
  return point === "hiddenA" || point === "hiddenB" ? "hidden" : point;
}

export function businessUnitKey(point: BusinessPoint, n: number): string {
  return `business:${businessFamily(point)}:${n}`;
}

/** Ключи юнитов раздела; `free` — только открытые без покупки. */
export function businessUnitKeys(points: BusinessPoints, free = false): string[] {
  const spheres = free ? BUSINESS_SPHERES.filter((s) => (BUSINESS_FREE as readonly string[]).includes(s.id)) : BUSINESS_SPHERES;
  return [...new Set(spheres.flatMap((s) => s.points.map((p) => businessUnitKey(p, points[p]))))];
}
