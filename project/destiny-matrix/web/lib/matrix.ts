// Порт engine/matrix.py. Расчёт идёт в браузере: дата рождения не уходит на сервер.
// Любая правка формул обязана повторять правку в engine/matrix.py — сверка эталоном
// в lib/matrix.test.ts (golden.json снят запуском Python-движка).

// Только семь уровней чакр, а не весь снимок спецификации: движок работает в браузере, и
// импорт всего файла уносил в клиентский чанк подписи и формулы всех 21 точки вместе с
// признаком `access` платных разделов. Срез пишет `scripts/make-golden.py` из того же
// `spec/method.json`, поэтому источник истины один.
import chakraLevels from "./__fixtures__/chakras.json";
import { D, forLocale as localizedI18n } from "./i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "./i18n/lang";
import { localized } from "./i18n/localized";
import { forLocale as localizedPublicLabels } from "./i18n/publicLabels";

export type Sex = "m" | "f";

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

export class MatrixError extends Error {
  constructor(message: string, readonly messages?: Record<Locale, string>) {
    super(message);
  }

  messageFor(locale: Locale): string {
    return this.messages?.[locale] ?? D.calc.genericError[locale];
  }
}

export interface BirthParts {
  year: number;
  month: number;
  day: number;
}

/** A locale-bound view; safe to use alongside other languages. */
export const forLocale = localized((L: Locale) => {
  const { monthInDate, monthName } = localizedI18n(L);
  const { chakraHint, chakraTitle } = localizedPublicLabels(L);

  const ARCANA_MAX = 22;

  /** Месяцы для выпадающего списка формы: у русского — именительный, у английского тот же. */
  const MONTHS_ACC: readonly string[] = Array.from({ length: 12 }, (_, index) => {
    const name = monthName(index + 1);
    return name[0].toUpperCase() + name.slice(1);
  });

  function birthLabel(birth: string): string {
    const [y, m, d] = birth.split("-").map(Number);
    return `${d} ${monthInDate(m)} ${y}`;
  }

  function sexLabel(sex: Sex): string {
    return sex === "f" ? D.calc.femaleChart[L] : D.calc.maleChart[L];
  }

  // Ключи и порядок — из контракта, названия и подсказки — из словаря языка сборки.
  const CHAKRAS: ReadonlyArray<readonly [string, string, string]> = chakraLevels.map(
    ({ key }) => [key, chakraTitle(key), chakraHint(key)] as const,
  );

  /** Свести положительное целое к 1..22 повторным сложением цифр. */
  function fold(n: number): number {
    if (!Number.isInteger(n)) throw new MatrixError(`ожидалось целое число, получено ${n}`);
    if (n <= 0) throw new MatrixError(`ожидалось положительное число, получено ${n}`);
    while (n > ARCANA_MAX) n = digitSum(n);
    return n;
  }

  function digitSum(n: number): number {
    return String(Math.abs(n))
      .split("")
      .reduce((a, c) => a + Number(c), 0);
  }

  /** Год сворачивается по цифрам, пока не станет не больше 22: 1987 → 25 → 7. */
  function foldYear(year: number): number {
    return fold(digitSum(year));
  }

  function triad(a: number, b: number): Triad {
    return [a, b, fold(a + b)];
  }

  const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

  function parseBirth(birth: string | BirthParts): BirthParts {
    if (typeof birth !== "string") return birth;
    const m = ISO.exec(birth);
    if (!m) throw new MatrixError(D.calc.errors.format[L], D.calc.errors.format);
    return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  }

  function daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  function isRealDate({ year, month, day }: BirthParts): boolean {
    if (month < 1 || month > 12 || day < 1) return false;
    return day <= daysInMonth(year, month);
  }

  function toIso({ year, month, day }: BirthParts): string {
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
  function calculate(birth: string | BirthParts, sex: Sex = "f"): Matrix {
    const parts = parseBirth(birth);
    if (sex !== "m" && sex !== "f") throw new MatrixError(D.calc.errors.sex[L], D.calc.errors.sex);
    if (!Number.isInteger(parts.year) || !Number.isInteger(parts.month) || !Number.isInteger(parts.day))
      throw new MatrixError(D.calc.errors.parts[L], D.calc.errors.parts);
    if (!isRealDate(parts)) throw new MatrixError(D.calc.errors.unreal[L], D.calc.errors.unreal);
    if (isAfter(parts, todayParts())) throw new MatrixError(D.calc.errors.future[L], D.calc.errors.future);
    if (parts.year < 1900) throw new MatrixError(D.calc.errors.tooOld[L], D.calc.errors.tooOld);

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
  function values(m: Matrix): number[] {
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
  return { ARCANA_MAX, MONTHS_ACC, birthLabel, sexLabel, CHAKRAS, fold, digitSum, foldYear, parseBirth, daysInMonth, isRealDate, toIso, calculate, values };
});

// Compatibility for callers that explicitly use the deployment default.
export const { ARCANA_MAX, MONTHS_ACC, birthLabel, sexLabel, CHAKRAS, fold, digitSum, foldYear, parseBirth, daysInMonth, isRealDate, toIso, calculate, values } = forLocale(defaultLocale);
