import en from "../content/en/material-karma.json";
import ru from "../content/ru/material-karma.json";
import type { Lang } from "./i18n/lang";
import type { Matrix } from "./matrix";
import { materialKarmaOf, materialKarmaRowFrom, type MaterialKarmaCorpus } from "./materialKarmaRow";
import type { ChakraReadingRow } from "./readingTypes";

const CORPUS: Record<Lang, MaterialKarmaCorpus> = { ru, en };

export const materialKarmaKey = (matrix: Matrix) => materialKarmaOf(matrix).join("-");

/** Связное толкование своей тройки C–Q–L; null, если на языке его ещё нет. */
export function materialKarmaRow(matrix: Matrix, locale: Lang, title: string, topic: string,
  titles: readonly string[]): ChakraReadingRow | null {
  const copy = CORPUS[locale].readings[materialKarmaKey(matrix)];
  return copy ? materialKarmaRowFrom(materialKarmaOf(matrix), copy, title, topic, titles) : null;
}
