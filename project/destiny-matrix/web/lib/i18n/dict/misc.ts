import type { Lang } from "../lang";
import type { Phrase, PhraseFn } from "./index";

/** Сообщения проверки почты: пишет их форма, а не сервер. */
export const emailErrors = {
  empty: { ru: "Введите почту.", en: "Enter an email address." } satisfies Phrase,
  "no-at": {
    ru: "В адресе нет @ — почта выглядит так: you@mail.ru.",
    en: "The address has no @ — an email looks like you@mail.com.",
  } satisfies Phrase,
  "many-at": { ru: "В адресе больше одной @.", en: "The address has more than one @." } satisfies Phrase,
  space: { ru: "В адресе есть пробел — уберите его.", en: "The address has a space — remove it." } satisfies Phrase,
  "local-empty": {
    ru: "Перед @ ничего нет — например, you@mail.ru.",
    en: "There is nothing before the @ — for example, you@mail.com.",
  } satisfies Phrase,
  "local-quoted": {
    ru: "Кавычки в адресе не поддерживаются.",
    en: "Quotation marks in an address are not supported.",
  } satisfies Phrase,
  "local-dot-start": {
    ru: "Адрес не может начинаться с точки — уберите её.",
    en: "An address cannot start with a dot — remove it.",
  } satisfies Phrase,
  "local-dot-end": {
    ru: "Перед @ стоит точка — уберите её: you@mail.ru.",
    en: "There is a dot right before the @ — remove it: you@mail.com.",
  } satisfies Phrase,
  "local-dot-double": {
    ru: "В адресе две точки подряд — оставьте одну.",
    en: "The address has two dots in a row — leave one.",
  } satisfies Phrase,
  "local-bad-char": {
    ru: "В части до @ недопустимый символ.",
    en: "The part before the @ has a character that is not allowed.",
  } satisfies Phrase,
  "domain-empty": {
    ru: "После @ ничего нет — например, you@mail.ru.",
    en: "There is nothing after the @ — for example, you@mail.com.",
  } satisfies Phrase,
  "domain-no-dot": {
    ru: "В домене после @ нет точки — например, mail.ru.",
    en: "The domain after the @ has no dot — for example, mail.com.",
  } satisfies Phrase,
  "domain-dot-edge": {
    ru: "Домен не может начинаться или заканчиваться точкой.",
    en: "A domain cannot start or end with a dot.",
  } satisfies Phrase,
  "domain-dot-double": {
    ru: "В домене две точки подряд.",
    en: "The domain has two dots in a row.",
  } satisfies Phrase,
  "domain-hyphen-edge": {
    ru: "Часть домена не может начинаться или заканчиваться дефисом.",
    en: "A part of a domain cannot start or end with a hyphen.",
  } satisfies Phrase,
  "domain-numeric-tld": {
    ru: "После последней точки должны быть буквы — например, mail.ru.",
    en: "There have to be letters after the last dot — for example, mail.com.",
  } satisfies Phrase,
  "domain-tld-end": {
    ru: "Домен заканчивается не буквой — проверьте хвост адреса: mail.ru, а не mail.ru2.",
    en: "The domain does not end with a letter — check the end of the address: mail.com, not mail.com2.",
  } satisfies Phrase,
  "domain-special-use": {
    ru: "На такой домен письма не доходят — нужен обычный адрес вроде you@mail.ru.",
    en: "Mail does not reach such a domain — use an ordinary address like you@mail.com.",
  } satisfies Phrase,
  "domain-bad-char": {
    ru: "В домене после @ недопустимый символ.",
    en: "The domain after the @ has a character that is not allowed.",
  } satisfies Phrase,
  "too-long": {
    ru: "Адрес длиннее 254 знаков.",
    en: "The address is longer than 254 characters.",
  } satisfies Phrase,
  "label-too-long": {
    ru: "Часть домена длиннее 63 знаков.",
    en: "A part of the domain is longer than 63 characters.",
  } satisfies Phrase,
};

/** Разделы справочника: ключи те же на всех языках, слова свои. */
export const encSections = {
  arc: {
    title: { ru: "22 аркана", en: "22 arcana" } satisfies Phrase,
    hint: { ru: "значение каждого числа", en: "the meaning of every number" } satisfies Phrase,
  },
  sec: {
    title: { ru: "Разделы отчёта", en: "Sections of the reading" } satisfies Phrase,
    hint: { ru: "что показывает полный разбор", en: "what the full reading shows" } satisfies Phrase,
  },
  pts: {
    title: { ru: "Позиции карты", en: "Positions of the chart" } satisfies Phrase,
    hint: {
      ru: "точки октаграммы и линии рода",
      en: "the points of the octagram and the family lines",
    } satisfies Phrase,
  },
  chk: {
    title: { ru: "Семь чакр", en: "Seven chakras" } satisfies Phrase,
    hint: { ru: "карта энергий по уровням", en: "the energy map level by level" } satisfies Phrase,
  },
  tls: {
    title: { ru: "Кармические хвосты", en: "Karmic tails" } satisfies Phrase,
    hint: {
      ru: "тройки нижнего угла карты",
      en: "the triples of the lower corner of the chart",
    } satisfies Phrase,
  },
  yer: {
    title: { ru: "Матрица судьбы на год", en: "Destiny matrix for the year" } satisfies Phrase,
    hint: {
      ru: "аркан в рамке персонального года",
      en: "the arcanum inside the frame of a personal year",
    } satisfies Phrase,
  },
  cmb: {
    title: { ru: "Сочетания арканов", en: "Combinations of arcana" } satisfies Phrase,
    hint: { ru: "пары арканов рядом", en: "pairs of arcana side by side" } satisfies Phrase,
  },
  art: {
    title: { ru: "Статьи", en: "Articles" } satisfies Phrase,
    hint: { ru: "разборы понятий целиком", en: "whole concepts explained" } satisfies Phrase,
  },
};

