import { SITE_LANG as defaultLocale, type Lang, type Lang as Locale } from "./lang";
import { localized } from "./localized";

/**
 * Общее форматирование для веба и будущего приложения. Совместимость с выбранным RN-runtime
 * проверяется на мобильном этапе (`docs/runtime-localization.md`, «Словари, корпус и React Native»).
 *
 * Русскому нужны три формы, английскому — две; выбор делает язык, а не место вызова.
 */
export interface PluralForms {
  one: string;
  few?: string;
  many: string;
}

/** A locale-bound view; safe to use alongside other languages. */
export const forLocale = localized((L: Locale) => {
  const SITE_LANG = L;

  function pluralize(n: number, forms: PluralForms, lang: Lang = SITE_LANG): string {
    if (lang === "ru") {
      const tail = Math.abs(n) % 10;
      const hundred = Math.abs(n) % 100;
      if (hundred >= 11 && hundred <= 14) return forms.many;
      if (tail === 1) return forms.one;
      if (tail >= 2 && tail <= 4) return forms.few ?? forms.many;
      return forms.many;
    }
    return Math.abs(n) === 1 ? forms.one : forms.many;
  }

  function counted(n: number, forms: PluralForms, lang: Lang = SITE_LANG): string {
    return `${n} ${pluralize(n, forms, lang)}`;
  }

  const MONTHS: Record<Lang, { nominative: string[]; genitive: string[] }> = {
    ru: {
      nominative: ["январь", "февраль", "март", "апрель", "май", "июнь",
        "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"],
      genitive: ["января", "февраля", "марта", "апреля", "мая", "июня",
        "июля", "августа", "сентября", "октября", "ноября", "декабря"],
    },
    en: {
      nominative: ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"],
      // английскому падеж не нужен: «14 June 1987» читается тем же словом
      genitive: ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"],
    },
  };

  function monthName(month: number, lang: Lang = SITE_LANG): string {
    return MONTHS[lang].nominative[month - 1] ?? "";
  }

  function monthInDate(month: number, lang: Lang = SITE_LANG): string {
    return MONTHS[lang].genitive[month - 1] ?? "";
  }

  /** «14 июня 1987» и «14 June 1987»: порядок частей у обоих языков совпадает. */
  function dateLabel(iso: string, lang: Lang = SITE_LANG): string {
    const [year, month, day] = iso.split("-").map(Number);
    return `${day} ${monthInDate(month, lang)} ${year}`;
  }

  /** «29.08.2026 14:05» и «29/08/2026 14:05»: формат дат у языков разный, часы одинаковы. */
  function dateTimeLabel(iso: string | null, lang: Lang = SITE_LANG): string {
    if (!iso) return "—";
    const value = new Date(iso);
    if (Number.isNaN(value.getTime())) return "—";
    const two = (n: number) => String(n).padStart(2, "0");
    const date = lang === "ru"
      ? `${two(value.getDate())}.${two(value.getMonth() + 1)}.${value.getFullYear()}`
      : `${two(value.getDate())}/${two(value.getMonth() + 1)}/${value.getFullYear()}`;
    return `${date} ${two(value.getHours())}:${two(value.getMinutes())}`;
  }

  /** Только дата, без часов: сроки подписки и «открыто до». */
  function dayLabel(iso: string | null, lang: Lang = SITE_LANG): string {
    if (!iso) return "—";
    return dateTimeLabel(iso, lang).split(" ")[0];
  }

  /** Разряды числа: 25 000 и 25,000 — разделители у языков разные. */
  function groupNumber(value: number, lang: Lang = SITE_LANG): string {
    const digits = Math.abs(Math.round(value)).toString();
    const groups: string[] = [];
    for (let end = digits.length; end > 0; end -= 3) {
      groups.unshift(digits.slice(Math.max(0, end - 3), end));
    }
    // Обычный пробел, а не неразрывный: так печатал прежний `toLocaleString`, и русские
    // страницы не должны разойтись с уже выпущенными.
    const separator = lang === "ru" ? " " : ",";
    return (value < 0 ? "-" : "") + groups.join(separator);
  }
  return { pluralize, counted, monthName, monthInDate, dateLabel, dateTimeLabel, dayLabel, groupNumber };
});

// Compatibility for callers that explicitly use the deployment default.
export const { pluralize, counted, monthName, monthInDate, dateLabel, dateTimeLabel, dayLabel, groupNumber } = forLocale(defaultLocale);
