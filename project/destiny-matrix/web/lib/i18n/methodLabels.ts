import labelsEn from "@/lib/__fixtures__/labels/en.json";
import labelsRu from "@/lib/__fixtures__/labels/ru.json";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "./lang";
import { localized } from "./localized";

/** Слова метода на языке сборки: заголовки разделов, подписи позиций, названия чакр.
 *
 *  Ключи, селекторы и формулы остаются в контракте (`spec/sections.json`, `spec/method.json`) —
 *  он один на все языки. Сюда приходит только то, что читает человек. */
export interface MethodLabels {
  lang: string;
  sections: Record<string, { title: string; lead: string; positions: string[] }>;
  chakras: Record<string, { title: string; hint: string }>;
  chakra_columns: Record<string, string>;
  expansions: { chakra_physics: string; age_scale: string };
}

/** A locale-bound view; safe to use alongside other languages. */
export const forLocale = localized((L: Locale) => {
  const labels = ({ ru: labelsRu, en: labelsEn } as const)[L];

  const METHOD: MethodLabels = labels as MethodLabels;

  function sectionLabels(key: string): { title: string; lead: string; positions: string[] } {
    const row = METHOD.sections[key];
    if (!row) throw new Error(`нет подписей раздела ${key} в словаре ${METHOD.lang}`);
    return row;
  }

  function chakraTitle(key: string): string {
    const row = METHOD.chakras[key];
    if (!row) throw new Error(`нет подписи чакры ${key} в словаре ${METHOD.lang}`);
    return row.title;
  }

  function chakraHint(key: string): string {
    return METHOD.chakras[key]?.hint ?? "";
  }

  function columnTitle(key: string): string {
    return METHOD.chakra_columns[key] ?? key;
  }

  /** «Сахасрара · физика» и «0–10 лет»: порядок слов в подписи тоже переводится. */
  function chakraPhysicsLabel(title: string): string {
    return METHOD.expansions.chakra_physics.replace("{chakra}", title);
  }

  function ageScaleLabel(from: number, to: number): string {
    return METHOD.expansions.age_scale.replace("{from}", String(from)).replace("{to}", String(to));
  }
  return { METHOD, sectionLabels, chakraTitle, chakraHint, columnTitle, chakraPhysicsLabel, ageScaleLabel };
});

// Compatibility for callers that explicitly use the deployment default.
export const { METHOD, sectionLabels, chakraTitle, chakraHint, columnTitle, chakraPhysicsLabel, ageScaleLabel } = forLocale(defaultLocale);