/** Подписи ссылок в блоке «Смотрите также»: адрес материала разбирается на части, и заголовок
 *  собирается по ним, а не хранится готовым. */
export const relatedLinks = {
  combination: {
    ru: (a: number, b: number, ta: string, tb: string) => `${a} и ${b}: ${ta} и ${tb}`,
    en: (a: number, b: number, ta: string, tb: string) => `${a} and ${b}: ${ta} and ${tb}`,
  } satisfies PhraseFn<[number, number, string, string]>,
  arcanum: {
    ru: (n: number, title: string) => `${n} в матрице судьбы: ${title}`,
    en: (n: number, title: string) => `${n} in the destiny matrix: ${title}`,
  } satisfies PhraseFn<[number, string]>,
};

/** Выбор цели оплаты: откуда взята дата и как различить две записи на одну дату. */
export const payTarget = {
  female: { ru: "ж", en: "f" } satisfies Phrase,
  male: { ru: "м", en: "m" } satisfies Phrase,
  fromBrowser: { ru: "браузер", en: "browser" } satisfies Phrase,
  fromAccount: { ru: "кабинет", en: "account" } satisfies Phrase,
  removed: {
    ru: (id: number) => `запись ${id} удалена`,
    en: (id: number) => `record ${id} has been deleted`,
  } satisfies PhraseFn<[number]>,
};

/** Отказы обращения к серверу: их пишет фронт, когда ответа нет или он не разобран. */
export const apiErrors = {
  offline: {
    ru: "Сервер не отвечает. Попробуйте позже.",
    en: "The server is not responding. Please try again later.",
  } satisfies Phrase,
  missing: { ru: "Сервис пока недоступен.", en: "The service is not available yet." } satisfies Phrase,
  status: {
    ru: (code: number) => `Сервер ответил ошибкой ${code}.`,
    en: (code: number) => `The server answered with error ${code}.`,
  } satisfies PhraseFn<[number]>,
  unexpected: {
    ru: "Сервер ответил в неожиданном формате.",
    en: "The server answered in an unexpected format.",
  } satisfies Phrase,
};

/** Отказы BFF: он проверяет форму полей до обращения к серверу приложения, и его сообщения
 *  человек видит в форме так же, как ответы сервера. */
export const bffErrors = {
  shortPassword: {
    ru: "Пароль — не короче трёх знаков",
    en: "The password has to be at least three characters long",
  } satisfies Phrase,
  unknownTariff: { ru: "Неизвестный тариф", en: "Unknown plan" } satisfies Phrase,
  badMatrix: { ru: "Неверная матрица", en: "Wrong matrix" } satisfies Phrase,
  badOrder: { ru: "Неверный номер заказа", en: "Wrong order number" } satisfies Phrase,
  badDate: { ru: "Дата — в формате YYYY-MM-DD", en: "The date has to be in YYYY-MM-DD format" } satisfies Phrase,
  badSex: { ru: "Пол — m или f", en: "Sex has to be m or f" } satisfies Phrase,
  noSession: { ru: "Нужен вход: сессии нет", en: "Sign in first: there is no session" } satisfies Phrase,
  upstreamDown: {
    ru: "Сервис недоступен: сервер приложения не отвечает.",
    en: "The service is unavailable: the application server is not responding.",
  } satisfies Phrase,
  noPass: { ru: "Нет пропуска", en: "No pass" } satisfies Phrase,
  serviceDown: { ru: "Сервис недоступен", en: "The service is unavailable" } satisfies Phrase,
  fileGone: { ru: "Файл недоступен", en: "The file is unavailable" } satisfies Phrase,
};

/** Рамка роли: кубик корпуса вставляется в предложение как придаточное, и подлежащее у каждого
 *  языка своё. `upper` отличает готовое предложение от придаточного — в корпусе есть и то, и то. */
export const clause = {
  subject: { ru: "человек", en: "a person" } satisfies Phrase,
  mark: { ru: /,\s+когда человек\s+/, en: /,\s+when a person\s+/ } as Record<Lang, RegExp>,
  upper: { ru: /^[А-ЯЁ]/, en: /^[A-Z]/ } as Record<Lang, RegExp>,
  /** Служебный зачин позиционного текста — «Аркан «Маг» · A ·». На странице он мусор, и его
   *  снимают все читатели корпуса. Вид зачина задаёт сборка корпуса, поэтому он тоже по языку. */
  corpusPrefix: {
    ru: /^Аркан «[^»]+» · [^·]+ ·\s*/,
    en: /^Arcanum “[^”]+” · [^·]+ ·\s*/,
  } as Record<Lang, RegExp>,
  /** Перечисление в строку: «a, b и c» — «a, b and c». */
  and: { ru: "и", en: "and" } satisfies Phrase,
  /** Роль по умолчанию: у пяти текстов корпуса из восьмидесяти нет середины, и силу с риском
   *  приходится брать из списков аркана. Пустых списков в корпусе нет, но читатель обязан
   *  пережить и такой. */
  fallbackStrength: {
    ru: "действует по своей сильной стороне",
    en: "acts from their strong side",
  } satisfies Phrase,
  fallbackRisk: {
    ru: "уходит в привычную реакцию",
    en: "falls back into the usual reaction",
  } satisfies Phrase,
};
