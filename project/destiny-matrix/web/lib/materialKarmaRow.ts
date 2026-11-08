import type { ChakraReadingRow } from "./readingTypes";

// Без корпусов: раскладку берут и разбор, и статьи энциклопедии, а тексты читает каждый своим путём.
export interface MaterialKarmaCopy {
  heading: string;
  captions: string[];
  paragraphs: string[];
}

export interface MaterialKarmaCorpus {
  readings: Record<string, MaterialKarmaCopy>;
}

const COLUMNS = ["C", "Q", "L"] as const;

/** Тройка C–Q–L в раскладке блока толкования: заголовок, три карты с подписями ролей, три абзаца. */
export function materialKarmaRowFrom(numbers: readonly number[], copy: MaterialKarmaCopy, title: string, topic: string,
  titles: readonly string[]): ChakraReadingRow {
  return {
    key: "material_karma",
    title,
    topic,
    heading: copy.heading,
    paragraphs: [...copy.paragraphs],
    cells: numbers.map((arcanum, i) => ({ column: COLUMNS[i], title: titles[i] ?? "", arcanum, caption: copy.captions[i] ?? "" })),
  };
}

/** C → Q → L. Матрицы, сохранённые до 08.11.2026 (примеры разбора, записи в базе), поля не несут:
 *  тройка считается из C и L по той же формуле. */
export function materialKarmaOf(m: { year: number; comfort_east: number; material_karma?: number[] }): number[] {
  if (m.material_karma?.length === 3) return m.material_karma;
  let q = m.year + m.comfort_east;
  while (q > 22) q = String(q).split("").reduce((sum, digit) => sum + Number(digit), 0);
  return [m.year, q, m.comfort_east];
}
