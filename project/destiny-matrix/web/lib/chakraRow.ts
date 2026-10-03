import { DR } from "./i18n";
import type { Lang } from "./i18n/lang";
import type { ChakraReadingRow } from "./readingTypes";

export interface ChakraCopy {
  heading: string;
  captions: string[];
  paragraphs: string[];
}

export interface ChakraCorpus {
  intro: string;
  note: string;
  empty_reading: ChakraCopy;
  chakras: Record<string, { topic: string; readings: Record<string, ChakraCopy> }>;
}

export const CHAKRA_COLUMNS = ["physics", "energy", "emotions"] as const;

export function chakraRow(corpus: ChakraCorpus, locale: Lang, key: string, title: string, numbers: number[], copy: ChakraCopy): ChakraReadingRow {
  const titles = {
    physics: DR.chakraYears.columnPhysicsTitle[locale],
    energy: DR.chakraYears.columnEnergyTitle[locale],
    emotions: DR.chakraYears.columnEmotionsTitle[locale],
  };
  return {
    key, title, topic: corpus.chakras[key]?.topic ?? "",
    heading: copy.heading, paragraphs: [...copy.paragraphs],
    cells: CHAKRA_COLUMNS.map((column, index) => ({
      column, title: titles[column], arcanum: numbers[index], caption: copy.captions[index] ?? "",
    })),
  };
}
