import type { Phrase, PhraseFn } from "./index";

export const encTail = {
  arcanumNumber: {
    ru: (n: number) => `${n} аркан`,
    en: (n: number) => `arcanum ${n}`,
  } satisfies PhraseFn<[number]>,
  howCounted: { ru: "Как считается хвост", en: "How the tail is calculated" } satisfies Phrase,
  formulaHint: { ru: "Формула методики", en: "The formula of the method" } satisfies Phrase,
  formulaHead: {
    ru: "В классической схеме порядок фиксирован: M–N–D. Для этой формы это",
    en: "In the classic scheme the order is fixed: M–N–D. For this form it is",
  } satisfies Phrase,
  formulaTail: {
    ru: (birth: string) => `: M — нижняя внутренняя точка, N — свёртка D+M, D — корневая `
      + `кармическая задача. Пример даты, которая даёт этот хвост: ${birth}.`,
    en: (birth: string) => `: M is the lower inner point, N is the reduced sum of D and M, D is the `
      + `root karmic task. An example of a date that gives this tail: ${birth}.`,
  } satisfies PhraseFn<[string]>,
  notReachable: {
    ru: "Эта поисковая тройка не входит в 26 хвостов, достижимых по формуле M–N–D нашего "
      + "калькулятора. Она может относиться к программе в другой позиции или к другой школе; "
      + "обещать её появление в хвосте вашей карты было бы неверно.",
    en: "This triple is not among the 26 tails our calculator can produce with the M–N–D formula. "
      + "It may belong to a program in another position or to another school; promising that it "
      + "will appear in the tail of your chart would be wrong.",
  } satisfies Phrase,
  relatedHint: {
    ru: "Тройки и страницы, связанные с этим хвостом",
    en: "Triples and pages related to this tail",
  } satisfies Phrase,
  whereNext: { ru: "Куда дальше", en: "Where to go next" } satisfies Phrase,
  whereNextHint: {
    ru: "Арканы тройки и остальные хвосты",
    en: "The arcana of the triple and the other tails",
  } satisfies Phrase,
  allTails: { ru: "Все кармические хвосты", en: "All karmic tails" } satisfies Phrase,
  howPastLivesRead: {
    ru: "Как читается раздел «Задачи прошлых воплощений»",
    en: "How the “Tasks of past lives” section is read",
  } satisfies Phrase,
  findYourTail: {
    ru: "Найти свой хвост в своей карте",
    en: "Find your own tail in your own chart",
  } satisfies Phrase,
  tailInReading: {
    ru: "Тройка хвоста с разбором входит в раздел «Задачи прошлых воплощений» полного разбора —",
    en: "The tail triple with its reading is part of the “Tasks of past lives” section of the full reading —",
  } satisfies Phrase,
  octagramFree: {
    ru: "Октаграмма по дате рождения строится бесплатно и в браузере.",
    en: "The octagram is built from a date of birth for free, in the browser.",
  } satisfies Phrase,
  octagramFreeOther: {
    ru: "Октаграмма по дате рождения строится бесплатно и в браузере, но тройка в ней сложится "
      + "по формуле матрицы и с этой совпасть не обязана.",
    en: "The octagram is built from a date of birth for free, in the browser, but the triple in it "
      + "follows the formula of the matrix and does not have to match this one.",
  } satisfies Phrase,
};

export const encCharacter = {
  description: {
    ru: (triple: string) => `Персональный разбор характера для матрицы ${triple}: портрет личности, `
      + "духовная и материальная задачи, связи трёх арканов, сильная сторона и практический шаг.",
    en: (triple: string) => `A personal character reading for the matrix ${triple}: the personality `
      + "portrait, the spiritual and material tasks, the links between the three arcana, the "
      + "strength and a practical step.",
  } satisfies PhraseFn<[string]>,
  personalSection: {
    ru: (slug: string) => `Персональный раздел матрицы ${slug}`,
    en: (slug: string) => `A personal section of the matrix ${slug}`,
  } satisfies PhraseFn<[string]>,
  pointsTitle: { ru: "Что означают точки A, B и C", en: "What points A, B and C mean" } satisfies Phrase,
  pointsText: {
    ru: (slug: string) => `Общая статья объясняет метод чтения раздела, а эта страница применяет `
      + `его к вашей тройке ${slug}.`,
    en: (slug: string) => `The general article explains how the section is read; this page applies `
      + `that to your triple ${slug}.`,
  } satisfies PhraseFn<[string]>,
  backToMatrix: { ru: "Вернуться к матрице", en: "Back to the matrix" } satisfies Phrase,
  personalDescription: {
    ru: (title: string, subject: string) => `${title}: персональный связный разбор ${subject}, `
      + "ролей, переходов и практического шага.",
    en: (title: string, subject: string) => `${title}: a personal, connected reading of ${subject}, `
      + "the roles, the transitions and a practical step.",
  } satisfies PhraseFn<[string, string]>,
  subjectWithDate: {
    ru: (slug: string, date: string) => `результата ${slug} для даты ${date}`,
    en: (slug: string, date: string) => `the result ${slug} for the date ${date}`,
  } satisfies PhraseFn<[string, string]>,
  subjectPlain: {
    ru: (slug: string) => `рассчитанного результата ${slug}`,
    en: (slug: string) => `the calculated result ${slug}`,
  } satisfies PhraseFn<[string]>,
};

