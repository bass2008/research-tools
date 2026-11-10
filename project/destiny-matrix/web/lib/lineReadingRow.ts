import type { Lang } from "./i18n/lang";
import type { ChakraReadingCell, ChakraReadingRow } from "./readingTypes";

// Без корпусов: раскладку берут и разбор, и статьи энциклопедии, а тексты читает каждый своим путём.
export interface LineCopy {
  heading: string;
  captions: string[];
  paragraphs: string[];
}

export interface LineCorpus {
  readings: Record<string, LineCopy>;
}

/** Разделы, которые читаются одной связной тройкой: толкование написано на каждую точную тройку. */
export const LINE_SECTIONS = ["material_karma", "parent_child_line"] as const;
export type LineSection = (typeof LINE_SECTIONS)[number];
export const isLineSection = (key: string): key is LineSection => (LINE_SECTIONS as readonly string[]).includes(key);
/** Файл корпуса в `content/<язык>/`: `material_karma` → `material-karma.json`. */
export const lineCorpusFile = (key: LineSection) => `${key.replaceAll("_", "-")}.json`;

/** 18 точек и разделы метода. Раздел-тройка приходит в язык целиком — страница вместе с корпусом
 *  толкований, поэтому язык без перевода раздела законно короче. */
export const positionPageCount = (has: (key: string) => boolean) => 38 + LINE_SECTIONS.filter(has).length;

const COLUMNS: Record<LineSection, readonly [ChakraReadingCell["column"], ChakraReadingCell["column"], ChakraReadingCell["column"]]> = {
  material_karma: ["C", "Q", "L"],
  parent_child_line: ["A", "O", "J"],
};

export interface LineLabels { title: string; topic: string; roles: readonly string[] }

/** Подписи блока из словаря `D.report.lines[key]`; словарь передаёт вызывающий, чтобы расчёт его не тянул. */
export function labelsFrom(entry: { title: Record<Lang, string>; topic: Record<Lang, string>; roles: Record<Lang, readonly string[]> },
  L: Lang): LineLabels {
  return { title: entry.title[L], topic: entry.topic[L], roles: entry.roles[L] };
}

/** Тройка в раскладке блока толкования: заголовок, три карты с подписями ролей, три абзаца. */
export function lineRowFrom(key: LineSection, numbers: readonly number[], copy: LineCopy, labels: LineLabels,
  titles?: readonly string[]): ChakraReadingRow {
  const roles = titles ?? labels.roles;
  return {
    key,
    title: labels.title,
    topic: labels.topic,
    heading: copy.heading,
    paragraphs: [...copy.paragraphs],
    cells: numbers.map((arcanum, i) => ({ column: COLUMNS[key][i], title: roles[i] ?? "", arcanum, caption: copy.captions[i] ?? "" })),
  };
}

const fold = (n: number) => {
  while (n > 22) n = String(n).split("").reduce((sum, digit) => sum + Number(digit), 0);
  return n;
};

/** C → Q → L. Матрицы, сохранённые до 08.11.2026 (примеры разбора, записи в базе), поля не несут:
 *  тройка считается из C и L по той же формуле. */
export function materialKarmaOf(m: { year: number; comfort_east: number; material_karma?: number[] }): number[] {
  if (m.material_karma?.length === 3) return m.material_karma;
  return [m.year, fold(m.year + m.comfort_east), m.comfort_east];
}

/** A → O → J: O = A + J — та же точка, что физика Аджны. */
export function parentChildLineOf(m: { day: number; comfort_west: number }): number[] {
  return [m.day, fold(m.day + m.comfort_west), m.comfort_west];
}

export function lineOf(key: LineSection, m: { day: number; year: number; comfort_west: number; comfort_east: number;
  material_karma?: number[] }): number[] {
  return key === "material_karma" ? materialKarmaOf(m) : parentChildLineOf(m);
}
