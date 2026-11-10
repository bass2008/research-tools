import materialEn from "../content/en/material-karma.json";
import materialRu from "../content/ru/material-karma.json";
import parentChildEn from "../content/en/parent-child-line.json";
import parentChildRu from "../content/ru/parent-child-line.json";
import { D } from "./i18n";
import type { Lang } from "./i18n/lang";
import { labelsFrom, lineOf, lineRowFrom, type LineCorpus, type LineSection } from "./lineReadingRow";
import type { Matrix } from "./matrix";
import type { ChakraReadingRow } from "./readingTypes";

const CORPORA: Record<LineSection, Record<Lang, LineCorpus>> = {
  material_karma: { ru: materialRu, en: materialEn },
  parent_child_line: { ru: parentChildRu, en: parentChildEn },
};

/** Связное толкование своей тройки; null, если на языке его ещё нет. */
export function lineReadingRow(key: LineSection, matrix: Matrix, locale: Lang, titles: readonly string[]): ChakraReadingRow | null {
  const numbers = lineOf(key, matrix);
  const copy = CORPORA[key][locale].readings[numbers.join("-")];
  return copy ? lineRowFrom(key, numbers, copy, labelsFrom(D.report.lines[key], locale), titles) : null;
}
