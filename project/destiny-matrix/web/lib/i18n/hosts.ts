// Домены языковых версий. Отдельный модуль без зависимостей: карту читают и словарь языка,
// и публичные настройки, а импорт настроек из `lang.ts` замкнул бы их друг на друга.
export const LANGS = ["ru", "en"] as const;

export type Lang = (typeof LANGS)[number];

export function isLang(value: string): value is Lang {
  return (LANGS as readonly string[]).includes(value);
}

export const SITE_HOSTS: Record<Lang, string> = {
  ru: "https://arcana-sense.ru",
  en: "https://arcana-sense.com",
};
