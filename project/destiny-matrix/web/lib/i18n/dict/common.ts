import type { Phrase, PhraseFn } from "./index";

export const common = {
  brandTagline: {
    ru: "Матрица судьбы по дате рождения",
    en: "Destiny matrix by date of birth",
  } satisfies Phrase,
  /** Подпись под логотипом: она набрана разрядкой и капителью, поэтому короткая. */
  logoCaption: { ru: "НАЙДИ СВОЙ СМЫСЛ", en: "FIND YOUR MEANING" } satisfies Phrase,
  /** Кавычки-пара: у русского ёлочки, у английского — парные двойные. */
  quoted: {
    ru: (text: string) => `«${text}»`,
    en: (text: string) => `“${text}”`,
  } satisfies PhraseFn<[string]>,
  loading: { ru: "Загружаем…", en: "Loading…" } satisfies Phrase,
  dash: { ru: "—", en: "—" } satisfies Phrase,
  free: { ru: "бесплатно", en: "free" } satisfies Phrase,
  more: { ru: "Подробнее", en: "Read more" } satisfies Phrase,
  back: { ru: "Назад", en: "Back" } satisfies Phrase,
  yes: { ru: "Да", en: "Yes" } satisfies Phrase,
  no: { ru: "Нет", en: "No" } satisfies Phrase,
};

export const meta = {
  /** Языковые метки документа: `lang` у <html> и `og:locale`. */
  htmlLang: { ru: "ru", en: "en" } satisfies Phrase,
  ogLocale: { ru: "ru_RU", en: "en_US" } satisfies Phrase,
  siteTitle: {
    ru: "Матрица судьбы — расчёт по дате рождения с расшифровкой",
    en: "Destiny Matrix — chart and reading by date of birth",
  } satisfies Phrase,
  siteDescription: {
    ru: "Калькулятор матрицы судьбы: октаграмма 22 арканов, карта энергий по чакрам и разбор "
      + "по 20 разделам. Расчёт карты и два раздела разбора — бесплатно и без регистрации.",
    en: "Destiny matrix calculator: the octagram of 22 arcana, the chakra energy map and a "
      + "reading in 20 sections. The chart and two sections are free, with no sign-up.",
  } satisfies Phrase,
  notFoundTitle: { ru: "Страница не найдена", en: "Page not found" } satisfies Phrase,
  notFoundDescription: {
    ru: "Такой страницы на сайте нет. Отсюда можно вернуться к расчёту или в справочник.",
    en: "There is no such page. From here you can go back to the calculator or to the encyclopedia.",
  } satisfies Phrase,
  disclaimer: {
    ru: "Расчёт носит информационно-развлекательный характер, не является медицинской, "
      + "психологической или финансовой консультацией и не гарантирует наступления событий.",
    en: "The reading is for information and entertainment. It is not medical, psychological or "
      + "financial advice and does not promise that any event will happen.",
  } satisfies Phrase,
};
