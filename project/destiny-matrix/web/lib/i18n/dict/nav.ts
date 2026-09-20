import type { Phrase } from "./index";

export const nav = {
  skip: { ru: "Перейти к содержимому", en: "Skip to content" } satisfies Phrase,
  home: { ru: "Главная", en: "Home" } satisfies Phrase,
  homeAria: { ru: "Arcana Sense — на главную", en: "Arcana Sense — home" } satisfies Phrase,
  myReading: { ru: "Мой разбор", en: "My reading" } satisfies Phrase,
  encyclopedia: { ru: "Энциклопедия", en: "Encyclopedia" } satisfies Phrase,
  account: { ru: "Кабинет", en: "Account" } satisfies Phrase,
  /** Подпись переключателя: читается на языке той версии, куда ведёт. */
  otherLanguage: { ru: "Русская версия", en: "English version" } satisfies Phrase,
  buy: { ru: "Купить", en: "Buy" } satisfies Phrase,
  newCalculation: { ru: "Новый расчёт", en: "New calculation" } satisfies Phrase,
  allMatrices: { ru: "Все матрицы", en: "All matrices" } satisfies Phrase,
  matrixCatalog: { ru: "Каталог матриц", en: "Matrix catalogue" } satisfies Phrase,
  // подвал
  about: { ru: "О методе", en: "About the method" } satisfies Phrase,
  author: { ru: "Об авторе", en: "About the author" } satisfies Phrase,
  contacts: { ru: "Контакты и реквизиты", en: "Contacts and legal details" } satisfies Phrase,
  support: { ru: "Поддержка", en: "Support" } satisfies Phrase,
  terms: { ru: "Публичная оферта", en: "Terms of service" } satisfies Phrase,
  privacy: {
    ru: "Политика обработки персональных данных",
    en: "Privacy policy",
  } satisfies Phrase,
  refund: { ru: "Условия возврата", en: "Refund policy" } satisfies Phrase,
  arcanaEncyclopedia: { ru: "Энциклопедия арканов", en: "Encyclopedia of arcana" } satisfies Phrase,
  // 404
  notFoundTitle: { ru: "Такой страницы нет", en: "This page does not exist" } satisfies Phrase,
  notFoundText: {
    ru: "Возможно, ссылка устарела. Отсюда можно вернуться к расчёту или в справочник — тупиков на сайте быть не должно.",
    en: "The link may be out of date. From here you can go back to the calculator or to the encyclopedia — the site should have no dead ends.",
  } satisfies Phrase,
  notFoundHome: { ru: "Главная и расчёт", en: "Home and calculator" } satisfies Phrase,
};
