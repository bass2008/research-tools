import child from "@/content/individual-examples/child.json";
import pair from "@/content/individual-examples/pair.json";
import personal from "@/content/individual-examples/personal.json";
import year from "@/content/individual-examples/year.json";
import pairEn from "@/content/individual-examples/en/pair.json";
import personalEn from "@/content/individual-examples/en/personal.json";
import yearEn from "@/content/individual-examples/en/year.json";
import type { Lang } from "./i18n/hosts";
import type { IndividualReading } from "./individualReading";

export const EXAMPLE_SLUGS = ["personal", "pair", "year", "child"] as const;
export type ExampleSlug = typeof EXAMPLE_SLUGS[number];

// Each sample reading is written in every language of the site, like the readings themselves; the child's matrix
// is sold in Russian only, so English shows the Russian text out of the index.
const EXAMPLES = {
  ru: { personal, pair, year, child },
  en: { personal: personalEn, pair: pairEn, year: yearEn, child: null },
} as unknown as Record<Lang, Record<ExampleSlug, IndividualReading | null>>;

export function individualExample(slug: string, locale: Lang = "ru"): IndividualReading | null {
  if (!(EXAMPLE_SLUGS as readonly string[]).includes(slug)) return null;
  return EXAMPLES[locale]?.[slug as ExampleSlug] ?? EXAMPLES.ru[slug as ExampleSlug];
}

/** The first sentence of a lead: the example's card on the landing and its description for search. */
export function leadSentence(lead: string): string {
  const cut = lead.indexOf(". ");
  return cut > 0 ? lead.slice(0, cut + 1) : lead;
}

export const EXAMPLE_LABEL: Record<ExampleSlug, [string, string]> = {
  personal: ["Личный разбор", "Personal reading"],
  pair: ["Совместимость пары", "Couple compatibility"],
  year: ["Разбор года", "Year reading"],
  child: ["Детская матрица", "Child’s matrix"],
};
