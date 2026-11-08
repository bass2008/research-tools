import type { Phrase, PhraseFn } from "./index";

type Pair<T> = Record<"ru" | "en", T>;

const ruPlural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};
const enPlural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** What the "yours" line of a chapter is made of: the visitor's numbers. */
export interface Yours {
  nm: (n: number) => string; v: Record<string, number>; ct: [number, number, number]; links: number;
  family: number; karma: number; sign: string; signCard: number; age: number; decade: number; decadeCard: number; frequent: string;
}

/** The landing of the Individual tab: the approved prototype (reports/individual-sales/prototypes/v6-otchet-i-karta). */
export const individualLanding = {
  kicker: { ru: "✦ Индивидуальный разбор матрицы судьбы", en: "✦ Individual destiny matrix reading" } satisfies Phrase,
  h1: { ru: "Разбор, который пишут только персонально для вас", en: "A reading written personally for you, and only for you" } satisfies Phrase,
  sub: {
    ru: (date: string) => `Ниже — страницы настоящего примера на условную дату ${date}. Нажимайте на пункты и формулы: схема матрицы отвечает. Потом введите свою дату.`,
    en: (date: string) => `Below are pages of a real example for the sample date ${date}. Tap the points and formulas: the matrix chart responds. Then enter your own date.`,
  } satisfies PhraseFn<[string]>,
  readExample: { ru: "Читать пример целиком", en: "Read the whole example" } satisfies Phrase,
  enterDate: { ru: "Ввести свою дату", en: "Enter your date" } satisfies Phrase,
  aiLine: {
    ru: "Пишет AI-автор по методике редакции, проверяет вторая, независимая модель, одобряет человек из редакции.",
    en: "Written by an AI author following our editorial method, checked by a second, independent model, approved by a person from our editorial team.",
  } satisfies Phrase,
  howLink: { ru: "Как это устроено ↓", en: "How it works ↓" } satisfies Phrase,
  meta: {
    ru: (price: string) => `Пишется для вас с нуля · **${price} · обычно за 1 рабочий день** · на сайте и в PDF`,
    en: (price: string) => `Written for you from scratch · **${price} · usually in 1 working day** · on the site and as a PDF`,
  } satisfies PhraseFn<[string]>,
  fanCaption: { ru: "Маска · главный талант · триггер — три карты из примера", en: "Mask · main talent · trigger — three cards from the example" } satisfies Phrase,

  pageOf: { ru: (p: number, n: number) => `стр. ${p} из ${n}`, en: (p: number, n: number) => `p. ${p} of ${n}` } satisfies PhraseFn<[number, number]>,
  page: { ru: (p: number) => `стр. ${p}`, en: (p: number) => `p. ${p}` } satisfies PhraseFn<[number]>,
  pages: { ru: (n: number) => `${n} ${ruPlural(n, "страница", "страницы", "страниц")}`, en: (n: number) => `${n} pages` } satisfies PhraseFn<[number]>,
  sumNote: { ru: "Нажмите на пункт — на схеме загорятся точки, из которых выведен вывод.", en: "Tap a point — the chart lights up the points it is drawn from." } satisfies Phrase,
  sumSheet: { ru: (date: string) => `Личный разбор · ${date}`, en: (date: string) => `Personal reading · ${date}` } satisfies PhraseFn<[string]>,
  minute: { ru: "Главное за минуту", en: "The main points in a minute" } satisfies Phrase,
  sumHint: { ru: "Нажмите на пункт — на схеме загорятся точки, из которых он выведен", en: "Tap a point — the chart lights up the points it comes from" } satisfies Phrase,
  sumMore: {
    ru: (n: number) => `Ещё ${n} ${ruPlural(n, "вывод", "вывода", "выводов")}`,
    en: (n: number) => `${n} more ${enPlural(n, "point", "points")}`,
  } satisfies PhraseFn<[number]>,
  /** captions of the sample's "main points in a minute" and the points off the chart, item by item */
  summaryLegends: {
    ru: [
      ["Справедливость трижды: главный талант, середина линии талантов, усилитель", []],
      ["Маска — Повешенный, 12. Центр — Колесо, 10", ["духовное предназначение — 12"]],
      ["Сила в точке триггера; чёрная точка на шкале — сейчас, десятилетие Силы", ["сила рода — 11", "итог чакр — 11"]],
      ["Иерофант в точке заработка и в кармической задаче, Солнце на выходе денежной линии", []],
      ["Дьявол на входе в отношения, Колесница в примирении, Солнце в точке дуала", []],
      ["Каждый угол через свою родовую линию приводит в главную точку: вход в деньги, родители, дуал, центр", []],
      ["Шкала возраста по кругу: вы здесь, в 35 — Иерофант, в 37,5 — Справедливость", []],
    ],
    en: [
      ["Justice three times: main talent, middle of the line of talents, amplifier", []],
      ["Mask — the Hanged Man, 12. Centre — the Wheel, 10", ["spiritual purpose — 12"]],
      ["Strength in the trigger point; the black dot on the scale is now, the decade of Strength", ["strength of the family line — 11", "chakra total — 11"]],
      ["The Hierophant in the earnings point and in the karmic task, the Sun at the end of the money line", []],
      ["The Devil at the entrance to relationships, the Chariot in reconciliation, the Sun in the dual point", []],
      ["Each corner leads through its family line into a main point: money entrance, parents, dual, centre", []],
      ["The age scale around the circle: you are here, at 35 — the Hierophant, at 37.5 — Justice", []],
    ],
  } satisfies Pair<[string, string[]][]>,
  offChart: { ru: (x: string) => `вне схемы: ${x}`, en: (x: string) => `off the chart: ${x}` } satisfies PhraseFn<[string]>,
  schemeLabel: { ru: "Схема матрицы", en: "Matrix chart" } satisfies Phrase,

  skipKey: {
    ru: (page: number, h2: string) => `стр. 2–${page} · ключ матрицы: ${h2.toLowerCase()}`,
    en: (page: number, h2: string) => `pp. 2–${page} · the key of the matrix: ${h2.toLowerCase()}`,
  } satisfies PhraseFn<[number, string]>,
  findNote: {
    ru: "Нажмите на карту в формуле — схема покажет, где она стоит. Стрелки листают все находки.",
    en: "Tap a card in the formula — the chart shows where it stands. The arrows go through all findings.",
  } satisfies Phrase,
  findSheet: { ru: "Глава 2 · чего нет в автоматическом разборе", en: "Chapter 2 · beyond the automatic reading" } satisfies Phrase,
  findCount: { ru: (i: number, n: number) => `Находка ${i} из ${n}`, en: (i: number, n: number) => `Finding ${i} of ${n}` } satisfies PhraseFn<[number, number]>,
  findPrev: { ru: "Предыдущая находка", en: "Previous finding" } satisfies Phrase,
  findNext: { ru: "Следующая находка", en: "Next finding" } satisfies Phrase,
  findDot: { ru: (i: number) => `Находка ${i}`, en: (i: number) => `Finding ${i}` } satisfies PhraseFn<[number]>,
  findHint: {
    ru: (n: number) => `Нажмите на карту — схема покажет её место. Стрелки листают все ${n} ${ruPlural(n, "находку", "находки", "находок")}`,
    en: (n: number) => `Tap a card — the chart shows its place. The arrows go through all ${n} findings`,
  } satisfies PhraseFn<[number]>,
  findCap: {
    ru: "Точки находки на схеме. Пунктир — связь, которую не видно по отдельности.",
    en: "The points of the finding on the chart. The dotted line is a link you cannot see point by point.",
  } satisfies Phrase,
  cardCap: {
    ru: (label: string, name: string) => `${label}: ${name}. Нажмите ещё раз — вернётся вся формула.`,
    en: (label: string, name: string) => `${label}: ${name}. Tap again to bring back the whole formula.`,
  } satisfies PhraseFn<[string, string]>,
  cardOff: {
    ru: (label: string, name: string) => `${label} — ${name}: этой точки на схеме нет, её досчитывают по книгам Лисовской.`,
    en: (label: string, name: string) => `${label} — ${name}: this point is not on the chart; it is calculated from Lisovskaya’s books.`,
  } satisfies PhraseFn<[string, string]>,
  readFinding: { ru: "Читать находку целиком", en: "Read the whole finding" } satisfies Phrase,
  todo: { ru: "Что делать:", en: "What to do:" } satisfies Phrase,
  skipToggle: { ru: "та же глава · одна точка против автоматического разбора", en: "the same chapter · one point against the automatic reading" } satisfies Phrase,

  togNote: {
    ru: "Одна и та же точка одной и той же даты. Переключите — и сравните, что вы узнаёте о себе.",
    en: "The same point of the same date. Switch — and compare what you learn about yourself.",
  } satisfies Phrase,
  togSheet: { ru: "Одна точка — два текста", en: "One point — two texts" } satisfies Phrase,
  togWhere: { ru: "Правый верхний угол схемы", en: "Upper right corner of the chart" } satisfies Phrase,
  togHint: { ru: "Та же точка той же даты. Переключите и сравните", en: "The same point of the same date. Switch and compare" } satisfies Phrase,
  togAuto: { ru: "Автоматический", en: "Automatic" } satisfies Phrase,
  togInd: { ru: "Индивидуальный ✦", en: "Individual ✦" } satisfies Phrase,
  togAutoLabel: { ru: "Автоматический разбор · готовый текст о позиции", en: "Automatic reading · a ready text about the position" } satisfies Phrase,
  togAlso: {
    ru: "Эта карта встречается в автоматическом разборе ещё в трёх разделах — о роде, о родителях и о десятилетиях. Каждый раз как отдельная позиция.",
    en: "This card appears in the automatic reading in three more sections — on the lineage, the parents and the decades. Each time as a separate position.",
  } satisfies Phrase,
  togAfter: {
    ru: "Автоматический разбор тех же дат приходит в подарок к индивидуальному: справочник по каждой точке рядом с разбором связей.",
    en: "The automatic reading of the same dates comes as a gift with the individual one: a reference for every point next to the reading of the links.",
  } satisfies Phrase,

  whoTitle: { ru: "AI + человек", en: "AI + human" } satisfies Phrase,
  whoLead: {
    ru: "Мы берём лучшее от обоих миров. AI-автор читает вашу матрицу целиком и сверяет каждую точку с корпусом книг. Человек из редакции проверяет выводы, схемы и вёрстку — и без его одобрения разбор к вам не уходит. Вот как это устроено:",
    en: "We take the best of both worlds. The AI author reads your whole matrix and checks every point against a corpus of books. A person from our editorial team checks the conclusions, charts and layout — and without their approval the reading does not reach you. Here is how it works:",
  } satisfies Phrase,
  proc: {
    ru: [
      ["Автор пишет", "по точным числам вашей матрицы из нашего расчёта и по корпусу книг: Юлиана Лисовская, Артур Уэйт, Бенебелл Вэнь — корпус пополняется. Точки, которых нет на схеме, досчитывает по формулам из книг — они сверены с примерами авторов."],
      ["Вторая модель проверяет", "Она независимая: не видела, как писался текст, и читает его как покупатель. Пересчитывает числа, сверяет с книгами утверждения о картах, ищет абзацы, которые подошли бы любой другой дате, приговоры и обещания событий."],
      ["Автор правит", "по каждому замечанию проверки и сдаёт текст заново."],
      ["Человек из редакции одобряет", "Читает разбор от первой строки до последней. Без его одобрения разбор не уходит покупателю."],
    ],
    en: [
      ["The author writes", "from the exact numbers of your matrix from our calculation and from the corpus of books: Yuliana Lisovskaya, Arthur Waite, Benebell Wen — the corpus keeps growing. Points that are not on the chart are calculated with the formulas from the books, checked against the authors’ examples."],
      ["A second model checks", "It is independent: it did not see the text being written and reads it as a buyer. It recalculates the numbers, checks claims about the cards against the books, looks for paragraphs that would fit any other date, verdicts and promises of events."],
      ["The author revises", "after every remark of the check and hands the text in again."],
      ["A person from our editorial team approves", "They read the reading from the first line to the last. Without their approval it does not go to the buyer."],
    ],
  } satisfies Pair<[string, string][]>,
  notGpt: {
    ru: (formula: string) => `**Чем это не ChatGPT.** Чат-бот за минуту не досчитает точки, которых нет на схеме, — например, силу рода: в примере это ${formula}. Он не сверит их с корпусом книг, не даст себя проверить второй модели и человеку и не напишет около 15 тысяч связных слов только о вас.`,
    en: (formula: string) => `**Why this is not ChatGPT.** A chatbot will not calculate in a minute the points that are not on the chart — for example, the strength of the lineage: in the example it is ${formula}. It will not check them against the corpus of books, will not let a second model and a person check it, and will not write about 15,000 connected words about you alone.`,
  } satisfies PhraseFn<[string]>,
  cmpHead: {
    ru: [["Автоматический", "390 ₽"], ["✦ Индивидуальный", ""], ["Консультация", "3–15 тыс. ₽"]],
    en: [["Automatic", "390 ₽"], ["✦ Individual", ""], ["Consultation", "3–15 thousand ₽"]],
  } satisfies Pair<[string, string][]>,
  cmpRows: {
    ru: [
      ["Когда", "мгновенно", "обычно через 1 рабочий день, максимум 3", "по записи, час разговора"],
      ["Что внутри", "21 раздел, каждый отдельно", "около 15 тыс. слов о вас: связи, главный узел, план", "разговор; запись или PDF дают не всегда"],
      ["Ваш вопрос", "—", "ответят главы и раздел вопросов", "да"],
    ],
    en: [
      ["When", "instantly", "usually in 1 working day, at most 3", "by appointment, an hour of talk"],
      ["What is inside", "21 sections, each on its own", "about 15,000 words about you: links, the main knot, a plan", "a talk; a recording or a PDF not always"],
      ["Your question", "—", "answered by the chapters and the questions section", "yes"],
    ],
  } satisfies Pair<[string, string, string, string][]>,
  cmpLabel: { ru: "Сравнение", en: "Comparison" } satisfies Phrase,

  tocNote: {
    ru: "Главы раскрываются выводами из примера. Когда вы ввели дату, у каждой главы появляются ваши числа.",
    en: "The chapters open with conclusions from the example. Once you have entered your date, each chapter shows your numbers.",
  } satisfies Phrase,
  tocSheet: { ru: "Содержание примера", en: "Contents of the example" } satisfies Phrase,
  tocTitle: { ru: "Что внутри:", en: "What is inside:" } satisfies Phrase,
  chapters: { ru: (n: number) => ruPlural(n, "глава", "главы", "глав"), en: (n: number) => enPlural(n, "chapter", "chapters") } satisfies PhraseFn<[number]>,
  tocSub: {
    ru: "У каждой главы — вывод, карты со схемой и «что с этим делать». Введите дату выше — у глав появятся ваши числа.",
    en: "Each chapter has a conclusion, cards with the chart and “what to do about it”. Enter your date above — the chapters will show your numbers.",
  } satisfies Phrase,
  tocSubDate: {
    ru: (date: string) => `Строки «у вас» — ваши числа по дате ${date}: о них будут те же главы в вашем разборе.`,
    en: (date: string) => `The “yours” lines are your numbers for ${date}: the same chapters of your reading will be about them.`,
  } satisfies PhraseFn<[string]>,
  tocAll: {
    ru: (n: number) => `Показать все ${n} глав и вопросы`,
    en: (n: number) => `Show all ${n} chapters and the questions`,
  } satisfies PhraseFn<[number]>,
  tocAllMore: { ru: (list: string) => `ещё: ${list}`, en: (list: string) => `also: ${list}` } satisfies PhraseFn<[string]>,
  tocFaq: { ru: "Вопросы и ответы", en: "Questions and answers" } satisfies Phrase,
  tocFaqSub: {
    ru: (n: number) => `${n} ${ruPlural(n, "вопрос", "вопроса", "вопросов")}, которые обычно задают о такой матрице`,
    en: (n: number) => `${n} questions people usually ask about such a matrix`,
  } satisfies PhraseFn<[number]>,
  yours: { ru: (x: string) => `У вас: ${x}`, en: (x: string) => `Yours: ${x}` } satisfies PhraseFn<[string]>,
  hereYou: { ru: "вы здесь", en: "you are here" } satisfies Phrase,
  yoursFor: {
    ru: {
      key: (y: Yours) => `маска ${y.nm(y.v.A)}, центр ${y.nm(y.v.E)}, главный талант ${y.nm(y.v.B)}`,
      findings: (y: Yours) => `${y.links} ${ruPlural(y.links, "связь", "связи", "связей")} далёких точек — вы их видели на своей схеме`,
      character: (y: Yours) => `маска ${y.nm(y.v.A)}, центр ${y.nm(y.v.E)}`,
      talents: (y: Yours) => `линия талантов ${y.v.B} → ${y.v.P} → ${y.v.K}`,
      money: (y: Yours) => `денежная линия ${y.v.L} → ${y.v.R2} → ${y.v.R}, материальная карма ${y.v.C} → ${y.karma} → ${y.v.L}`,
      relations: (y: Yours) => `линия отношений ${y.v.M} → ${y.v.R1} → ${y.v.R}, дуал ${y.nm(y.v.R)}`,
      family: (y: Yours) => `точка родителей ${y.nm(y.v.J)}, сила рода ${y.nm(y.family)}`,
      karma: (y: Yours) => `кармический хвост ${y.v.M} → ${y.v.N} → ${y.v.D}`,
      body: (y: Yours) => `триггер ${y.nm(y.v.G)}, итог чакр ${y.ct.join(" · ")}`,
      chakras: (y: Yours) => `итог энергополя: физика ${y.nm(y.ct[0])}, энергия ${y.nm(y.ct[1])}, эмоции ${y.nm(y.ct[2])}`,
      zodiac: (y: Yours) => `${y.sign} → ${y.nm(y.signCard)}`,
      time: (y: Yours) => `вам ${y.age}: десятилетие ${y.decade}–${y.decade + 10} — ${y.nm(y.decadeCard)}`,
      selfcheck: (y: Yours) => y.frequent ? `чаще всего на схеме: ${y.frequent}` : "",
    },
    en: {
      key: (y: Yours) => `mask ${y.nm(y.v.A)}, centre ${y.nm(y.v.E)}, main talent ${y.nm(y.v.B)}`,
      findings: (y: Yours) => `${y.links} ${enPlural(y.links, "link", "links")} between distant points — you saw them on your chart`,
      character: (y: Yours) => `mask ${y.nm(y.v.A)}, centre ${y.nm(y.v.E)}`,
      talents: (y: Yours) => `line of talents ${y.v.B} → ${y.v.P} → ${y.v.K}`,
      money: (y: Yours) => `money line ${y.v.L} → ${y.v.R2} → ${y.v.R}, material karma ${y.v.C} → ${y.karma} → ${y.v.L}`,
      relations: (y: Yours) => `relationship line ${y.v.M} → ${y.v.R1} → ${y.v.R}, dual ${y.nm(y.v.R)}`,
      family: (y: Yours) => `parents’ point ${y.nm(y.v.J)}, strength of the family line ${y.nm(y.family)}`,
      karma: (y: Yours) => `karmic tail ${y.v.M} → ${y.v.N} → ${y.v.D}`,
      body: (y: Yours) => `trigger ${y.nm(y.v.G)}, chakra totals ${y.ct.join(" · ")}`,
      chakras: (y: Yours) => `energy field total: physics ${y.nm(y.ct[0])}, energy ${y.nm(y.ct[1])}, emotions ${y.nm(y.ct[2])}`,
      zodiac: (y: Yours) => `${y.sign} → ${y.nm(y.signCard)}`,
      time: (y: Yours) => `you are ${y.age}: the decade ${y.decade}–${y.decade + 10} — ${y.nm(y.decadeCard)}`,
      selfcheck: (y: Yours) => y.frequent ? `most frequent on the chart: ${y.frequent}` : "",
    },
  } satisfies Pair<Record<string, (y: Yours) => string>>,
  /** in the order of the sign table of the landing: Capricorn first */
  signs: {
    ru: ["Козерог", "Водолей", "Рыбы", "Овен", "Телец", "Близнецы", "Рак", "Лев", "Дева", "Весы", "Скорпион", "Стрелец"],
    en: ["Capricorn", "Aquarius", "Pisces", "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius"],
  } satisfies Pair<string[]>,
  fragments: { ru: "Фрагменты примера", en: "Fragments of the example" } satisfies Phrase,
  firstPage: { ru: "Первая страница примера", en: "The first page of the example" } satisfies Phrase,
  tocCta: { ru: "Пример открывается без регистрации. Есть ещё", en: "The example opens without registration. There are also" } satisfies Phrase,
  exPairLink: { ru: "пример пары", en: "a couple example" } satisfies Phrase,
  exYearLink: { ru: "пример года", en: "a year example" } satisfies Phrase,
  and: { ru: "и", en: "and" } satisfies Phrase,

  pricesSubDate: {
    ru: (date: string) => `Каждый пишется по вашим датам — для ${date} уже посчитана матрица выше. Около 15 тысяч слов: вечер, а то и неделя чтения.`,
    en: (date: string) => `Each one is written for your dates — the matrix for ${date} is already calculated above. About 15,000 words: an evening, or even a week, of reading.`,
  } satisfies PhraseFn<[string]>,
  oneTagline: { ru: "на выбор", en: "your choice" } satisfies Phrase,
  kindDesc: {
    ru: {
      personal: (who: string) => `Характер, дело, деньги, отношения, род, хвост, тело, время и план — по ${who}.`,
      pair: () => "Ключ пары, деньги, задачи, ссоры и как их чинить, план для двоих — по двум датам.",
      year: () => "Матрица любого года, три периода и двенадцать глав-месяцев: когда начинать, когда закрывать.",
    },
    en: {
      personal: (who: string) => `Character, work, money, relationships, lineage, tail, body, time and a plan — for ${who}.`,
      pair: () => "The key of the couple, money, tasks, quarrels and how to mend them, a plan for two — for two dates.",
      year: () => "The matrix of any year, three periods and twelve month chapters: when to start, when to close.",
    },
  } satisfies Pair<Record<"personal" | "pair" | "year", (x: string) => string>>,
  yourDate: { ru: "вашей дате", en: "your date" } satisfies Phrase,
  theDate: { ru: (d: string) => `дате ${d}`, en: (d: string) => d } satisfies PhraseFn<[string]>,
  exLabel: {
    ru: { personal: "Пример личного разбора", pair: "Пример разбора пары", year: "Пример разбора на год" },
    en: { personal: "Example of a personal reading", pair: "Example of a couple reading", year: "Example of a year reading" },
  } satisfies Pair<Record<"personal" | "pair" | "year", string>>,
  ribbon: { ru: "Рекомендуем до конца января", en: "Recommended until the end of January" } satisfies Phrase,
  selfYearTagline: { ru: (y: number) => `Личный + Год ${y}`, en: (y: number) => `Personal + Year ${y}` } satisfies PhraseFn<[number]>,
  selfYearDesc: {
    ru: (y: number) => `Сначала — как вы устроены. Потом — как пройти ${y} год: три периода и двенадцать месяцев, когда начинать и когда закрывать.`,
    en: (y: number) => `First — how you are made. Then — how to go through ${y}: three periods and twelve months, when to start and when to close.`,
  } satisfies PhraseFn<[number]>,
  yearNote: {
    ru: (own: boolean, y: number, centre: string, p: [string, string, string]) =>
      `**${own ? `Ваш ${y}` : `${y} для даты примера`}:** центр года — ${centre}. Январь–апрель — ${p[0]}, май–август — ${p[1]}, сентябрь–декабрь — ${p[2]}.${own ? "" : " Введите свою дату выше — покажем ваш."}`,
    en: (own: boolean, y: number, centre: string, p: [string, string, string]) =>
      `**${own ? `Your ${y}` : `${y} for the example date`}:** the centre of the year is ${centre}. January–April — ${p[0]}, May–August — ${p[1]}, September–December — ${p[2]}.${own ? "" : " Enter your date above — we will show yours."}`,
  } satisfies PhraseFn<[boolean, number, string, [string, string, string]]>,
  coupleTagline: { ru: "Два личных + совместимость", en: "Two personal + compatibility" } satisfies Phrase,
  coupleDesc: {
    ru: "Личный разбор для каждого и разбор пары: что между вами, где ломается и как это чинить.",
    en: "A personal reading for each of you and a couple reading: what is between you, where it breaks and how to mend it.",
  } satisfies Phrase,
  builderKicker: { ru: "✦ Конструктор", en: "✦ Builder" } satisfies Phrase,
  builderTitle: { ru: "Набросайте, сколько нужно, — цена посчитается сама", en: "Add as many as you need — the price works itself out" } satisfies Phrase,
  stepHint: {
    ru: { personal: "для себя или близкого", pair: "две даты, совместимость", year: "любой · двенадцать месяцев" },
    en: { personal: "for yourself or someone close", pair: "two dates, compatibility", year: "any year · twelve months" },
  } satisfies Pair<Record<"personal" | "pair" | "year", string>>,
  each: { ru: (sum: string) => `${sum} за каждый`, en: (sum: string) => `${sum} each` } satisfies PhraseFn<[string]>,
  noSub: {
    ru: "**Подписка 590 ₽ на 3 месяца** открывает автоматические разборы. Индивидуальный в неё не входит: его пишут отдельно для каждого.",
    en: "**The 590 ₽ subscription for 3 months** opens the automatic readings. The individual reading is not part of it: it is written separately for each person.",
  } satisfies Phrase,

  howTitle: { ru: "Как вы его получите", en: "How you will get it" } satisfies Phrase,
  howSteps: {
    ru: (latest: string) => [
      ["Мгновенно", "Автоматический разбор этих дат открыт в кабинете — в подарок, пока пишется индивидуальный."],
      ["Обычно за 1 рабочий день", `Не позже ${latest} — это максимум, 3 рабочих дня. Автор пишет, вторая модель проверяет, человек из редакции одобряет. В кабинете статус «В работе».`],
      ["Письмо и уведомление", "Разбор появляется в кабинете, во вкладке «Индивидуальные». Читаете на сайте, скачиваете PDF. Ссылка из письма открывается без входа 30 дней."],
    ],
    en: (latest: string) => [
      ["Instantly", "The automatic reading of these dates is open in your account — as a gift, while the individual one is being written."],
      ["Usually in 1 working day", `No later than ${latest} — that is the maximum, 3 working days. The author writes, the second model checks, a person from our editorial team approves. Your account shows the status “In progress”.`],
      ["An email and a notice", "The reading appears in your account, under “Individual”. Read it on the site, download the PDF. The link from the email opens without signing in for 30 days."],
    ],
  } satisfies Pair<(latest: string) => [string, string][]>,
  guarTitle: { ru: "Гарантии", en: "Guarantees" } satisfies Phrase,
  guar: {
    ru: (latest: string) => [`Не готов к ${latest} — вернём деньги, а разбор всё равно пришлём.`, "Передумали, пока мы пишем, — вернём всё.", "Нашли ошибку в расчёте — перепишем."],
    en: (latest: string) => [`Not ready by ${latest} — we refund the money and still send the reading.`, "Changed your mind while we are writing — we refund everything.", "Found a mistake in the calculation — we rewrite it."],
  } satisfies Pair<(latest: string) => string[]>,

  orderTitle: { ru: "Заказать индивидуальный разбор", en: "Order an individual reading" } satisfies Phrase,
  orderWhat: { ru: "Что заказываете", en: "What you are ordering" } satisfies Phrase,
  optOneSub: { ru: (y: number) => `личный, пара или год ${y}`, en: (y: number) => `personal, couple or year ${y}` } satisfies PhraseFn<[number]>,
  optCustom: { ru: "Конструктор", en: "Builder" } satisfies Phrase,
  optCustomSub: { ru: (next: string) => `сколько угодно разборов: с четвёртого — по ${next}`, en: (next: string) => `as many readings as you like: from the fourth on, ${next} each` } satisfies PhraseFn<[string]>,
  whichKind: { ru: "Какой разбор", en: "Which reading" } satisfies Phrase,
  buildSet: { ru: "Соберите набор", en: "Build your set" } satisfies Phrase,
  topics: {
    ru: [
      ["Деньги приходят рывками", "Деньги приходят рывками — почему и что с этим делать?", "one", "personal"],
      ["Отношения идут по кругу", "Отношения раз за разом идут по одному сценарию — почему и как это изменить?", "one", "personal"],
      ["Не знаю, чем заниматься", "Не понимаю, какое дело моё и где мои сильные стороны.", "one", "personal"],
      ["Мы часто ссоримся", "Мы часто ссоримся из-за мелочей — что между нами и как это чинить?", "couple", ""],
      ["Стоит ли продолжать", "Стоит ли нам продолжать — что нас держит вместе и где мы расходимся?", "one", "pair"],
      ["Что будет в моём году", "Чего ждать от года — когда начинать новое, а когда закрывать старое?", "selfYear", ""],
    ],
    en: [
      ["Money comes in bursts", "Money comes in bursts — why, and what can I do about it?", "one", "personal"],
      ["Relationships go in circles", "My relationships follow the same script again and again — why, and how do I change it?", "one", "personal"],
      ["I don’t know what to do", "I don’t understand which work is mine and where my strengths are.", "one", "personal"],
      ["We quarrel often", "We often quarrel over little things — what is between us and how do we mend it?", "couple", ""],
      ["Should we go on", "Should we go on — what keeps us together and where do we part ways?", "one", "pair"],
      ["What my year holds", "What should I expect from the year — when to start new things and when to close old ones?", "selfYear", ""],
    ],
  } satisfies Pair<[string, string, string, string][]>,
  topicNote: { ru: (name: string) => `Под этот вопрос подходит «${name}»`, en: (name: string) => `“${name}” fits this question` } satisfies PhraseFn<[string]>,
  topicChoose: { ru: "Выбрать", en: "Choose" } satisfies Phrase,
  questionPlaceholder: { ru: "Например: деньги приходят рывками — почему и что с этим делать?", en: "For example: money comes in bursts — why, and what can I do about it?" } satisfies Phrase,
  emailPlaceholder: { ru: "you@example.ru", en: "you@example.com" } satisfies Phrase,
  passwordPlaceholder: { ru: "Не меньше 3 символов", en: "At least 3 characters" } satisfies Phrase,
  summaryWhen: { ru: (latest: string) => `обычно за 1 рабочий день, не позже ${latest}`, en: (latest: string) => `usually in 1 working day, no later than ${latest}` } satisfies PhraseFn<[string]>,
  byDate: { ru: (dates: string) => `по дате ${dates}`, en: (dates: string) => `for ${dates}` } satisfies PhraseFn<[string]>,
  noDate: { ru: "Дата ещё не указана", en: "No date entered yet" } satisfies Phrase,
  payFine: {
    ru: (latest: string) => `Обычно готов за 1 рабочий день, не позже **${latest}**, автоматический разбор откроется мгновенно. Разбор увидите только вы — он закрыт от поиска. Подписка на автоматические разборы его не включает. Это символическое чтение для самопознания, а не прогноз.`,
    en: (latest: string) => `Usually ready in 1 working day, no later than **${latest}**; the automatic reading opens instantly. Only you will see the reading — it is closed to search engines. The subscription to automatic readings does not include it. This is a symbolic reading for self-knowledge, not a forecast.`,
  } satisfies PhraseFn<[string]>,
  scGuar: {
    ru: (latest: string) => ["Около 15 тысяч слов о вас — на сайте и в PDF", "Автоматический разбор этих дат — мгновенно, в подарок", `Обычно за 1 рабочий день, не позже **${latest}**; придёт письмо`, "Не успели к сроку — вернём деньги"],
    en: (latest: string) => ["About 15,000 words about you — on the site and as a PDF", "The automatic reading of these dates — instantly, as a gift", `Usually in 1 working day, no later than **${latest}**; you will get an email`, "Missed the deadline — we refund the money"],
  } satisfies Pair<(latest: string) => string[]>,

  faqTitle: { ru: "Вопросы", en: "Questions" } satisfies Phrase,
  barSample: { ru: "Такой же по вашей дате", en: "The same for your date" } satisfies Phrase,
  barDate: { ru: (d: string) => `Разбор по дате ${d}`, en: (d: string) => `A reading for ${d}` } satisfies PhraseFn<[string]>,
  barSub: { ru: (price: string) => `${price} · обычно за 1 рабочий день`, en: (price: string) => `${price} · usually in 1 working day` } satisfies PhraseFn<[string]>,
  order: { ru: "Заказать", en: "Order" } satisfies Phrase,
};