export const encYear = {
  /** Точка внешнего круга без своей подписи: в расчёте её быть не должно, но читатель обязан
   *  пережить и такую. */
  ringFallback: { ru: "точка внешнего круга", en: "a point of the outer ring" } satisfies Phrase,
  yearArcana: { ru: "Арканы на год", en: "Arcana for the year" } satisfies Phrase,
  yearForecast: { ru: "Прогноз по годам", en: "The forecast year by year" } satisfies Phrase,
  yearForecastHint: {
    ru: "Разбор конкретного года целиком",
    en: "A whole reading of one particular year",
  } satisfies Phrase,
  matrixForKey: {
    ru: (key: string) => `Матрица судьбы на ${key}`,
    en: (key: string) => `Destiny matrix for ${key}`,
  } satisfies PhraseFn<[string]>,
  decadeBackground: {
    ru: "Фон десятилетия под расчётом года",
    en: "The background of the decade under the year",
  } satisfies Phrase,
  decadeBackgroundHint: {
    ru: "Год читается внутри десятилетия, а не вместо него",
    en: "The year is read inside the decade, not instead of it",
  } satisfies Phrase,
  decadeBackgroundLead: {
    ru: "Расчёт на год отвечает на вопрос «что в фокусе сейчас», а возрастная шкала задаёт фон, "
      + "который держится десять лет.",
    en: "The reading for the year answers the question “what is in focus now”, while the age scale "
      + "sets a background that holds for ten years.",
  } satisfies Phrase,
  decadeBackgroundLink: {
    ru: "Разбор по десятилетиям до 80 лет",
    en: "The reading by decades up to the age of 80",
  } satisfies Phrase,
  decadeBackgroundTail: {
    ru: "объясняет, как читать их вместе.",
    en: "explains how to read them together.",
  } satisfies Phrase,
  outsideYearFrame: { ru: "Арканы вне рамки года", en: "Arcana outside the frame of the year" } satisfies Phrase,
  outsideYearFrameHint: {
    ru: "Базовое значение каждого числа в карте рождения",
    en: "The basic meaning of every number in the birth chart",
  } satisfies Phrase,
  buildYourChart: { ru: "Построить свою карту", en: "Build your own chart" } satisfies Phrase,
  buildBirthChart: {
    ru: "Построить свою карту рождения",
    en: "Build your own birth chart",
  } satisfies Phrase,
  yearOf: {
    ru: (key: string) => `${key} на год`,
    en: (key: string) => `${key} for the year`,
  } satisfies PhraseFn<[string]>,
  matrixForYear: {
    ru: (year: string) => `Матрица судьбы на ${year} год`,
    en: (year: string) => `Destiny matrix for ${year}`,
  } satisfies PhraseFn<[string]>,
  howToCount: { ru: "Как посчитать свой аркан года", en: "How to work out your arcanum of the year" } satisfies Phrase,
  howToCountHint: {
    ru: "Два разных числа, и их часто путают",
    en: "Two different numbers, and they are often confused",
  } satisfies Phrase,
  calendarArcanum: { ru: "Аркан календарного года", en: "The arcanum of the calendar year" } satisfies Phrase,
  calendarText: {
    ru: (year: number, digits: string, sum: number, extra: string, arcanum: number, title: string) =>
      ` один для всех: сложите цифры самого года и сверните сумму к числу от 1 до 22. Для ${year} `
      + `года это ${digits} = ${sum}${extra} — год проходит под арканом ${arcanum}, ${title}.`,
    en: (year: number, digits: string, sum: number, extra: string, arcanum: number, title: string) =>
      ` is the same for everyone: add up the digits of the year and reduce the sum to a number from `
      + `1 to 22. For ${year} that is ${digits} = ${sum}${extra} — the year runs under arcanum `
      + `${arcanum}, ${title}.`,
  } satisfies PhraseFn<[number, string, number, string, number, string]>,
  thatIs: {
    ru: (arcanum: number) => `, то есть ${arcanum}`,
    en: (arcanum: number) => `, that is ${arcanum}`,
  } satisfies PhraseFn<[number]>,
  personalArcanum: { ru: "Личный аркан десятилетия", en: "Your personal arcanum of the decade" } satisfies Phrase,
  personalText: {
    ru: " считается из вашей карты и у каждого свой. Внешний круг делится на восемь секторов по "
      + "десять лет, и каждый идёт под своей точкой: портрет личности, затем духовная мужская "
      + "линия рода, духовная задача и дальше по кругу.",
    en: " is calculated from your own chart and differs for everyone. The outer circle is divided "
      + "into eight sectors of ten years, and each runs under its own point: the personality "
      + "portrait, then the spiritual male family line, the spiritual task and on around the circle.",
  } satisfies Phrase,
  exampleText: {
    ru: (birth: string, age: string, from: number, to: number, label: string) =>
      ` Человек, родившийся ${birth}, сейчас в ${age} проживает сектор ${from}–${to} лет: у него `
      + `там стоит ${label}.`,
    en: (birth: string, age: string, from: number, to: number, label: string) =>
      ` Someone born on ${birth} is now ${age} old and is living through the ${from}–${to} sector: `
      + `there they have ${label}.`,
  } satisfies PhraseFn<[string, string, number, number, string]>,
  yearsCount: {
    ru: (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "год"
      : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "года" : "лет"}`,
    en: (n: number) => `${n} ${n === 1 ? "year" : "years"}`,
  } satisfies PhraseFn<[number]>,
  sectorNote: {
    ru: "Свой сектор видно в расчёте — возрастная шкала идёт по кругу карты по часовой стрелке. "
      + "Календарный аркан и личный совпадают редко, и путать их не стоит: первый описывает год "
      + "для всех, второй — только ваше десятилетие.",
    en: "Your own sector is visible in the calculation — the age scale runs clockwise around the "
      + "chart. The calendar arcanum and the personal one rarely coincide, and they should not be "
      + "confused: the first describes the year for everyone, the second only your decade.",
  } satisfies Phrase,
  promoLead: {
    ru: "Карта рождения строится по дате бесплатно и без регистрации — с неё и читают годовую рамку.",
    en: "The birth chart is built from a date for free and with no sign-up — the frame of the year is read from it.",
  } satisfies Phrase,
  allArcanaInYear: { ru: "22 аркана в рамке года", en: "22 arcana in the frame of the year" } satisfies Phrase,
  allArcanaInYearHint: {
    ru: "Что означает каждое число, когда оно выпало на год",
    en: "What each number means when it falls on a year",
  } satisfies Phrase,
  sameArcanumInChart: { ru: "Тот же аркан в карте", en: "The same arcanum in the chart" } satisfies Phrase,
  sameArcanumHint: {
    ru: "Значение вне рамки года — в характере, деньгах и отношениях",
    en: "Its meaning outside the year: in character, money and relationships",
  } satisfies Phrase,
  inMatrix: {
    ru: (n: number, title: string) => `${n} в матрице судьбы: ${title}`,
    en: (n: number, title: string) => `${n} in the destiny matrix: ${title}`,
  } satisfies PhraseFn<[number, string]>,
  otherYearArcana: { ru: "Другие арканы года", en: "Other arcana of the year" } satisfies Phrase,
  otherYearArcanaHint: {
    ru: "Как читается каждое число в рамке года",
    en: "How each number reads in the frame of the year",
  } satisfies Phrase,
  allYearArcana: { ru: "Все арканы на год", en: "All arcana for the year" } satisfies Phrase,
  fullReadingAll: {
    ru: "полный разбор всех 20 разделов карты —",
    en: "the full reading of all 20 sections of the chart —",
  } satisfies Phrase,
  yearFrameLead: {
    ru: "Годовая рамка читается по карте рождения — начните с расчёта по дате. Он бесплатный;",
    en: "The frame of the year is read from the birth chart — start with a calculation by date. It is free;",
  } satisfies Phrase,
  yearFrameLeadKey: {
    ru: "Годовую рамку читают поверх карты рождения, а её расчёт бесплатный и идёт в браузере.",
    en: "The frame of the year is read on top of the birth chart, and that calculation is free and runs in the browser.",
  } satisfies Phrase,
};
