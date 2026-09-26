import type { Lang } from "./i18n/lang";
import { localized } from "./i18n/localized";
import { forLocale as formats } from "./i18n/format";
import { ADMIN_EN } from "./i18n/dict/admin";

/** Admin UI only: raw settings, user text and diagnostic logs are not translated. */
export const forLocale = localized((locale: Lang) => {
  const en: Readonly<Record<string, string>> = ADMIN_EN;
  function t(source: string, ...values: (string | number)[]): string {
    const template = locale === "en" ? en[source] ?? source : source;
    return template.replace(/\{(\d+)\}/g, (match, index) => String(values[Number(index)] ?? match));
  }
  const format = formats(locale);
  function counted(n: number, one: string, few: string, many: string): string {
    return format.counted(n, locale === "ru" ? { one, few, many } : {
      one: t(one), many: one === "человек" ? "people" : t(many),
    });
  }
  function time(iso: string): string {
    return new Date(iso).toLocaleTimeString(locale === "ru" ? "ru-RU" : "en-GB", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });
  }
  return { t, counted, time, when: format.dateTimeLabel, day: format.dayLabel };
});
