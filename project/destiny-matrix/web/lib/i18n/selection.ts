import { LANGS, isLang, type Lang } from "./hosts";

export const LOCALE_COOKIE = "arcana_locale";

export function normalizeLocale(value: string | null | undefined): Lang | null {
  const base = value?.trim().toLowerCase().replaceAll("_", "-").split("-")[0];
  return base && isLang(base) ? base : null;
}

export function parseLocales(value: string | undefined, fallback: Lang): readonly Lang[] {
  if (!value?.trim()) return LANGS;
  const locales = [...new Set(value.split(",").map((part) => part.trim()))];
  if (!locales.every(isLang) || !locales.includes(fallback)) {
    throw new Error("Supported locales must be known and include the default locale");
  }
  return locales as Lang[];
}

export function negotiateLocale(
  header: string | null | undefined,
  supported: readonly Lang[],
  fallback: Lang,
): Lang {
  const choices = (header ?? "").split(",").map((part, index) => {
    const [tag, ...params] = part.trim().split(";");
    const weight = params.find((param) => param.trim().startsWith("q="));
    return { locale: normalizeLocale(tag), q: weight ? Number(weight.trim().slice(2)) : 1, index };
  }).filter((item) => item.locale && Number.isFinite(item.q) && item.q > 0 && item.q <= 1)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  return choices.find((item) => supported.includes(item.locale!))?.locale ?? fallback;
}
