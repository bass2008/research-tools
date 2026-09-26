import catalogEn from "@/content/en/arcana-catalog.json";
import catalogRu from "@/content/ru/arcana-catalog.json";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "./i18n/lang";
import { localized } from "./i18n/localized";

/** Client-safe arcanum metadata generated from content/data/arcana.json. */
export interface ArcanumSource {
  n: number;
  slug: string;
  title: string;
  short: string;
}

/** A locale-bound view; safe to use alongside other languages. */
export const forLocale = localized((L: Locale) => {
  const catalog = ({ ru: catalogRu, en: catalogEn } as const)[L];

  const ARCANA: ArcanumSource[] = catalog.items.map((item) => ({ ...item }));

  const BY_N = new Map(ARCANA.map((arcanum) => [arcanum.n, arcanum]));

  function roman(n: number): string {
    if (!Number.isInteger(n) || n < 1) return String(n);
    const values: Array<[number, string]> = [
      [10, "X"],
      [9, "IX"],
      [5, "V"],
      [4, "IV"],
      [1, "I"],
    ];
    let rest = n;
    let result = "";
    for (const [value, sign] of values) {
      while (rest >= value) {
        result += sign;
        rest -= value;
      }
    }
    return result;
  }

  function arcanum(n: number): ArcanumSource {
    const value = BY_N.get(n);
    if (!value) throw new Error(`нет аркана ${n}`);
    return value;
  }

  function arcanumTitle(n: number): string {
    return arcanum(n).title;
  }

  function arcanumShort(n: number): string {
    return arcanum(n).short;
  }
  return { ARCANA, roman, arcanum, arcanumTitle, arcanumShort };
});

// Compatibility for callers that explicitly use the deployment default.
export const { ARCANA, roman, arcanum, arcanumTitle, arcanumShort } = forLocale(defaultLocale);
