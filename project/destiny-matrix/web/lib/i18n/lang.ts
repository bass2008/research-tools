import { publicSettings } from "../settings/public";

/** Языки развёртки. Один язык — одна сборка и один домен: `.ru` русский, `.com` английский.
 *  Сама карта живёт в `hosts.ts`: её читают и настройки, которые этот модуль импортирует. */
export { LANGS, SITE_HOSTS, isLang, type Lang } from "./hosts";
import { isLang } from "./hosts";
import type { Lang } from "./hosts";

/**
 * Язык этой развёртки. Читается один раз на старте процесса: корпус, словари и разметка
 * страницы собраны под него, и менять язык на запрос нечему.
 */
export const SITE_LANG: Lang = (() => {
  const raw = String(publicSettings.get("siteLang") || "").toLowerCase();
  if (!isLang(raw)) {
    throw new Error(`NEXT_PUBLIC_SITE_LANG: неизвестный язык ${raw || "(пусто)"}`);
  }
  return raw;
})();


