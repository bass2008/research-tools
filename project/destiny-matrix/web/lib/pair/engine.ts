// Матрица пары по Лисовской: каждая точка — свёртка суммы одноимённых точек двух личных матриц,
// а личное, социальное и духовное предназначения пары пересчитываются из её же сумм.
// Личные точки берутся из lib/matrix.ts: формулы личной матрицы живут в одном месте.
import { fold, forLocale as localizedMatrix, type Matrix } from "../matrix";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "../i18n/lang";

export const SUMMED = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q",
  "R", "R1", "R2", "S", "T", "sky", "ground", "male", "female",
] as const;

export type SummedKey = (typeof SUMMED)[number];
export type PointKey = SummedKey | "personal" | "social" | "spiritual";
export type Points = Record<PointKey, number>;

export interface PairResult {
  a: Points;
  b: Points;
  p: Points;
}

/** Буквы точек из личной матрицы сайта. Б2, В2, Г2 и зелёные S, T движок отдельно не хранит. */
export function pointsOf(m: Matrix): Points {
  const A = m.day, B = m.month, C = m.year, D = m.mission, E = m.center;
  const J = m.comfort_west, K = m.comfort_north, L = m.comfort_east, M = m.comfort_south;
  return {
    A, B, C, D, E,
    F: m.father_line, G: m.mother_line, H: m.descendants, I: m.inheritance,
    J, K, L, M,
    N: m.karmic_tail[1],
    O: fold(A + J), P: fold(B + K), Q: fold(C + L),
    R: m.money[2], R1: m.love[1], R2: m.money[1],
    S: fold(J + E), T: fold(K + E),
    sky: m.sky[2], ground: m.ground[2], male: m.social_male[2], female: m.social_female[2],
    personal: m.purpose_personal, social: m.purpose_social, spiritual: m.harmony,
  };
}

export function combine(a: Points, b: Points): Points {
  const p = {} as Points;
  for (const key of SUMMED) p[key] = fold(a[key] + b[key]);
  p.personal = fold(p.sky + p.ground);
  p.social = fold(p.male + p.female);
  p.spiritual = fold(p.personal + p.social);
  return p;
}

/** Пол на числа не влияет (Decision 1), поэтому в паре его нет. Ошибка даты — MatrixError с
 *  текстом на языке вызова. */
export function personalPoints(birth: string, locale?: Locale): Points {
  return pointsOf(localizedMatrix(locale ?? defaultLocale).calculate(birth, "f"));
}

export function computePair(aBirth: string, bBirth: string, locale?: Locale): PairResult {
  const a = personalPoints(aBirth, locale);
  const b = personalPoints(bBirth, locale);
  return { a, b, p: combine(a, b) };
}
