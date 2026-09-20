import type { Phrase, PhraseFn } from "./index";

/** Страницы «аркан N в позиции X»: формулировки позиции и каркас статьи. */
export const crossing = {
  tailH1: {
    ru: (n: number) => `${n} аркан в кармическом хвосте`,
    en: (n: number) => `Arcanum ${n} in the karmic tail`,
  } satisfies PhraseFn<[number]>,
  tailInside: { ru: "на позиции кармического хвоста", en: "in the position of the karmic tail" } satisfies Phrase,
  tailAlias: { ru: "программа", en: "program" } satisfies Phrase,
  programH1: {
    ru: (n: number) => `Программа ${n} в матрице судьбы`,
    en: (n: number) => `Program ${n} in the destiny matrix`,
  } satisfies PhraseFn<[number]>,
  programAlias: { ru: "кармический хвост", en: "karmic tail" } satisfies Phrase,
  centerH1: {
    ru: (n: number) => `${n} аркан в центре матрицы судьбы`,
    en: (n: number) => `Arcanum ${n} in the centre of the destiny matrix`,
  } satisfies PhraseFn<[number]>,
  centerSeo: {
    ru: (n: number) => `${n} аркан в центре матрицы`,
    en: (n: number) => `Arcanum ${n} in the centre of the matrix`,
  } satisfies PhraseFn<[number]>,
  centerInside: { ru: "в центре карты", en: "in the centre of the chart" } satisfies Phrase,
  relationsH1: {
    ru: (n: number) => `${n} аркан в отношениях`,
    en: (n: number) => `Arcanum ${n} in relationships`,
  } satisfies PhraseFn<[number]>,
  relationsInside: { ru: "в зоне отношений", en: "in the zone of relationships" } satisfies Phrase,
  moneyH1: {
    ru: (n: number) => `${n} аркан в деньгах`,
    en: (n: number) => `Arcanum ${n} in money`,
  } satisfies PhraseFn<[number]>,
  moneyInside: { ru: "на денежной линии", en: "on the money line" } satisfies Phrase,
  heartH1: {
    ru: (n: number) => `${n} аркан под сердцем`,
    en: (n: number) => `Arcanum ${n} under the heart`,
  } satisfies PhraseFn<[number]>,
  heartInside: { ru: "в точке под сердцем", en: "in the point under the heart" } satisfies Phrase,
  talentH1: {
    ru: (n: number) => `${n} аркан в талантах`,
    en: (n: number) => `Arcanum ${n} in talents`,
  } satisfies PhraseFn<[number]>,
  talentInside: { ru: "на линии таланта", en: "on the line of talent" } satisfies Phrase,
  cardH1: {
    ru: (n: number) => `${n} аркан в визитке`,
    en: (n: number) => `Arcanum ${n} in the calling card`,
  } satisfies PhraseFn<[number]>,
  cardInside: {
    ru: "в визитке — аркане дня рождения",
    en: "in the calling card — the arcanum of the birth day",
  } satisfies Phrase,
  // каркас статьи
  meaningH2: {
    ru: (n: number, inside: string) => `Что означает ${n} аркан ${inside}`,
    en: (n: number, inside: string) => `What arcanum ${n} means ${inside}`,
  } satisfies PhraseFn<[number, string]>,
  meaningFallback: {
    ru: (essence: string, title: string, short: string) => `${essence} Это ${title}: ${short}.`,
    en: (essence: string, title: string, short: string) => `${essence} This is ${title}: ${short}.`,
  } satisfies PhraseFn<[string, string, string]>,
  worksH2: {
    ru: "Когда работает, а когда идёт по кругу",
    en: "When it works and when it goes in circles",
  } satisfies Phrase,
  worksPlus: {
    ru: (strength: string, listing: string) => `${strength} Вообще в плюсе этот аркан — про `
      + `человека, который ${listing}.`,
    en: (strength: string, listing: string) => `${strength} At its best this arcanum is about a `
      + `person who ${listing}.`,
  } satisfies PhraseFn<[string, string]>,
  worksMinus: {
    ru: (risk: string, listing: string) => `Если тема вытеснена, ${risk}. В общем виде это `
      + `выглядит так: человек ${listing}.`,
    en: (risk: string, listing: string) => `If the theme is pushed aside, ${risk}. In general it `
      + `looks like this: a person ${listing}.`,
  } satisfies PhraseFn<[string, string]>,
  actionH2: { ru: "Что с этим делать", en: "What to do about it" } satisfies Phrase,
  differsH2: {
    ru: (n: number) => `Чем это отличается от ${n} аркана на других позициях`,
    en: (n: number) => `How this differs from arcanum ${n} in other positions`,
  } satisfies PhraseFn<[number]>,
  differsFirst: {
    ru: (n: number, count: number, list: string) => `Аркан отвечает «какая это энергия», позиция `
      + `— «где она работает», и ответ меняется вместе с позицией. У аркана ${n} разобрано ещё `
      + `${count} ${count % 10 === 1 && count % 100 !== 11 ? "позиция"
        : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? "позиции" : "позиций"}: ${list}.`,
    en: (n: number, count: number, list: string) => `An arcanum answers “which energy is this”, a `
      + `position answers “where does it work”, and the answer changes with the position. `
      + `Arcanum ${n} has ${count} more ${count === 1 ? "position" : "positions"} covered: ${list}.`,
  } satisfies PhraseFn<[number, number, string]>,
  differsSecond: {
    ru: (inside: string) => `Сравнивать их полезнее, чем читать по одной: одно и то же качество `
      + `${inside} и на любой из этих точек решает разные задачи, и путать их — обычная ошибка чтения карты.`,
    en: (inside: string) => `Comparing them is more useful than reading them one by one: the same `
      + `quality ${inside} and at any of these points solves different tasks, and confusing them `
      + "is a common mistake when reading a chart.",
  } satisfies PhraseFn<[string]>,
  energyH2: { ru: "Что это за энергия вообще", en: "What this energy is in general" } satisfies Phrase,
  triplesH2: {
    ru: (n: number) => `В каких тройках стоит ${n} аркан`,
    en: (n: number) => `Which triples arcanum ${n} appears in`,
  } satisfies PhraseFn<[number]>,
  triplesText: {
    ru: (n: number, count: number, list: string) => `Хвост — всегда тройка M–N–D, отдельного `
      + `«хвоста ${n}» не существует. С разбором аркан ${n} стоит в ${count} `
      + `${count % 10 === 1 && count % 100 !== 11 ? "хвосте"
        : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? "хвостах" : "хвостах"}: `
      + `${list} — каждая тройка уточняет сценарий, но роль самого аркана в ней остаётся той же.`,
    en: (n: number, count: number, list: string) => `A tail is always the triple M–N–D; there is no `
      + `separate “tail ${n}”. With a reading, arcanum ${n} stands in ${count} `
      + `${count === 1 ? "tail" : "tails"}: ${list} — each triple sharpens the scenario, but the `
      + "role of the arcanum itself stays the same.",
  } satisfies PhraseFn<[number, number, string]>,
  aliasNote: {
    ru: (alias: string) => ` В нише этот же вопрос задают словом «${alias}»: речь об одной и той `
      + "же позиции карты.",
    en: (alias: string) => ` In this niche the same question is asked with the word “${alias}”: it `
      + "is one and the same position of the chart.",
  } satisfies PhraseFn<[string]>,
  faqMeaning: {
    ru: (head: string) => `Что означает ${head}?`,
    en: (head: string) => `What does ${head} mean?`,
  } satisfies PhraseFn<[string]>,
  faqMinus: {
    ru: (n: number) => `Как понять, что ${n} аркан здесь в минусе?`,
    en: (n: number) => `How can you tell that arcanum ${n} is at its worst here?`,
  } satisfies PhraseFn<[number]>,
  faqMinusAnswer: {
    ru: (risk: string, listing: string) => `${risk} В общем виде это выглядит так: человек ${listing}.`,
    en: (risk: string, listing: string) => `${risk} In general it looks like this: a person ${listing}.`,
  } satisfies PhraseFn<[string, string]>,
  faqOther: {
    ru: (n: number) => `Меняется ли значение ${n} аркана в других позициях?`,
    en: (n: number) => `Does the meaning of arcanum ${n} change in other positions?`,
  } satisfies PhraseFn<[number]>,
  faqOtherAnswer: {
    ru: (example: string) => `Да. Например, ${example}. Это та же энергия в другой роли, и `
      + "переносить вывод с одной точки на другую нельзя.",
    en: (example: string) => `Yes. For example, ${example}. It is the same energy in another role, `
      + "and a conclusion cannot be carried from one point to another.",
  } satisfies PhraseFn<[string]>,
  faqTail: {
    ru: (n: number) => `Существует ли кармический хвост ${n}?`,
    en: (n: number) => `Is there a karmic tail ${n}?`,
  } satisfies PhraseFn<[number]>,
  faqTailAnswer: {
    ru: (n: number, count: number, list: string) => `Нет: хвост — тройка арканов, а не одно число. `
      + `С разбором аркан ${n} встречается в ${count} хвостах: ${list}.`,
    en: (n: number, count: number, list: string) => `No: a tail is a triple of arcana, not a single `
      + `number. With a reading, arcanum ${n} appears in ${count} tails: ${list}.`,
  } satisfies PhraseFn<[number, number, string]>,
  seoTitle: {
    ru: (head: string) => `${head}: значение`,
    en: (head: string) => `${head}: meaning`,
  } satisfies PhraseFn<[string]>,
  queryMatrix: {
    ru: (head: string) => `${head} матрица судьбы`,
    en: (head: string) => `${head} destiny matrix`,
  } satisfies PhraseFn<[string]>,
  queryAlias: {
    ru: (alias: string, n: number) => `${alias} ${n} матрица судьбы`,
    en: (alias: string, n: number) => `${alias} ${n} destiny matrix`,
  } satisfies PhraseFn<[string, number]>,
  shortLead: {
    ru: (head: string, title: string, short: string) => `${head} — это ${title}. ${short}`,
    en: (head: string, title: string, short: string) => `${head} is ${title}. ${short}`,
  } satisfies PhraseFn<[string, string, string]>,
  describe: {
    ru: (head: string, essence: string) => `${head} — ${essence}.`,
    en: (head: string, essence: string) => `${head} — ${essence}.`,
  } satisfies PhraseFn<[string, string]>,
  matrixWord: { ru: /матриц/i, en: /matrix/i },
};
