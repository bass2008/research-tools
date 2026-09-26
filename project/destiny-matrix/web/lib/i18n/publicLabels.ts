import labelsEn from "@/lib/__fixtures__/labels-public/en.json";
import labelsRu from "@/lib/__fixtures__/labels-public/ru.json";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "./lang";
import { localized } from "./localized";

/** Публичная половина слов метода: названия чакр, колонки, шаблоны подписей и два бесплатных
 *  раздела.
 *
 *  Отдельный файл нужен не для порядка, а для пейволла: полный словарь несёт вводки и подписи
 *  восемнадцати платных разделов, а расчёт карты идёт в браузере — один импорт увозит их
 *  в видимый чанк. Всё, что работает на клиенте, читает этот срез; полный `methodLabels`
 *  остаётся серверному коду. */
export interface PublicLabels {
  lang: string;
  chakras: Record<string, { title: string; hint: string }>;
  chakra_columns: Record<string, string>;
  expansions: { chakra_physics: string; age_scale: string };
  sections: Record<string, { title: string; lead: string; positions: string[] }>;
}

/** A locale-bound view; safe to use alongside other languages. */
export const forLocale = localized((L: Locale) => {
  const labels = ({ ru: labelsRu, en: labelsEn } as const)[L];

  const PUBLIC_METHOD: PublicLabels = labels as PublicLabels;

  function chakraTitle(key: string): string {
    const row = PUBLIC_METHOD.chakras[key];
    if (!row) throw new Error(`нет подписи чакры ${key} в словаре ${PUBLIC_METHOD.lang}`);
    return row.title;
  }

  function chakraHint(key: string): string {
    return PUBLIC_METHOD.chakras[key]?.hint ?? "";
  }

  function columnTitle(key: string): string {
    return PUBLIC_METHOD.chakra_columns[key] ?? key;
  }

  /** «Сахасрара · физика» и «0–10 лет»: порядок слов в подписи тоже переводится. */
  function chakraPhysicsLabel(title: string): string {
    return PUBLIC_METHOD.expansions.chakra_physics.replace("{chakra}", title);
  }

  function ageScaleLabel(from: number, to: number): string {
    return PUBLIC_METHOD.expansions.age_scale.replace("{from}", String(from)).replace("{to}", String(to));
  }
  return { PUBLIC_METHOD, chakraTitle, chakraHint, columnTitle, chakraPhysicsLabel, ageScaleLabel };
});

// Compatibility for callers that explicitly use the deployment default.
export const { PUBLIC_METHOD, chakraTitle, chakraHint, columnTitle, chakraPhysicsLabel, ageScaleLabel } = forLocale(defaultLocale);
