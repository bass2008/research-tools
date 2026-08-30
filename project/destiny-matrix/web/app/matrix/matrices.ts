// Матрица зависит не от даты, а от тройки (день, месяц, год) после свёртки: десятки тысяч
// реальных дат рождения дают 5544 разные карты — 22 x 12 x 21. Список троек считает engine/precompute.py
// и кладёт в content/matrices.json; здесь только разбор слага и соседи для перелинковки.
import { matrixSlugs } from "@/lib/content";
import { fold, foldYear, isRealDate } from "@/lib/matrix";

export const DAY_KEYS: number[] = Array.from({ length: 22 }, (_, i) => i + 1);
export const MONTH_KEYS: number[] = Array.from({ length: 12 }, (_, i) => i + 1);

export const MONTHS_NOM = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

export const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export interface MatrixKey {
  day: number;
  month: number;
  year: number;
}

export function slugOf(k: MatrixKey): string {
  return `${k.day}-${k.month}-${k.year}`;
}

export function parseSlug(raw: string): MatrixKey | null {
  const m = /^(\d{1,2})-(\d{1,2})-(\d{1,2})$/.exec(raw);
  if (!m) return null;
  const [day, month, year] = m.slice(1).map(Number);
  if (day < 1 || day > 22 || month < 1 || month > 12 || year < 1 || year > 22) return null;
  return { day, month, year };
}

// Свёртка года даёт не все 22 значения: у годов 1900–2026 сумма цифр сводится к 2..22,
// единицы среди них нет. Список берётся из самого файла, а не из формулы, — тогда набор
// страниц и набор ссылок расходиться не могут.
let YEARS: number[] | null = null;

export function yearKeys(): number[] {
  if (YEARS) return YEARS;
  const seen = new Set<number>();
  for (const slug of matrixSlugs()) {
    const k = parseSlug(slug);
    if (k) seen.add(k.year);
  }
  YEARS = [...seen].sort((a, b) => a - b);
  return YEARS;
}

const LAST_YEAR = new Date().getFullYear();

/** Календарные годы, которые сворачиваются в этот аркан года. */
export function calendarYears(key: number): number[] {
  const out: number[] = [];
  for (let y = 1900; y <= LAST_YEAR; y++) if (foldYear(y) === key) out.push(y);
  return out;
}

/** Реальные даты рождения с таким арканом дня после повторного сложения цифр. */
export function birthDates(k: MatrixKey): Array<{ iso: string; label: string }> {
  const days = Array.from({ length: 31 }, (_, index) => index + 1).filter(
    (day) => fold(day) === k.day,
  );
  const out: Array<{ iso: string; label: string }> = [];
  // ненаступивший день не бывает датой рождения: калькулятор такие отвергает, а страница
  // печатала их в списке «дат рождения» текущего года
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;
  for (const year of calendarYears(k.year)) {
    for (const day of days) {
      if (!isRealDate({ year, month: k.month, day })) continue;
      const iso = `${year}-${String(k.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (iso > todayIso) continue;
      out.push({ iso, label: `${day} ${MONTHS_GEN[k.month - 1]} ${year}` });
    }
  }
  return out;
}

export interface Neighbour {
  slug: string;
  label: string;
}

export function sameDayMonth(k: MatrixKey): Neighbour[] {
  return yearKeys()
    .filter((year) => year !== k.year)
    .map((year) => ({ slug: slugOf({ ...k, year }), label: `год ${year}` }));
}

export function sameDayYear(k: MatrixKey): Neighbour[] {
  return MONTH_KEYS.filter((month) => month !== k.month).map((month) => ({
    slug: slugOf({ ...k, month }),
    label: MONTHS_NOM[month - 1],
  }));
}

export function sameMonthYear(k: MatrixKey): Neighbour[] {
  return DAY_KEYS.filter((day) => day !== k.day).map((day) => ({
    slug: slugOf({ ...k, day }),
    label: `день ${day}`,
  }));
}

export function matrixHref(slug: string): string {
  return `/matrix/${slug}`;
}
