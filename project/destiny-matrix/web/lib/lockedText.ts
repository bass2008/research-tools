// Закрытый текст: заглушка той же формы, что настоящий, и число его слов. Модуль без корпусов —
// его берут и личный разбор, и разбор пары, а платные тексты остаются на сервере.
import { D } from "./i18n";
import type { Lang } from "./i18n/lang";
import type { ChakraReadingRow, LongformReading } from "./readingTypes";

export function wordCount(paragraphs: string[]): number {
  return paragraphs.join(" ").split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

export function filler(length: number, locale: Lang, from: number, end = ""): string {
  if (length <= 0) return "";
  const sentences = D.report.lockedFiller[locale].split(/(?<=\.)\s+/);
  let text = "";
  for (let i = from; text.length < length; i++) text += (text ? " " : "") + sentences[i % sentences.length];
  const cut = text.length > length ? text.lastIndexOf(" ", length) : -1;
  return (cut > 0 ? text.slice(0, cut) : text).replace(/[\s,.;:—-]+$/u, "") + end;
}

/** Закрытый раздел: раскладка та же, но толкование заменено заглушкой той же формы. */
export function lockChakraReading(reading: LongformReading, locale: Lang): LongformReading {
  const lock = (row: ChakraReadingRow): ChakraReadingRow => ({
    ...row,
    heading: filler(row.heading.length, locale, 0),
    cells: row.cells.map((cell, i) => ({ ...cell, caption: filler(cell.caption.length, locale, i + 2) })),
    paragraphs: row.paragraphs.map((paragraph, i) => filler(paragraph.length, locale, i, ".")),
    lockedWords: wordCount(row.paragraphs),
  });
  return {
    ...reading,
    testId: "chakras-locked",
    chakraRows: reading.chakraRows?.map(lock),
    energyField: reading.energyField && lock(reading.energyField),
  };
}
