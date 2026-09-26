import { publicSettings } from "../settings/public";
import type { Lang } from "./hosts";
import { isLang } from "./hosts";
import { parseLocales } from "./selection";

/** Переводы приложения; разрешённый набор для HTTP-запроса задаёт профиль домена. */
export { isLang, LANGS, SITE_HOSTS, type Lang } from "./hosts";

/**
 * Совместимый fallback для чистых функций и перечисления маршрутов при сборке.
 * HTTP-страницы используют профиль Host и requestLocale(), компоненты — useLocale().
 */
export const SITE_LANG: Lang = (() => {
  const raw = String(publicSettings.get("siteLang") || "").toLowerCase();
  if (!isLang(raw)) {
    throw new Error(`NEXT_PUBLIC_SITE_LANG: неизвестный язык ${raw || "(пусто)"}`);
  }
  return raw;
})();

export const SUPPORTED_LOCALES = parseLocales(publicSettings.get("supportedLocales"), SITE_LANG);
