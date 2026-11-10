import type { Phrase, PhraseFn } from "./index";

// The individual reading offer under the child matrix and parent-child line articles. RU only: individual
// readings are not sold on the English site, the block does not render there.
export const familyOffer = {
  title: {
    child: { ru: "Индивидуальный разбор для родителя", en: "An individual reading for a parent" } satisfies Phrase,
    line: { ru: "Индивидуальный разбор вашей семейной линии", en: "An individual reading of your family line" } satisfies Phrase,
  },
  lead: {
    child: {
      ru: "Автоматический разбор объясняет каждую часть карты по отдельности. Индивидуальный пишется под ваши даты: связывает части между собой и отвечает на ваш вопрос о ребёнке — с учётом его возраста.",
      en: "The automatic reading explains each part of the chart on its own. An individual one is written for your dates.",
    } satisfies Phrase,
    line: {
      ru: "В полном разборе ваша тройка уже истолкована. Индивидуальный идёт дальше: связывает линию с остальной картой и отвечает на ваш вопрос о родителях, детях или о том, что вы повторяете в своей семье.",
      en: "Your triple is already read in the full reading. An individual reading goes further.",
    } satisfies Phrase,
  },
  options: {
    pair: {
      title: { ru: "Наши отношения и воспитание", en: "Our relationship and upbringing" } satisfies Phrase,
      text: { ru: "Разбор пары «родитель и ребёнок» по двум датам: подход, споры, чем вы можете помочь.", en: "A parent-and-child couple reading from two dates." } satisfies Phrase,
    },
    child: {
      title: { ru: "Понять ребёнка", en: "Understand the child" } satisfies Phrase,
      text: { ru: "Личная матрица ребёнка по его дате: характер, таланты, что поддержать. Разбор написан для вас как для родителя.", en: "The child's personal matrix from their date, written for you as a parent." } satisfies Phrase,
    },
    self: {
      title: { ru: "Моя семейная линия", en: "My family line" } satisfies Phrase,
      text: { ru: "Личный разбор по вашей дате с вопросом о семье: что вы унесли из детства и что передаёте дальше.", en: "A personal reading from your date with a question about family." } satisfies Phrase,
    },
    bundle: {
      title: { ru: "Набор: ребёнок и вы вдвоём", en: "Set: the child and the two of you" } satisfies Phrase,
      text: { ru: "Личная матрица ребёнка и разбор пары с родителем в одном заказе.", en: "The child's matrix and the couple reading in one order." } satisfies Phrase,
    },
  },
  order: { ru: "Заказать разбор", en: "Order a reading" } satisfies Phrase,
  saving: { ru: "Два разбора в одном заказе дешевле, чем по отдельности.", en: "Two readings in one order cost less than separately." } satisfies Phrase,
  afterThree: {
    ru: (price: string) => `Ваша цена после трёх разборов — ${price} за любой.`,
    en: (price: string) => `Your price after three readings is ${price} for any.`,
  } satisfies PhraseFn<[string]>,
  form: {
    ru: "Даты, роли и вопрос заполните в форме заказа: дату ребёнка и родителя укажите сами.",
    en: "Fill in the dates, roles and question in the order form.",
  } satisfies Phrase,
};
