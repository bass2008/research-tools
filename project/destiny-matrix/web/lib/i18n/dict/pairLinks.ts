import type { Phrase, PhraseFn } from "./index";

type Pair<T> = Record<"ru" | "en", T>;
type PairLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "R1" | "R2";

const ruPlural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};
const ruPairs = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? "пары" : "пар");

export const pairLinks = {
  /** role of a point in the couple, its place on the chart, the spheres it speaks about ("|" between several) */
  points: {
    ru: {
      A: ["образ пары", "крупный круг слева", "образа пары"], B: ["смысл встречи", "крупный круг сверху", "смысла встречи"],
      C: ["материальное", "крупный круг справа", "быта|денег"], D: ["задача пары", "крупный круг снизу", "задач пары"],
      E: ["атмосфера пары", "центр схемы", "атмосферы пары"], F: ["то, что наполняет", "левый верхний угол", "того, что вас наполняет"],
      G: ["то, что портит", "правый верхний угол", "ссор"], H: ["усилитель", "правый нижний угол", ""],
      I: ["усилитель", "левый нижний угол", ""], J: ["пара как родители", "внутренний круг слева", "родительства"],
      K: ["продолжение смысла встречи", "внутренний круг сверху", "смысла встречи"], L: ["вход в деньги", "внутренний круг справа", "денег"],
      M: ["общий язык", "внутренний круг снизу", "общих целей"], N: ["середина хвоста пары", "малая точка снизу", "задач пары"],
      O: ["отношение к ребёнку", "малая точка слева", "родительства"], P: ["середина линии смысла", "малая точка сверху", "смысла встречи"],
      Q: ["продолжение материального", "малая точка справа", "быта|денег"],
      R: ["денежные пробоины", "малая точка на диагонали справа снизу", "денег|отношений"], R1: ["то, что соединяет", "малая точка справа снизу", "отношений"],
      R2: ["путь к достатку", "малая точка справа снизу", "денег"],
    },
    en: {
      A: ["image of the couple", "large circle on the left", "the couple’s image"], B: ["purpose of the meeting", "large circle at the top", "why you met"],
      C: ["the material", "large circle on the right", "home|money"], D: ["task of the couple", "large circle at the bottom", "the couple’s tasks"],
      E: ["atmosphere of the couple", "centre of the chart", "the couple’s atmosphere"], F: ["what fills you", "upper left corner", "what fills you"],
      G: ["what spoils it", "upper right corner", "quarrels"], H: ["amplifier", "lower right corner", ""],
      I: ["amplifier", "lower left corner", ""], J: ["the couple as parents", "inner circle on the left", "parenthood"],
      K: ["continuation of the purpose", "inner circle at the top", "why you met"], L: ["money entrance", "inner circle on the right", "money"],
      M: ["common language", "inner circle at the bottom", "shared goals"], N: ["middle of the couple’s tail", "small point at the bottom", "the couple’s tasks"],
      O: ["attitude to the child", "small point on the left", "parenthood"], P: ["middle of the line of purpose", "small point at the top", "why you met"],
      Q: ["continuation of the material", "small point on the right", "home|money"],
      R: ["money leaks", "small point on the lower right diagonal", "money|relationships"], R1: ["what connects you", "small point lower right", "relationships"],
      R2: ["way to prosperity", "small point lower right", "money"],
    },
  } satisfies Pair<Record<PairLetter, [string, string, string]>>,
  spiritual: { ru: "духовное предназначение", en: "spiritual purpose" } satisfies Phrase,
  inHundred: { ru: (n: number) => `у ${n} ${ruPairs(n)} из 100`, en: (n: number) => `in ${n} ${n === 1 ? "couple" : "couples"} out of 100` } satisfies PhraseFn<[number]>,
  inThousand: { ru: (n: number) => `у ${n} ${ruPairs(n)} из 1000`, en: (n: number) => `in ${n} ${n === 1 ? "couple" : "couples"} out of 1000` } satisfies PhraseFn<[number]>,
  rarer: { ru: "реже, чем у 1 пары из 1000", en: "rarer than 1 couple in 1000" } satisfies Phrase,
  chapter: { ru: (n: string) => `гл. ${n}`, en: (n: string) => `ch. ${n}` } satisfies PhraseFn<[string]>,
  ruleMeet: {
    ru: "Образ пары и смысл встречи Лисовская читает вместе: эти две точки отвечают, зачем вас свела судьба. У вас в обеих одна карта, поэтому ответ звучит одной энергией, а не спором двух.",
    en: "Lisovskaya reads the image of the couple and the purpose of the meeting together: these two points answer why fate brought you together. You have one card in both, so the answer sounds as one energy, not as a dispute of two.",
  } satisfies Phrase,
  ruleFillSpoil: {
    ru: "То, что наполняет пару, и то, что может её испортить, — одна карта. Первую точку Лисовская читает в плюсе, вторую в минусе: одна и та же энергия держит союз и, если её перекосить, его ломает.",
    en: "What fills the couple and what may spoil it are one card. Lisovskaya reads the first point in the plus and the second in the minus: one and the same energy holds the union and, if it is skewed, breaks it.",
  } satisfies Phrase,
  ruleMaterialTask: {
    ru: "Отношение к материальному и задачи пары Лисовская советует читать вместе: так видно, что пара делает не так в быту и в главном. У вас это одна карта.",
    en: "Lisovskaya advises reading the attitude to the material and the couple’s tasks together: this shows what the couple does wrong in everyday life and in the main thing. You have one card there.",
  } satisfies Phrase,
  ruleMoney: {
    ru: (money: string, love: string) => `Линия денег и линия отношений у пары тесно связаны, и Лисовская читает их вместе. У вас ${money} и ${love} — одна карта: деньги и отношения между вами связаны напрямую.`,
    en: (money: string, love: string) => `The couple’s money line and relationship line are closely tied, and Lisovskaya reads them together. Your ${money} and ${love} are one card: money and the relationship between you are directly linked.`,
  } satisfies PhraseFn<[string, string]>,
  ruleCentre: {
    ru: (others: string) => `Центр — общая атмосфера пары, то, что между вами и не напоказ. Его карта стоит ещё и здесь: **${others}**. Атмосфера пары проступает и там.`,
    en: (others: string) => `The centre is the couple’s common atmosphere, what is between you and not for show. Its card also stands here: **${others}**. The couple’s atmosphere shows through there too.`,
  } satisfies PhraseFn<[string]>,
  ruleAmplifier: {
    ru: (others: string) => `Усилители в матрице пары необязательные: они работают, только если их карта стоит на схеме ещё где-то. У вас стоит — **${others}**, значит, усилитель работает.`,
    en: (others: string) => `Amplifiers in the couple’s matrix are optional: they work only if their card stands somewhere else on the chart. Yours does — **${others}**, so the amplifier works.`,
  } satisfies PhraseFn<[string]>,
  ruleTask: {
    ru: (others: string) => `Нижняя точка — главная задача пары, её испытания. Та же карта стоит ещё и здесь: **${others}**. Задача пары проявляется и там.`,
    en: (others: string) => `The bottom point is the couple’s main task, its trials. The same card also stands here: **${others}**. The couple’s task shows there too.`,
  } satisfies PhraseFn<[string]>,
  ruleSpiritual: {
    ru: "Эта же карта — духовное предназначение пары: ценности и путь, по которому вам идти вместе. Лисовская читает его вместе с атмосферой, образом пары, смыслом встречи и тем, что наполняет и портит.",
    en: "The same card is the couple’s spiritual purpose: the values and the path you are to walk together. Lisovskaya reads it together with the atmosphere, the image of the couple, the purpose of the meeting and what fills and spoils it.",
  } satisfies Phrase,
  ruleMirror: {
    ru: (places: string) => `Эти точки стоят друг напротив друга (${places}). Такие зеркальные повторы Лисовская советует замечать в самом начале чтения.`,
    en: (places: string) => `These points stand opposite each other (${places}). Lisovskaya advises noticing such mirror repetitions at the very start of a reading.`,
  } satisfies PhraseFn<[string]>,
  sumOnChart: {
    ru: (roles: string) => `Эта карта тоже есть на схеме пары — **${roles}**. Поэтому сумма не теряется: слабой, фоновой её считают, только когда такой карты на схеме нет.`,
    en: (roles: string) => `This card is on the couple’s chart too — **${roles}**. So the sum is not lost: it counts as weak, a background, only when there is no such card on the chart.`,
  } satisfies PhraseFn<[string]>,
  sumWeak: { ru: "Этой карты на схеме пары нет, поэтому по правилу сумма звучит слабо — фоном.", en: "This card is not on the couple’s chart, so by the rule the sum sounds weak — as a background." } satisfies Phrase,
  carriers: {
    ru: (where: string) => `Где эта карта стоит в ваших личных матрицах: ${where}.`,
    en: (where: string) => `Where this card stands in your personal matrices: ${where}.`,
  } satisfies PhraseFn<[string]>,
  carrierNone: { ru: "нет на главных точках", en: "not on the main points" } satisfies Phrase,
  carriersBoth: { ru: "Её приносите в пару вы оба.", en: "You both bring it into the couple." } satisfies Phrase,
  carriersOne: { ru: (name: string) => `Из личных матриц её приносит ${name}.`, en: (name: string) => `${name} brings it from the personal matrices.` } satisfies PhraseFn<[string]>,
  carriersNone: {
    ru: "Ни у одного из вас на главных точках её нет: эта карта появляется, только когда вы вместе.",
    en: "Neither of you has it on the main points: this card appears only when you are together.",
  } satisfies Phrase,
  source: {
    ru: (chapters: string) => `Источник: Ю. Лисовская, «Матрица судьбы. Совместимость» (${chapters}). Здесь только правило и ваши числа — толкований о вас нет.`,
    en: (chapters: string) => `Source: Yu. Lisovskaya, “Destiny Matrix. Compatibility” (${chapters}). Only the rule and your numbers here — no interpretations about you.`,
  } satisfies PhraseFn<[string]>,
  locked: {
    ru: (spheres: string) => `Смысл этой связи — в разборе пары. AI-автор объяснит, что она значит для ${spheres} и что с этим делать вдвоём.`,
    en: (spheres: string) => `The meaning of this link is in the couple’s reading. The AI author will explain what it means for ${spheres} and what the two of you can do about it.`,
  } satisfies PhraseFn<[string]>,
  next: {
    ru: (spheres: string) => `Что эта связь значит именно для вашей пары — для ${spheres}, — пишет AI-автор разбора по методике редакции. Текст проверяет вторая, независимая модель, одобряет человек из редакции.`,
    en: (spheres: string) => `What this link means for your couple in particular — for ${spheres} — is written by the AI author of the reading following our editorial method. The text is checked by a second, independent model and approved by a person from our editorial team.`,
  } satisfies PhraseFn<[string]>,
  countTitle: {
    ru: (n: number) => `${ruPlural(n, "связь", "связи", "связей")} в матрице вашей пары`,
    en: (n: number) => `${n === 1 ? "link" : "links"} in your couple’s matrix`,
  } satisfies PhraseFn<[number]>,
  countSub: {
    ru: (label: string, rarity: string, rare: number, n: number) => `Одинаковые карты стоят в разных, часто далёких точках схемы пары. Самая редкая — **${label}**: так бывает ${rarity}.${rare > 1 ? ` Реже 1 пары из 100 — ${rare} ${ruPlural(rare, "связь", "связи", "связей")} из ${n}.` : ""}`,
    en: (label: string, rarity: string, rare: number, n: number) => `Identical cards stand in different, often distant points of the couple’s chart. The rarest is **${label}**: it happens ${rarity}.${rare > 1 ? ` Rarer than 1 couple in 100 — ${rare} links out of ${n}.` : ""}`,
  } satisfies PhraseFn<[string, string, number, number]>,
  section: { ru: "Связи в матрице вашей пары", en: "Links in your couple’s matrix" } satisfies Phrase,
  titleStart: { ru: "В матрице вашей пары есть связи, которых ", en: "Your couple’s matrix has links you " } satisfies Phrase,
  sub: {
    ru: "Покажем, где они, а индивидуальный разбор пары объяснит, что из них следует для вас двоих.",
    en: "We show where they are, and the individual couple reading explains what follows from them for the two of you.",
  } satisfies Phrase,
  dates: { ru: "ваши даты", en: "your dates" } satisfies Phrase,
  chart: { ru: "Октаграмма матрицы пары с линиями связей", en: "Couple matrix octagram with the lines of links" } satisfies Phrase,
  moreText: {
    ru: "Автоматический разбор объясняет каждую сферу пары по отдельности. Индивидуальный пишется для вас двоих с нуля: что следует из этих совпадений для денег, быта, ссор и общих целей — и что с этим делать.",
    en: "The automatic reading explains each sphere of the couple on its own. The individual one is written for the two of you from scratch: what follows from these coincidences for money, home, quarrels and shared goals — and what to do about it.",
  } satisfies Phrase,
};
