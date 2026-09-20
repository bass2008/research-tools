import labels from "@/labels.json";

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

export const METHOD: MethodLabels = labels as MethodLabels;

export function sectionLabels(key: string): { title: string; lead: string; positions: string[] } {
  const row = METHOD.sections[key];
  if (!row) throw new Error(`нет подписей раздела ${key} в словаре ${METHOD.lang}`);
  return row;
}

export function chakraTitle(key: string): string {
  const row = METHOD.chakras[key];
  if (!row) throw new Error(`нет подписи чакры ${key} в словаре ${METHOD.lang}`);
  return row.title;
}

export function chakraHint(key: string): string {
  return METHOD.chakras[key]?.hint ?? "";
}

export function columnTitle(key: string): string {
  return METHOD.chakra_columns[key] ?? key;
}

/** «Сахасрара · физика» и «0–10 лет»: порядок слов в подписи тоже переводится. */
export function chakraPhysicsLabel(title: string): string {
  return METHOD.expansions.chakra_physics.replace("{chakra}", title);
}

export function ageScaleLabel(from: number, to: number): string {
  return METHOD.expansions.age_scale.replace("{from}", String(from)).replace("{to}", String(to));
}
