// Порт engine/matrix.py. Расчёт идёт в браузере: дата рождения не уходит на сервер.
// Любая правка формул обязана повторять правку в engine/matrix.py — сверка эталоном
// в lib/matrix.test.ts (golden.json снят запуском Python-движка).

import method from "./__fixtures__/method.json";

export const ARCANA_MAX = 22;

export type Sex = "m" | "f";

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

/** Те же месяцы для выпадающего списка формы: «12 Декабря». */
export const MONTHS_ACC: readonly string[] = MONTHS.map((m) => m[0].toUpperCase() + m.slice(1));

export function birthLabel(birth: string): string {
  const [y, m, d] = birth.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function sexLabel(sex: Sex): string {
  return sex === "f" ? "женская" : "мужская";
}

export const CHAKRAS: ReadonlyArray<readonly [string, string, string]> = method.chakras.map(
  ({ key, title, hint }) => [key, title, hint] as const,
);


export interface ChakraRow {
  key: string;
  title: string;
  hint: string;
  physics: number;
  energy: number;
  emotions: number;
}

export interface ChakraTotals {
  physics: number;
  energy: number;
  emotions: number;
}

export interface AgeSector {
  from: number;
  to: number;
  arcanum: number;
}

export type Triad = [number, number, number];

export interface Matrix {
  birth: string;
  sex: Sex;

  day: number;
  month: number;
  year: number;
  mission: number;
  center: number;

  father_line: number;
  mother_line: number;
  descendants: number;
  inheritance: number;
  karmic_tail: number[];

  comfort_west: number;
  comfort_north: number;
  comfort_east: number;
  comfort_south: number;

  sky: Triad;
  ground: Triad;
  social_male: Triad;
  social_female: Triad;
  harmony: number;
  planetary: number;

  money: number[];
  love: number[];
  talent: number[];
  purpose_personal: number;
  purpose_social: number;

  chakras: ChakraRow[];
  chakra_totals: ChakraTotals;
  age_scale: AgeSector[];
}

export class MatrixError extends Error {}

/** Свести положительное целое к 1..22 повторным сложением цифр. */
export function fold(n: number): number {
  if (!Number.isInteger(n)) throw new MatrixError(`ожидалось целое число, получено ${n}`);
  if (n <= 0) throw new MatrixError(`ожидалось положительное число, получено ${n}`);
  while (n > ARCANA_MAX) n = digitSum(n);
  return n;
}

export function digitSum(n: number): number {
  return String(Math.abs(n))
    .split("")
    .reduce((a, c) => a + Number(c), 0);
}

/** Год сворачивается по цифрам, пока не станет не больше 22: 1987 → 25 → 7. */
export function foldYear(year: number): number {
  return fold(digitSum(year));
}

function triad(a: number, b: number): Triad {
  return [a, b, fold(a + b)];
}

export interface BirthParts {
  year: number;
  month: number;
  day: number;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseBirth(birth: string | BirthParts): BirthParts {
  if (typeof birth !== "string") return birth;
  const m = ISO.exec(birth);
  if (!m) throw new MatrixError("дата должна быть в формате YYYY-MM-DD");
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isRealDate({ year, month, day }: BirthParts): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

export function toIso({ year, month, day }: BirthParts): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(year, 4)}-${p(month)}-${p(day)}`;
}

function todayParts(): BirthParts {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

function isAfter(a: BirthParts, b: BirthParts): boolean {
  if (a.year !== b.year) return a.year > b.year;
  if (a.month !== b.month) return a.month > b.month;
  return a.day > b.day;
}

/**
 * Возрастная шкала: октаграмма проходится по кругу, каждый сектор — 10 лет.
 * Внутри сектора аркан один: методика меняет энергию на границе, а не плавно.
 */
function ageScale(m: Matrix): AgeSector[] {
  const ring = [
    m.day,
    m.father_line,
    m.month,
    m.mother_line,
    m.year,
    m.descendants,
    m.mission,
    m.inheritance,
  ];
  return ring.map((arc, i) => ({ from: i * 10, to: i * 10 + 10, arcanum: arc }));
}

function chakras(m: Matrix): { rows: ChakraRow[]; totals: ChakraTotals } {
  const pairs: ReadonlyArray<readonly [number, number]> = [
    [m.day, m.month],
    [fold(m.day + m.comfort_west), fold(m.month + m.comfort_north)],
    [m.comfort_west, m.comfort_north],
    [fold(m.comfort_west + m.center), fold(m.comfort_north + m.center)],
    [m.center, m.center],
    [m.comfort_east, m.comfort_south],
    [m.year, m.mission],
  ];
  const rows: ChakraRow[] = CHAKRAS.map(([key, title, hint], idx) => {
    const [physics, energy] = pairs[idx];
    return { key, title, hint, physics, energy, emotions: fold(physics + energy) };
  });
  const sum = (pick: (r: ChakraRow) => number) => fold(rows.reduce((s, r) => s + pick(r), 0));
  return {
    rows,
    totals: {
      physics: sum((r) => r.physics),
      energy: sum((r) => r.energy),
      emotions: sum((r) => r.emotions),
    },
  };
}

/** Полный расчёт. sex хранит идентичность карты, но не влияет ни на одно число. */
export function calculate(birth: string | BirthParts, sex: Sex = "f"): Matrix {
  const parts = parseBirth(birth);
  if (sex !== "m" && sex !== "f") throw new MatrixError("Выберите пол для однозначного названия карты.");
  if (!Number.isInteger(parts.year) || !Number.isInteger(parts.month) || !Number.isInteger(parts.day))
    throw new MatrixError("Проверьте дату: день, месяц и год — числами.");
  if (!isRealDate(parts)) throw new MatrixError("Такой даты нет в календаре — проверьте число и месяц.");
  if (isAfter(parts, todayParts())) throw new MatrixError("Дата рождения не может быть в будущем — выберите прошедший день.");
  if (parts.year < 1900) throw new MatrixError("Считаем даты рождения начиная с 1900 года.");

  const m = { birth: toIso(parts), sex } as Matrix;

  m.day = fold(parts.day);
  m.month = fold(parts.month);
  m.year = foldYear(parts.year);
  m.mission = fold(m.day + m.month + m.year);
  m.center = fold(m.day + m.month + m.year + m.mission);

  m.father_line = fold(m.day + m.month);
  m.mother_line = fold(m.month + m.year);
  m.descendants = fold(m.year + m.mission);
  m.inheritance = fold(m.mission + m.day);

  m.comfort_west = fold(m.day + m.center);
  m.comfort_north = fold(m.month + m.center);
  m.comfort_east = fold(m.year + m.center);
  m.comfort_south = fold(m.mission + m.center);

  m.sky = triad(m.month, m.mission);
  m.ground = triad(m.day, m.year);
  m.social_male = triad(m.father_line, m.descendants);
  m.social_female = triad(m.mother_line, m.inheritance);
  m.purpose_personal = fold(m.sky[2] + m.ground[2]);
  m.purpose_social = fold(m.social_male[2] + m.social_female[2]);
  m.harmony = fold(m.purpose_personal + m.purpose_social);
  m.planetary = fold(m.purpose_social + m.harmony);

  const crossing = fold(m.comfort_east + m.comfort_south);
  m.money = [m.comfort_east, fold(m.comfort_east + crossing), crossing];
  m.love = [m.comfort_south, fold(m.comfort_south + crossing), crossing];
  m.talent = [m.month, fold(m.month + m.comfort_north), m.comfort_north];
  m.karmic_tail = [m.comfort_south, fold(m.mission + m.comfort_south), m.mission];

  const ch = chakras(m);
  m.chakras = ch.rows;
  m.chakra_totals = ch.totals;
  m.age_scale = ageScale(m);
  return m;
}

/** Все арканы матрицы — для проверок и для сбора ссылок в энциклопедию. */
export function values(m: Matrix): number[] {
  const out = [
    m.day, m.month, m.year, m.mission, m.center,
    m.father_line, m.mother_line, m.descendants, m.inheritance,
    m.comfort_west, m.comfort_north, m.comfort_east, m.comfort_south,
    m.harmony, m.planetary, m.purpose_personal, m.purpose_social,
    ...m.sky, ...m.ground, ...m.social_male, ...m.social_female,
    ...m.karmic_tail, ...m.money, ...m.love, ...m.talent,
  ];
  for (const r of m.chakras) out.push(r.physics, r.energy, r.emotions);
  out.push(m.chakra_totals.physics, m.chakra_totals.energy, m.chakra_totals.emotions);
  for (const p of m.age_scale) out.push(p.arcanum);
  return out;
}
