export { D, type Phrase, type PhraseFn } from "./dict";
export { DR } from "./dict/reading";
export * from "./format";
export { isLang, SITE_LANG as L, LANGS, SITE_HOSTS, SITE_LANG, type Lang } from "./lang";

import { forLocale as formatForLocale } from "./format";
import type { Lang } from "./hosts";
export function forLocale(locale: Lang) {
  return { L: locale, SITE_LANG: locale, ...formatForLocale(locale) };
}
