import type { Phrase, PhraseFn } from ".";

export const legal = {
  scopeHead: { ru: "Объём работ", en: "Scope" } satisfies Phrase,
  priceHead: { ru: "Стоимость", en: "Price" } satisfies Phrase,
  includedHead: { ru: "Что входит в результат", en: "What is included" } satisfies Phrase,
  sections: { ru: "все 20 разделов страницы", en: "all 20 sections of the reading" } satisfies Phrase,
  anyDate: { ru: "любое число заданий", en: "any number of dates of birth" } satisfies Phrase,
  oneDate: {
    ru: "одно задание (одна дата рождения)",
    en: "one date of birth",
  } satisfies Phrase,
  storage: {
    ru: "хранение заданий в личном кабинете",
    en: "storage of saved charts in the account",
  } satisfies Phrase,
  forever: {
    ru: "экземпляр результата остаётся у заказчика бессрочно",
    en: "the copy of the result stays with the customer indefinitely",
  } satisfies Phrase,
  untilEnd: {
    ru: (period: string) => `доступ к результату ${period}, по его окончании страница закрывается`,
    en: (period: string) => `access to the result ${period}, after which the page closes`,
  } satisfies PhraseFn<[string]>,
  priceListOnPayPage: {
    ru: "Действующий прайс показан на странице оплаты. Работы не оплачиваются по цене, "
      + "не показанной до оплаты.",
    en: "The current price list is shown on the payment page. A reading is never charged at a "
      + "price that is not displayed before the payment.",
  } satisfies Phrase,
};
