import type { Phrase, PhraseFn } from "./index";
import type { YearKey } from "../../yearMatrix";

type Pair<T> = Record<"ru" | "en", T>;

const ruPlural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};

/** Links of the year matrix after Lisovskaya's "Prognostics": "How to read the forecast" and the purposes block by thirds. */
export const yearLinks = {
  /** role of a point in the year, its place on the chart, the spheres it speaks about */
  points: {
    ru: {
      A: ["точка людей", "крупный круг слева", "отношений с людьми"], B: ["плюс года", "крупный круг сверху", "сильных сторон"],
      C: ["деньги года", "крупный круг справа", "денег"], D: ["испытание года", "крупный круг снизу", "испытаний"],
      E: ["центр года", "центр схемы", "главных событий"], F: ["вдохновение года", "левый верхний угол", "вдохновения"],
      G: ["слабое место года", "правый верхний угол", "настроя"], H: ["нижний угол года", "правый нижний угол", "планов"],
      I: ["нижний угол года", "левый нижний угол", "планов"],
      P1: ["январь–апрель", "первая треть года", "января–апреля"], P2: ["май–август", "вторая треть года", "мая–августа"],
      P3: ["сентябрь–декабрь", "последняя треть года", "сентября–декабря"],
    },
    en: {
      A: ["people point", "large circle on the left", "relations with people"], B: ["plus of the year", "large circle at the top", "strengths"],
      C: ["money of the year", "large circle on the right", "money"], D: ["trial of the year", "large circle at the bottom", "trials"],
      E: ["centre of the year", "centre of the chart", "the main events"], F: ["inspiration of the year", "upper left corner", "inspiration"],
      G: ["weak spot of the year", "upper right corner", "mood"], H: ["lower corner of the year", "lower right corner", "plans"],
      I: ["lower corner of the year", "lower left corner", "plans"],
      P1: ["January–April", "first third of the year", "January–April"], P2: ["May–August", "second third of the year", "May–August"],
      P3: ["September–December", "last third of the year", "September–December"],
    },
  } satisfies Pair<Record<YearKey, [string, string, string]>>,
  wheel: { ru: ["янв–апр", "май–авг", "сен–дек"], en: ["Jan–Apr", "May–Aug", "Sep–Dec"] } satisfies Pair<string[]>,
  bothHints: { ru: "оба нижних угла года", en: "both lower corners of the year" } satisfies Phrase,
  howToRead: { ru: "«Как читать прогноз»", en: "“How to read the forecast”" } satisfies Phrase,
  thirdsChapter: { ru: "«Что делать с блоком предназначений»", en: "“What to do with the purposes block”" } satisfies Phrase,
  ruleRepeat: {
    ru: (n: number) => `В прогнозе на год Лисовская советует первым делом смотреть, какие энергии дублируются и на каких точках. У вас эта карта стоит в ${n} ${ruPlural(n, "точке", "точках", "точках")} года.`,
    en: (n: number) => `In the forecast for a year Lisovskaya advises looking first at which energies repeat and on which points. You have this card on ${n} points of the year.`,
  } satisfies PhraseFn<[number]>,
  rulePlusMinus: {
    ru: (plus: string, minus: string) => `Одна карта стоит и в плюсе — ${plus}, — и в минусе — ${minus}. В прогнозе Лисовская разводит плюс и минус по точкам: верхняя точка и левый верхний угол показывают только плюс энергии, правая и нижняя — только минус. Поэтому в этом году карта показывает обе свои стороны.`,
    en: (plus: string, minus: string) => `One card stands both in the plus — ${plus} — and in the minus — ${minus}. In the forecast Lisovskaya splits plus and minus by points: the top point and the upper left corner show only the plus of an energy, the right and the bottom ones only the minus. So this year the card shows both its sides.`,
  } satisfies PhraseFn<[string, string]>,
  ruleMinusPair: {
    ru: "Деньги года и испытание года — одна карта. По книге эти две точки можно читать вместе, и обе показывают только минус энергии: у вас минус года собран в одной карте.",
    en: "The money of the year and the trial of the year are one card. By the book these two points can be read together, and both show only the minus of an energy: your minus of the year is gathered in one card.",
  } satisfies Phrase,
  rulePlusPair: {
    ru: "Плюс года и вдохновение года — одна карта. По книге это две точки исключительного плюса: сильная сторона года и то, на что в нём опираться, у вас совпадают.",
    en: "The plus of the year and the inspiration of the year are one card. By the book these are the two points of the pure plus: the year’s strength and what to rely on in it coincide for you.",
  } satisfies Phrase,
  ruleCentre: {
    ru: (others: string) => `Центр, по книге, — главные события и общий фон года, и читать его нужно в паре с другими точками. Карта центра стоит ещё и здесь: **${others}**.`,
    en: (others: string) => `The centre, by the book, is the main events and the general background of the year, and it is read together with other points. The card of the centre also stands here: **${others}**.`,
  } satisfies PhraseFn<[string]>,
  ruleWeak: {
    ru: (others: string) => `Правый верхний угол, по книге, влияет на всю матрицу года и показывает не плюс и не минус, а слабости перед другими. Его карта стоит ещё и здесь: **${others}**.`,
    en: (others: string) => `The upper right corner, by the book, affects the whole year matrix and shows neither plus nor minus but weaknesses before others. Its card also stands here: **${others}**.`,
  } satisfies PhraseFn<[string]>,
  ruleThirds: {
    ru: "Первые две трети года — одна карта. По книге январь–апрель и май–август задают события сентября–декабря: последствия того, что сделано в начале года.",
    en: "The first two thirds of the year are one card. By the book January–April and May–August set the events of September–December: the consequences of what was done early in the year.",
  } satisfies Phrase,
  ruleThird: {
    ru: (third: string, points: string) => `Блок предназначений матрицы года Лисовская читает по третям: каждая рассказывает о событиях и задачах своих четырёх месяцев. Карта ${third} уже стоит в матрице года — **${points}**, поэтому в эти месяцы её тема звучит дважды.`,
    en: (third: string, points: string) => `Lisovskaya reads the purposes block of the year matrix by thirds: each tells about the events and tasks of its four months. The card of ${third} already stands in the year matrix — **${points}**, so in these months its theme sounds twice.`,
  } satisfies PhraseFn<[string, string]>,
  ruleLast: {
    ru: (points: string) => `Сентябрь–декабрь, по книге, складывается из первых двух третей: показывает их результат, а ещё свои события и задачи. Его карта стоит ещё и здесь: **${points}**.`,
    en: (points: string) => `September–December, by the book, adds up from the first two thirds: it shows their result and also its own events and tasks. Its card also stands here: **${points}**.`,
  } satisfies PhraseFn<[string]>,
  rulePeople: {
    ru: (others: string) => `Левая точка, по книге, показывает, через что взаимодействовать с людьми в этом году: чего от вас ждут и где можно ошибиться по отношению к другим. Её карта стоит ещё и здесь: **${others}**.`,
    en: (others: string) => `The left point, by the book, shows how to deal with people this year: what is expected of you and where you may go wrong towards others. Its card also stands here: **${others}**.`,
  } satisfies PhraseFn<[string]>,
  ruleHint: {
    ru: (others: string) => `Нижние углы, по книге, показывают, для чего хорош год и чего в нём стоит остеречься.${others ? ` Их карта стоит ещё и здесь: **${others}**.` : " У вас в обоих одна карта."}`,
    en: (others: string) => `The lower corners, by the book, show what the year is good for and what to beware of in it.${others ? ` Their card also stands here: **${others}**.` : " You have one card in both."}`,
  } satisfies PhraseFn<[string]>,
  natal: {
    ru: (roles: string) => `Где эта карта стоит в вашей личной матрице: **${roles}**. В разборе года такие совпадения связывают год с тем, что в вас уже есть.`,
    en: (roles: string) => `Where this card stands in your personal matrix: **${roles}**. In the year reading such coincidences tie the year to what is already in you.`,
  } satisfies PhraseFn<[string]>,
  natalNone: {
    ru: "На схеме вашей личной матрицы этой карты нет: в разборе года смотрим, как год работает через незнакомую вам энергию.",
    en: "This card is not on the chart of your personal matrix: in the year reading we look at how the year works through an energy new to you.",
  } satisfies Phrase,
  source: {
    ru: (chapters: string) => `Источник: Ю. Лисовская, «Прогностика по Матрице Судьбы» (${chapters}); совпадения с личной матрицей — методика нашей редакции. Здесь только правила и ваши числа — толкований о вас нет.`,
    en: (chapters: string) => `Source: Yu. Lisovskaya, “Prognostics by the Destiny Matrix” (${chapters}); coincidences with the personal matrix are our editorial method. Only the rules and your numbers here — no interpretations about you.`,
  } satisfies PhraseFn<[string]>,
  locked: {
    ru: (spheres: string, year: number) => `Смысл этой связи — в индивидуальном разборе года. AI-автор объяснит, что она значит для ${spheres} в ${year} году, на какие месяцы приходится и что с ней делать.`,
    en: (spheres: string, year: number) => `The meaning of this link is in the individual year reading. The AI author will explain what it means for ${spheres} in ${year}, which months it falls on and what to do with it.`,
  } satisfies PhraseFn<[string, number]>,
  next: {
    ru: (spheres: string) => `Что эта связь значит именно для вашего года — для ${spheres}, — пишет AI-автор разбора по методике редакции, вместе с двенадцатью месяцами. Текст проверяет вторая, независимая модель, одобряет человек из редакции.`,
    en: (spheres: string) => `What this link means for your year in particular — for ${spheres} — is written by the AI author of the reading following our editorial method, together with the twelve months. The text is checked by a second, independent model and approved by a person from our editorial team.`,
  } satisfies PhraseFn<[string]>,
  moreTitle: {
    ru: (n: number) => n > 2 ? `Одну связь мы объяснили по книге. Остальные ${n - 1} — в разборе года` : n === 2 ? "Одну связь мы объяснили по книге. Вторая — в разборе года" : "Связь мы объяснили по книге. Что из неё следует — в разборе года",
    en: (n: number) => n > 2 ? `We explained one link from the book. The other ${n - 1} are in the year reading` : n === 2 ? "We explained one link from the book. The second is in the year reading" : "We explained the link from the book. What follows from it is in the year reading",
  } satisfies PhraseFn<[number]>,
  sampleNext: { ru: " Разбор года по этой условной дате можно прочитать целиком: ", en: " The year reading for this sample date can be read in full: " } satisfies Phrase,
  countTitle: {
    ru: (n: number, own: boolean, year: number) => `${ruPlural(n, "связь", "связи", "связей")} в ${own ? "вашем" : "этом"} ${year} году`,
    en: (n: number, own: boolean, year: number) => `${n === 1 ? "link" : "links"} in ${own ? "your" : "this"} ${year}`,
  } satisfies PhraseFn<[number, boolean, number]>,
  countSub: {
    ru: (label: string, rarity: string, year: number) => `Одинаковые карты стоят в разных точках матрицы года и в его третях. Самая редкая — **${label}**: в ${year} году так бывает ${rarity}.`,
    en: (label: string, rarity: string, year: number) => `Identical cards stand in different points of the year matrix and in its thirds. The rarest is **${label}**: in ${year} it happens ${rarity}.`,
  } satisfies PhraseFn<[string, string, number]>,
  section: { ru: "Связи в матрице вашего года", en: "Links in the matrix of your year" } satisfies Phrase,
  chart: { ru: "Матрица года с третями и линиями связей", en: "Year matrix with the thirds and the lines of links" } satisfies Phrase,
  title: {
    ru: (year: number) => `В вашем ${year} году есть связи, которых `,
    en: (year: number) => `Your ${year} has links you `,
  } satisfies PhraseFn<[number]>,
  zeroTitle: { ru: (year: number) => `В вашем ${year} году карты не повторяются — `, en: (year: number) => `In your ${year} no card repeats — ` } satisfies PhraseFn<[number]>,
  zeroAccent: { ru: "так бывает редко", en: "that is rare" } satisfies Phrase,
  sub: {
    ru: "Одна карта может стоять в нескольких точках матрицы года и в его третях. Такие повторы Лисовская советует замечать первыми. Схема считается прямо в браузере.",
    en: "One card can stand in several points of the year matrix and in its thirds. Lisovskaya advises noticing such repetitions first. The chart is calculated right in your browser.",
  } satisfies Phrase,
  moreText: {
    ru: "Здесь — только где связи. Индивидуальный разбор года пишется для вас с нуля: три трети, двенадцать месяцев, деньги, отношения и план — с учётом вашей личной матрицы.",
    en: "Here is only where the links are. The individual year reading is written for you from scratch: three thirds, twelve months, money, relationships and a plan — taking your personal matrix into account.",
  } satisfies Phrase,
};
