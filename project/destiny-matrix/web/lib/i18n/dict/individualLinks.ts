import type { Phrase, PhraseFn } from "./index";

type Pair<T> = Record<"ru" | "en", T>;
type Letter = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "S" | "T" | "R" | "R1" | "R2";

const ruPlural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};
const ruDates = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? "даты" : "дат");

/** The links block of the Individual landing: equal cards in different points and the rules of the corpus. */
export const individualLinks = {
  /** role of a point, its place on the site chart, the spheres it speaks about ("|" between several) */
  points: {
    ru: {
      A: ["маска", "крупный круг слева", "характера"], B: ["главный талант", "крупный круг сверху", "дела"],
      C: ["материальная задача", "крупный круг справа", "денег"], D: ["кармическая задача", "крупный круг снизу", "кармического хвоста"],
      E: ["центр", "центр схемы", "характера"], F: ["вдохновение", "левый верхний угол", "рода"],
      G: ["точка давления", "правый верхний угол", "рода"], H: ["усилитель", "правый нижний угол", "рода"],
      I: ["усилитель", "левый нижний угол", "рода"], J: ["точка родителей", "внутренний круг слева", "отношений с родителями"],
      K: ["второй талант", "внутренний круг сверху", "дела"], L: ["вход в деньги", "внутренний круг справа", "денег"],
      M: ["вход в отношения", "внутренний круг снизу", "отношений"], N: ["середина кармического хвоста", "малая точка снизу", "кармического хвоста"],
      O: ["точка детей", "малая точка слева", "отношений с детьми"], P: ["середина линии талантов", "малая точка сверху", "дела"],
      Q: ["отношение к материальному", "малая точка справа", "денег"],
      S: ["любовь в поступках", "малая точка слева у центра (анахата)", "близости"], T: ["любовь внутри", "малая точка сверху у центра (анахата)", "близости"],
      R: ["точка «своего» человека", "малая точка на диагонали справа снизу", "отношений|денег"], R1: ["точка примирения", "малая точка справа снизу", "отношений"],
      R2: ["заработок", "малая точка справа снизу", "денег"],
    },
    en: {
      A: ["mask", "large circle on the left", "character"], B: ["main talent", "large circle at the top", "work"],
      C: ["material task", "large circle on the right", "money"], D: ["karmic task", "large circle at the bottom", "the karmic tail"],
      E: ["centre", "centre of the chart", "character"], F: ["inspiration", "upper left corner", "the lineage"],
      G: ["pressure point", "upper right corner", "the lineage"], H: ["amplifier", "lower right corner", "the lineage"],
      I: ["amplifier", "lower left corner", "the lineage"], J: ["parents’ point", "inner circle on the left", "relations with parents"],
      K: ["second talent", "inner circle at the top", "work"], L: ["money entrance", "inner circle on the right", "money"],
      M: ["relationship entrance", "inner circle at the bottom", "relationships"], N: ["middle of the karmic tail", "small point at the bottom", "the karmic tail"],
      O: ["children’s point", "small point on the left", "relations with children"], P: ["middle of the line of talents", "small point at the top", "work"],
      Q: ["attitude to the material", "small point on the right", "money"],
      S: ["love in actions", "small point left of the centre (anahata)", "closeness"], T: ["love inside", "small point above the centre (anahata)", "closeness"],
      R: ["point of “your” person", "small point on the lower right diagonal", "relationships|money"], R1: ["point of reconciliation", "small point lower right", "relationships"],
      R2: ["earnings", "small point lower right", "money"],
    },
  } satisfies Pair<Record<Letter, [string, string, string]>>,
  /** pairs of points opposite each other, in the order of the method */
  mirrors: {
    ru: ["крупные круги слева и справа", "крупные круги сверху и снизу", "верхние углы", "нижние углы", "левые углы", "правые углы", "внутренние круги слева и справа", "внутренние круги сверху и снизу"],
    en: ["large circles on the left and right", "large circles at the top and bottom", "upper corners", "lower corners", "left corners", "right corners", "inner circles on the left and right", "inner circles at the top and bottom"],
  } satisfies Pair<string[]>,
  bothAmplifiers: { ru: "оба усилителя", en: "both amplifiers" } satisfies Phrase,
  bothLove: { ru: "обе точки любви", en: "both love points" } satisfies Phrase,
  and: { ru: "и", en: "and" } satisfies Phrase,
  oneCard: { ru: "одна карта", en: "one card" } satisfies Phrase,
  morePoints: {
    ru: (n: number) => `ещё ${n} ${ruPlural(n, "точка", "точки", "точек")}`,
    en: (n: number) => `${n} more ${n === 1 ? "point" : "points"}`,
  } satisfies PhraseFn<[number]>,
  andMore: { ru: (more: string) => `и ${more}`, en: (more: string) => `and ${more}` } satisfies PhraseFn<[string]>,
  inHundred: { ru: (n: number) => `у ${n} ${ruDates(n)} из 100`, en: (n: number) => `in ${n} ${n === 1 ? "date" : "dates"} out of 100` } satisfies PhraseFn<[number]>,
  inThousand: { ru: (n: number) => `у ${n} ${ruDates(n)} из 1000`, en: (n: number) => `in ${n} ${n === 1 ? "date" : "dates"} out of 1000` } satisfies PhraseFn<[number]>,
  rarer: { ru: "реже, чем у 1 даты из 1000", en: "rarer than 1 date in 1000" } satisfies Phrase,
  chapter: { ru: (n: string) => `гл. ${n}`, en: (n: string) => `ch. ${n}` } satisfies PhraseFn<[string]>,
  compatChapter: { ru: "«Совместимость», гл. 2", en: "“Compatibility”, ch. 2" } satisfies Phrase,
  ruleInspiration: {
    ru: "Ровно такой случай разобран в корпусе книг: одна карта стоит и во вдохновении, и в точке давления. То, что наполняет человека силами, становится и самым чувствительным местом: критику именно в этой теме он переносит тяжелее.",
    en: "Exactly this case is covered in the corpus of books: one card stands both in inspiration and in the pressure point. What fills a person with strength becomes their most sensitive place too: criticism in exactly this area is harder for them to bear.",
  } satisfies Phrase,
  ruleMoney: {
    ru: (money: string, pair: string) => `Для денег у Лисовской есть отдельная проверка: не стоит ли карта из денежной линии ещё и в таланте, в кармическом хвосте, в материальной задаче или в точке давления. Если стоит, деньги и эта тема связаны напрямую. У вас ${money} и ${pair} — одна карта.`,
    en: (money: string, pair: string) => `For money Lisovskaya has a separate check: whether a card of the money line also stands in the talent, the karmic tail, the material task or the pressure point. If it does, money and that theme are directly linked. Your ${money} and ${pair} are one card.`,
  } satisfies PhraseFn<[string, string]>,
  ruleCentre: {
    ru: (others: string) => `Чем чаще карта центра встречается на схеме, тем ярче она видна в характере. Ваш центр повторяется: **${others}**.`,
    en: (others: string) => `The more often the card of the centre appears on the chart, the more clearly it shows in the character. Your centre repeats: **${others}**.`,
  } satisfies PhraseFn<[string]>,
  ruleAmplifier: {
    ru: (others: string) => `Усилитель работает, только если его карта стоит на схеме ещё где-то, иначе он почти не влияет. У вас стоит — **${others}**, значит, усилитель работает.`,
    en: (others: string) => `An amplifier works only if its card stands somewhere else on the chart too; otherwise it has almost no effect. Yours does — **${others}**, so the amplifier works.`,
  } satisfies PhraseFn<[string]>,
  rulePressure: {
    ru: (others: string) => `Точка давления — место, через которое на человека легче всего повлиять. Лисовская советует начинать работу с неё, особенно если её карта встречается на схеме ещё раз. У вас встречается — **${others}**.`,
    en: (others: string) => `The pressure point is the place through which a person is easiest to influence. Lisovskaya advises starting the work with it, especially if its card appears on the chart once more. Yours does — **${others}**.`,
  } satisfies PhraseFn<[string]>,
  ruleMirror: {
    ru: (places: string) => `Эти точки стоят друг напротив друга (${places}). Такие зеркальные повторы Лисовская советует замечать в самом начале чтения.`,
    en: (places: string) => `These points stand opposite each other (${places}). Lisovskaya advises noticing such mirror repetitions at the very start of a reading.`,
  } satisfies PhraseFn<[string]>,
  sumHead: {
    ru: (parts: string, raw: number, sum: number, name: string) => `Лисовская советует сложить повторяющиеся карты — сумма показывает, во что повтор складывается: **${parts} = ${raw}**${raw > 22 ? `, а ${raw} по правилу счёта превращается в ${sum}` : ""} — это ${name}. `,
    en: (parts: string, raw: number, sum: number, name: string) => `Lisovskaya advises adding up repeated cards — the sum shows what the repetition adds up to: **${parts} = ${raw}**${raw > 22 ? `, and by the counting rule ${raw} turns into ${sum}` : ""} — that is ${name}. `,
  } satisfies PhraseFn<[string, number, number, string]>,
  sumSame: { ru: "Сумма снова даёт ту же карту: повтор только усиливает её.", en: "The sum gives the same card again: the repetition only strengthens it." } satisfies Phrase,
  sumOnChart: {
    ru: (roles: string) => `Эта карта у вас тоже есть на схеме — **${roles}**. Поэтому сумма не теряется: слабой, фоновой её считают, только когда такой карты на схеме нет.`,
    en: (roles: string) => `You have this card on the chart too — **${roles}**. So the sum is not lost: it counts as weak, a background, only when there is no such card on the chart.`,
  } satisfies PhraseFn<[string]>,
  sumWeak: { ru: "Этой карты на вашей схеме нет, поэтому по правилу сумма звучит слабо — фоном.", en: "This card is not on your chart, so by the rule the sum sounds weak — as a background." } satisfies Phrase,
  source: {
    ru: (chapters: string, compat: boolean) => `Источник: Ю. Лисовская, «Матрица судьбы для начинающих» (${chapters})${compat ? " и «Матрица судьбы. Совместимость» (гл. 5)" : ""}. Здесь только правило и ваши числа — толкований о вас нет.`,
    en: (chapters: string, compat: boolean) => `Source: Yu. Lisovskaya, “Destiny Matrix for Beginners” (${chapters})${compat ? " and “Destiny Matrix. Compatibility” (ch. 5)" : ""}. Only the rule and your numbers here — no interpretations about you.`,
  } satisfies PhraseFn<[string, boolean]>,
  locked: {
    ru: (spheres: string) => `Смысл этой связи — в разборе. AI-автор объяснит, что она значит для ${spheres}, как может проявляться в вашем возрасте и что с ней делать.`,
    en: (spheres: string) => `The meaning of this link is in the reading. The AI author will explain what it means for ${spheres}, how it may show at your age and what to do with it.`,
  } satisfies PhraseFn<[string]>,
  lockedRules: {
    ru: (n: number) => n === 1 ? "Для такого совпадения в корпусе книг есть отдельное правило — его применяет автор разбора."
      : n ? `Для такого совпадения в корпусе книг есть ${n} ${ruPlural(n, "отдельное правило", "отдельных правила", "отдельных правил")} — их применяет автор разбора.` : "Названия точек — по книгам Лисовской.",
    en: (n: number) => n === 1 ? "The corpus of books has a separate rule for such a coincidence — the author of the reading applies it."
      : n ? `The corpus of books has ${n} separate rules for such a coincidence — the author of the reading applies them.` : "The names of the points are from Lisovskaya’s books.",
  } satisfies PhraseFn<[number]>,
  next: {
    ru: (spheres: string) => `Что эта связь значит именно для вас — для ${spheres}, — пишет AI-автор разбора по методике редакции. Текст проверяет вторая, независимая модель, одобряет человек из редакции.`,
    en: (spheres: string) => `What this link means for you in particular — for ${spheres} — is written by the AI author of the reading following our editorial method. The text is checked by a second, independent model and approved by a person from our editorial team.`,
  } satisfies PhraseFn<[string]>,
  nextSample: {
    ru: (finding: string) => ` В образце по этой дате из этой связи выросла находка «${finding}»: `,
    en: (finding: string) => ` In the example for this date, this link grew into the finding “${finding}”: `,
  } satisfies PhraseFn<[string]>,
  excerpt: { ru: "отрывок ниже", en: "the excerpt below" } satisfies Phrase,
  or: { ru: " или ", en: " or " } satisfies Phrase,
  wholeSample: { ru: "весь образец", en: "the whole example" } satisfies Phrase,
  countTitle: {
    ru: (n: number, own: boolean) => `${ruPlural(n, "связь", "связи", "связей")} в ${own ? "вашей" : "этой"} матрице`,
    en: (n: number, own: boolean) => `${n === 1 ? "link" : "links"} in ${own ? "your" : "this"} matrix`,
  } satisfies PhraseFn<[number, boolean]>,
  countSub: {
    ru: (label: string, rarity: string, rare: number, n: number) => `Одинаковые карты стоят в разных, часто далёких точках схемы. Самая редкая — **${label}**: так бывает ${rarity}.${rare > 1 ? ` Реже 1 даты из 100 — ${rare} ${ruPlural(rare, "связь", "связи", "связей")} из ${n}.` : ""}`,
    en: (label: string, rarity: string, rare: number, n: number) => `Identical cards stand in different, often distant points of the chart. The rarest is **${label}**: it happens ${rarity}.${rare > 1 ? ` Rarer than 1 date in 100 — ${rare} links out of ${n}.` : ""}`,
  } satisfies PhraseFn<[string, string, number, number]>,
  moreTitle: {
    ru: (n: number) => n > 1 ? `Одну связь мы объяснили по корпусу книг. Остальные ${n - 1} — в разборе` : "Связь мы объяснили по корпусу книг. Что из неё следует — в разборе",
    en: (n: number) => n > 1 ? `We explained one link from the corpus of books. The other ${n - 1} are in the reading` : "We explained the link from the corpus of books. What follows from it is in the reading",
  } satisfies PhraseFn<[number]>,

  section: { ru: "Связи в вашей матрице", en: "Links in your matrix" } satisfies Phrase,
  showAll: { ru: (n: number) => `Развернуть связи · ${n}`, en: (n: number) => `Expand the links · ${n}` } satisfies PhraseFn<[number]>,
  hideAll: { ru: "Свернуть связи", en: "Hide the links" } satisfies Phrase,
  titleStart: { ru: "В вашей матрице есть связи, которых ", en: "Your matrix has links you " } satisfies Phrase,
  titleAccent: { ru: "не видно по отдельности", en: "cannot see point by point" } satisfies Phrase,
  sub: {
    ru: "Покажем, где они, а индивидуальный разбор объяснит, что из них следует. Схема считается прямо в браузере.",
    en: "We show where they are, and the individual reading explains what follows from them. The chart is calculated right in your browser.",
  } satisfies Phrase,
  dateLabel: { ru: "Дата рождения", en: "Date of birth" } satisfies Phrase,
  placeholder: { ru: "дд.мм.гггг", en: "dd.mm.yyyy" } satisfies Phrase,
  showLinks: { ru: "Показать связи", en: "Show the links" } satisfies Phrase,
  badDate: { ru: "Проверьте дату: день.месяц.год, например 05.03.1990.", en: "Check the date: day.month.year, for example 05.03.1990." } satisfies Phrase,
  ownNote: { ru: "Схема и связи посчитаны по введённой дате. Дата никуда не отправляется.", en: "The chart and the links are calculated for the date you entered. The date is not sent anywhere." } satisfies Phrase,
  sampleNote: { ru: "Сейчас показана условная дата — введите свою.", en: "A sample date is shown now — enter yours." } satisfies Phrase,
  ownDate: { ru: "ваша дата", en: "your date" } satisfies Phrase,
  sampleDate: { ru: "условная дата", en: "sample date" } satisfies Phrase,
  legendLink: { ru: "связь", en: "link" } satisfies Phrase,
  legendPoint: { ru: "точка связи", en: "point of a link" } satisfies Phrase,
  chart: { ru: "Октаграмма матрицы судьбы с линиями связей", en: "Destiny matrix octagram with the lines of links" } satisfies Phrase,
  sky: { ru: "НЕБО", en: "SKY" } satisfies Phrase,
  earth: { ru: "ЗЕМЛЯ", en: "EARTH" } satisfies Phrase,
  inLink: { ru: "в связи", en: "in the link" } satisfies Phrase,
  rare: { ru: "редкая", en: "rare" } satisfies Phrase,
  common: { ru: "частая", en: "common" } satisfies Phrase,
  open: { ru: "открыто", en: "open" } satisfies Phrase,
  inReading: { ru: "в разборе", en: "in the reading" } satisfies Phrase,
  freeKicker: { ru: "Открыто бесплатно: что говорит корпус книг", en: "Open for free: what the corpus of books says" } satisfies Phrase,
  moreText: {
    ru: "Автоматический разбор объясняет каждый раздел отдельно. Индивидуальный пишется для вас с нуля: что следует из этих совпадений для денег, близости и вашего возраста — и что с этим делать.",
    en: "The automatic reading explains each section on its own. The individual one is written for you from scratch: what follows from these coincidences for money, closeness and your age — and what to do about it.",
  } satisfies Phrase,
  whatInMine: { ru: "Что будет в моём разборе", en: "What will be in my reading" } satisfies Phrase,
  seeExample: { ru: "Посмотреть пример", en: "See an example" } satisfies Phrase,
  fine: {
    ru: "Пишет AI-автор по методике редакции, проверяет вторая модель, одобряет человек · обычно 1 рабочий день, максимум 3 · в подписку не входит",
    en: "Written by an AI author following our editorial method, checked by a second model, approved by a person · usually 1 working day, at most 3 · not part of the subscription",
  } satisfies Phrase,
};
