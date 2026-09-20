import type { Phrase, PhraseFn } from "./index";

export const enc = {
  title: {
    ru: "Энциклопедия матрицы судьбы: арканы, позиции, чакры",
    en: "Destiny matrix encyclopedia: arcana, positions, chakras",
  } satisfies Phrase,
  description: {
    ru: "Справочник по матрице судьбы: значения 22 арканов, 20 разделов отчёта, 17 позиций карты, "
      + "7 чакр и 231 сочетание арканов. Все страницы с перекрёстными ссылками.",
    en: "A reference on the destiny matrix: the meanings of 22 arcana, 20 sections of the reading, "
      + "17 positions of the chart, 7 chakras and 231 combinations. Every page is cross-linked.",
  } satisfies Phrase,
  sectionsName: { ru: "Разделы справочника", en: "Sections of the encyclopedia" } satisfies Phrase,
  articles: { ru: "Статьи", en: "Articles" } satisfies Phrase,
  articlesHint: {
    ru: (n: number) => `Разборы понятий целиком · ${n}`,
    en: (n: number) => `Whole concepts explained · ${n}`,
  } satisfies PhraseFn<[number]>,
  matrixCatalog: { ru: "Каталог матриц", en: "Matrix catalogue" } satisfies Phrase,
  matrixCatalogText: {
    ru: "Все карты по свёрнутым числам даты: день, месяц и год после свёртки дают три аркана, и "
      + "вариантов таких троек ровно 5 544.",
    en: "Every chart by the reduced numbers of a date: the day, month and year reduce to three "
      + "arcana, and there are exactly 5,544 such triples.",
  } satisfies Phrase,
  openCatalog: { ru: "Открыть каталог", en: "Open the catalogue" } satisfies Phrase,
  allArcana: { ru: "Все 22 аркана", en: "All 22 arcana" } satisfies Phrase,
  promoArcanaTitle: { ru: "Узнать свои арканы", en: "Find your own arcana" } satisfies Phrase,
  promoArcanaLead: {
    ru: "Карта по дате рождения строится бесплатно и без регистрации: после расчёта каждое число "
      + "становится ссылкой на своё значение.",
    en: "The chart is built from a date of birth for free and with no sign-up: after the "
      + "calculation every number becomes a link to its meaning.",
  } satisfies Phrase,
  promoPositionTitle: { ru: "Построить свою карту", en: "Build your own chart" } satisfies Phrase,
  promoPositionLead: {
    ru: "Карта по дате рождения строится бесплатно: после расчёта каждая точка станет ссылкой на "
      + "свою позицию с уже подставленным арканом.",
    en: "The chart is built from a date of birth for free: after the calculation every point "
      + "becomes a link to its position with the arcanum already filled in.",
  } satisfies Phrase,
  sevenLevels: { ru: "Семь уровней", en: "Seven levels" } satisfies Phrase,
  promoChakraTitle: { ru: "Построить свою карту энергий", en: "Build your own energy map" } satisfies Phrase,
  promoChakraLead: {
    ru: "Чакровая таблица считается вместе с картой по дате рождения — бесплатно и без регистрации.",
    en: "The chakra table is calculated together with the chart from a date of birth — free and "
      + "with no sign-up.",
  } satisfies Phrase,
  allCombinations: { ru: "Все сочетания", en: "All combinations" } satisfies Phrase,
  combinationsLead: {
    ru: "Выберите свой аркан отношений в строке и аркан партнёра в столбце — порядок значения не имеет.",
    en: "Pick your own relationship arcanum in the row and your partner's in the column — the order does not matter.",
  } satisfies Phrase,
  promoCombinationTitle: { ru: "Узнать свой аркан отношений", en: "Find your relationship arcanum" } satisfies Phrase,
  promoCombinationLead: {
    ru: "Карта по дате рождения строится бесплатно. Пара складывается из арканов отношений двоих, "
      + "поэтому нужны две даты.",
    en: "The chart is built from a date of birth for free. A pair is made of two relationship "
      + "arcana, so two dates are needed.",
  } satisfies Phrase,
  tailsAnalysed: { ru: "Разобранные тройки", en: "Triples with a reading" } satisfies Phrase,
  tailsOne: { ru: "Пока одна тройка", en: "One triple so far" } satisfies Phrase,
  tailsMany: {
    ru: (n: number) => `${n} троек с разбором`,
    en: (n: number) => `${n} triples with a reading`,
  } satisfies PhraseFn<[number]>,
  promoTailTitle: { ru: "Построить свою карту", en: "Build your own chart" } satisfies Phrase,
  promoTailLead: {
    ru: "Карта по дате рождения строится бесплатно и без регистрации. Свою тройку с толкованием "
      + "открывает полный разбор.",
    en: "The chart is built from a date of birth for free and with no sign-up. Your own triple "
      + "with its reading comes with the full reading.",
  } satisfies Phrase,
  tailArcana: { ru: "Арканы тройки", en: "Arcana of the triple" } satisfies Phrase,
  tailArcanaHint: {
    ru: "22 значения, из которых складывается любой хвост",
    en: "The 22 meanings any tail is made of",
  } satisfies Phrase,
  buildYourChart: { ru: "Построить свою карту", en: "Build your own chart" } satisfies Phrase,
  tailBuildText: {
    ru: "Хвост — одна из позиций октаграммы. Сама карта по дате рождения строится бесплатно, а "
      + "тройка с разбором входит в раздел «Задачи прошлых воплощений» —",
    en: "The tail is one of the positions of the octagram. The chart itself is built from a date "
      + "of birth for free, and the triple with its reading is part of the “Tasks of past lives” section —",
  } satisfies Phrase,
};

export const encArcanum = {
  positionsHint: {
    ru: "Один и тот же аркан в разных позициях говорит о разном.",
    en: "The same arcanum says different things in different positions.",
  } satisfies Phrase,
  allPositionsLink: { ru: "Все позиции карты", en: "Every position of the chart" } satisfies Phrase,
  combosHint: {
    ru: "21 пара: аркан рядом с каждым из остальных",
    en: "21 pairs: this arcanum next to each of the others",
  } satisfies Phrase,
  and: { ru: "и", en: "and" } satisfies Phrase,
  crossingsTitle: {
    ru: "Этот аркан на конкретных позициях",
    en: "This arcanum in particular positions",
  } satisfies Phrase,
  crossingsHint: {
    ru: (n: number) => `${n} разбора: то же число в разных ролях карты`,
    en: (n: number) => `${n} readings: the same number in different roles of the chart`,
  } satisfies PhraseFn<[number]>,
  tailsTitle: {
    ru: "Кармические хвосты с этим арканом",
    en: "Karmic tails with this arcanum",
  } satisfies Phrase,
  tailsHint: {
    ru: (n: number) => `Тройки нижнего угла карты, куда входит ${n} аркан`,
    en: (n: number) => `Triples of the lower corner of the chart that include arcanum ${n}`,
  } satisfies PhraseFn<[number]>,
  allTails: { ru: "Все хвосты", en: "All the tails" } satisfies Phrase,
  h1: {
    ru: (n: number, title: string) => `${n} в матрице судьбы: ${title}`,
    en: (n: number, title: string) => `${n} in the destiny matrix: ${title}`,
  } satisfies PhraseFn<[number, string]>,
  strengthAndShadow: {
    ru: "Сильная сторона и изнанка аркана",
    en: "The strength and the shadow of the arcanum",
  } satisfies Phrase,
  strength: { ru: "Сильная сторона", en: "Strength" } satisfies Phrase,
  strengthHint: { ru: "Что этот аркан даёт", en: "What this arcanum gives" } satisfies Phrase,
  shadow: { ru: "Изнанка", en: "Shadow" } satisfies Phrase,
  shadowHint: {
    ru: "Как тот же аркан работает против",
    en: "How the same arcanum works against you",
  } satisfies Phrase,
  tabMeaning: { ru: "Значение", en: "Meaning" } satisfies Phrase,
  tabCombos: { ru: "Сочетания с другими арканами", en: "Combinations with other arcana" } satisfies Phrase,
  tabWhere: { ru: "Позиции и хвосты", en: "Positions and tails" } satisfies Phrase,
  relatedTitle: {
    ru: "Где ещё разбирается этот аркан",
    en: "Where else this arcanum is discussed",
  } satisfies Phrase,
  relatedHint: {
    ru: "Статьи, которые ссылаются на эту страницу",
    en: "Articles that link to this page",
  } satisfies Phrase,
  whereInYourChart: { ru: "Где этот аркан в вашей карте", en: "Where this arcanum sits in your chart" } satisfies Phrase,
  whereInYourChartText: {
    ru: (n: number, title: string) => `Аркан ${n} (${title}) может стоять в центре, в линии рода `
      + "или в денежном канале — от позиции зависит всё. Постройте свою октаграмму: расчёт "
      + "бесплатный и идёт в браузере.",
    en: (n: number, title: string) => `Arcanum ${n} (${title}) can stand in the centre, in the `
      + "family line or in the money channel — the position changes everything. Build your own "
      + "octagram: the calculation is free and runs in the browser.",
  } satisfies PhraseFn<[number, string]>,
  fullReadingAll: { ru: "Полный разбор всех 20 разделов —", en: "The full reading of all 20 sections —" } satisfies Phrase,
};

export const encChakra = {
  h1: {
    ru: (title: string, index: number) => `Чакра ${title} в матрице судьбы — уровень ${index}`,
    en: (title: string, index: number) => `The ${title} chakra in the destiny matrix — level ${index}`,
  } satisfies PhraseFn<[string, number]>,
  caption: {
    ru: (spots: string) => `Где этот уровень стоит в карте: ${spots}`,
    en: (spots: string) => `Where this level sits in the chart: ${spots}`,
  } satisfies PhraseFn<[string]>,
  howCounted: { ru: "Как считается уровень", en: "How the level is calculated" } satisfies Phrase,
  howCountedText: {
    ru: (title: string, physics: string, energy: string) => `В карте энергий уровень ${title} `
      + `использует классическую пару точек ${physics} и ${energy}. Первое число записывается в `
      + "колонку физики, второе — энергии, эмоции равны их редуцированной сумме. Искусственного "
      + "смещения по номеру строки в методике нет.",
    en: (title: string, physics: string, energy: string) => `In the energy map the ${title} level `
      + `uses the classic pair of points ${physics} and ${energy}. The first number goes into the `
      + "physics column, the second into energy, and emotions are their reduced sum. The method "
      + "has no artificial shift by row number.",
  } satisfies PhraseFn<[string, string, string]>,
  totalsText: {
    ru: "Итог колонки — тоже аркан: он собирает семь уровней в одно число.",
    en: "The total of a column is an arcanum too: it gathers the seven levels into one number.",
  } satisfies Phrase,
  sectionChakras: { ru: "Раздел «Карта энергий по чакрам»", en: "The “Chakra energy map” section" } satisfies Phrase,
  showsWholeTable: {
    ru: "показывает всю таблицу целиком, а",
    en: "shows the whole table, and",
  } satisfies Phrase,
  sectionBody: { ru: "«Ресурс тела и восстановление»", en: "“Body resource and recovery”" } satisfies Phrase,
  coversLowest: { ru: "разбирает нижний уровень.", en: "covers the lowest level." } satisfies Phrase,
  threeColumns: { ru: "Три колонки уровня", en: "The three columns of the level" } satisfies Phrase,
  threeColumnsHint: {
    ru: "Материя, энергия и чувства на этом уровне",
    en: "Matter, energy and feelings at this level",
  } satisfies Phrase,
  promoTitle: { ru: "Посмотреть свой уровень", en: "See your own level" } satisfies Phrase,
  promoLead: {
    ru: (title: string) => `Какой аркан стоит у вас на уровне «${title}» — видно сразу после `
      + "расчёта. Бесплатно, без регистрации.",
    en: (title: string) => `Which arcanum stands at your “${title}” level is visible right after `
      + "the calculation. Free, with no sign-up.",
  } satisfies PhraseFn<[string]>,
  otherLevels: { ru: "Остальные уровни", en: "The other levels" } satisfies Phrase,
  otherLevelsHint: {
    ru: "Шесть остальных уровней, сверху вниз",
    en: "The other six levels, from the top down",
  } satisfies Phrase,
  whichArcanum: {
    ru: "Какой аркан стоит на этом уровне",
    en: "Which arcanum stands on this level",
  } satisfies Phrase,
  whichArcanumHint: {
    ru: "22 значения — откройте своё после расчёта",
    en: "22 meanings — open yours after the calculation",
  } satisfies Phrase,
  buildEnergyMap: { ru: "Построить свою карту энергий", en: "Build your own energy map" } satisfies Phrase,
  buildEnergyMapText: {
    ru: "Таблица чакр считается вместе с октаграммой по дате рождения. Расчёт бесплатный и идёт в браузере.",
    en: "The chakra table is calculated together with the octagram from a date of birth. The calculation is free and runs in the browser.",
  } satisfies Phrase,
  fullMapOpen: {
    ru: "Полная расшифровка карты энергий тоже открыта — она входит в разбор.",
    en: "The full reading of the energy map is open as well — it is part of the reading.",
  } satisfies Phrase,
  fullMapPaid: {
    ru: "Полная расшифровка карты энергий входит в разбор за",
    en: "The full reading of the energy map comes with the reading for",
  } satisfies Phrase,
};

export const encCombination = {
  pairInYourChart: {
    ru: "Есть ли эта пара в вашей карте",
    en: "Is this pair in your chart",
  } satisfies Phrase,

  pairCrumb: {
    ru: (a: number, b: number) => `${a} и ${b}`,
    en: (a: number, b: number) => `${a} and ${b}`,
  } satisfies PhraseFn<[number, number]>,
  keywords: {
    ru: (a: number, b: number) => [`${a} и ${b} в матрице судьбы`, `сочетание ${a} и ${b} аркана`],
    en: (a: number, b: number) => [`${a} and ${b} in the destiny matrix`, `combination of arcana ${a} and ${b}`],
  } satisfies Record<"ru" | "en", (a: number, b: number) => string[]>,
  cardPair: {
    ru: (a: number, x: string, b: number, y: string) => `${a} · ${x} и ${b} · ${y}`,
    en: (a: number, x: string, b: number, y: string) => `${a} · ${x} and ${b} · ${y}`,
  } satisfies PhraseFn<[number, string, number, string]>,
  h1: {
    ru: (a: number, b: number, title: string) => `${a} и ${b}: ${title}`,
    en: (a: number, b: number, title: string) => `${a} and ${b}: ${title}`,
  } satisfies PhraseFn<[number, number, string]>,
  givesAndStumbles: {
    ru: "Что даёт пара и где спотыкается",
    en: "What the pair gives and where it stumbles",
  } satisfies Phrase,
  gives: { ru: "Что даёт пара", en: "What the pair gives" } satisfies Phrase,
  givesHint: { ru: "Сильные стороны обоих арканов", en: "The strengths of both arcana" } satisfies Phrase,
  stumbles: { ru: "Где спотыкается", en: "Where it stumbles" } satisfies Phrase,
  stumblesHint: {
    ru: "Тени, которые усиливают друг друга",
    en: "The shadows that reinforce each other",
  } satisfies Phrase,
  groupTitle: {
    ru: (group: string, a: number, b: number) => `${group}: ${a} и ${b}`,
    en: (group: string, a: number, b: number) => `${group}: ${a} and ${b}`,
  } satisfies PhraseFn<[string, number, number]>,
  variantOrder: {
    ru: (order: string) => `Порядок точек ${order}`,
    en: (order: string) => `Order of the points: ${order}`,
  } satisfies PhraseFn<[string]>,
  howToCheck: {
    ru: "Как проверить сочетание на практике",
    en: "How to check the combination in practice",
  } satisfies Phrase,
  howToCheckHint: {
    ru: "Сначала позиции, затем реальная ситуация",
    en: "First the positions, then a real situation",
  } satisfies Phrase,
  neighbours: { ru: "Соседние сочетания", en: "Neighbouring combinations" } satisfies Phrase,
  neighboursHint: {
    ru: "Пары, которые стоят рядом в таблице",
    en: "Pairs that stand next to this one in the table",
  } satisfies Phrase,
  fullReading: { ru: "Полный разбор —", en: "The full reading —" } satisfies Phrase,
  allCombosOf: {
    ru: (n: number) => `Все сочетания ${n} аркана`,
    en: (n: number) => `Every combination of arcanum ${n}`,
  } satisfies PhraseFn<[number]>,
  calcLead: {
    ru: "Сочетание работает по-разному в зависимости от позиций: в центре, в линии рода или в "
      + "денежном канале. Постройте октаграмму по своей дате — расчёт бесплатный, дата остаётся в браузере.",
    en: "A combination works differently depending on the positions: in the centre, in the family "
      + "line or in the money channel. Build the octagram from your own date — the calculation is "
      + "free and the date stays in the browser.",
  } satisfies Phrase,
};

export const encPosition = {
  personalExampleLead: {
    ru: (code: string) => `Общая статья объясняет порядок и границы метода. Рассчитанный хвост `
      + `${code} показывает, как эти правила читаются на одном результате.`,
    en: (code: string) => `The general article explains the order and the limits of the method. `
      + `The calculated tail ${code} shows how those rules read on one result.`,
  } satisfies PhraseFn<[string]>,
  whereOnePoint: {
    ru: (spot: string) => `Где стоит эта точка: ${spot}`,
    en: (spot: string) => `Where this point sits: ${spot}`,
  } satisfies PhraseFn<[string]>,
  whereSeveralPoints: {
    ru: (spots: string) => `Где стоят точки раздела: ${spots}`,
    en: (spots: string) => `Where the points of the section sit: ${spots}`,
  } satisfies PhraseFn<[string]>,
  howCounted: { ru: "Как считается", en: "How it is calculated" } satisfies Phrase,
  howCountedHint: { ru: "Формула позиции в методике", en: "The formula of the position in the method" } satisfies Phrase,
  sectionInReport: { ru: "Раздел в отчёте", en: "The section in the reading" } satisfies Phrase,
  openFree: { ru: "открыт бесплатно, без регистрации.", en: "is open for free, with no sign-up." } satisfies Phrase,
  opensInFull: { ru: "открывается в полном разборе за", en: "opens with the full reading for" } satisfies Phrase,
  seeYourReport: { ru: "Посмотреть свой отчёт", en: "See your own reading" } satisfies Phrase,
  moreAboutCharacter: {
    ru: "Подробнее о полном разделе «Характер и личные качества» →",
    en: "More about the full “Character and personal qualities” section →",
  } satisfies Phrase,
  personalExampleTitle: {
    ru: "Пример полного персонального разбора",
    en: "An example of a full personal reading",
  } satisfies Phrase,
  characterExampleHint: {
    ru: "Тройка 4–3–22: три роли, три связи и общий вывод",
    en: "The 4–3–22 triple: three roles, three links and one conclusion",
  } satisfies Phrase,
  characterExampleText: {
    ru: "В статье выше показан метод. На персональной странице видно, как те же правила собирают "
      + "отдельные значения Императора, Императрицы и Шута в один связный текст.",
    en: "The article above shows the method. The personal page shows how the same rules gather the "
      + "separate meanings of the Emperor, the Empress and the Fool into one coherent text.",
  } satisfies Phrase,
  characterExampleLink: {
    ru: "Посмотреть разбор 4–3–22 в энциклопедии →",
    en: "See the 4–3–22 reading in the encyclopedia →",
  } satisfies Phrase,
  comfortExampleHint: {
    ru: "Тройка 4–15–7: центр, реакция и возвращающий талант",
    en: "The 4–15–7 triple: the centre, the reaction and the talent that comes back",
  } satisfies Phrase,
  comfortExampleText: {
    ru: "Общая статья объясняет точки E, M и K. В персональном разборе видно, как их отдельные "
      + "значения и три связи складываются в один внутренний цикл.",
    en: "The general article explains points E, M and K. The personal reading shows how their "
      + "separate meanings and three links add up to one inner cycle.",
  } satisfies Phrase,
  comfortExampleLink: {
    ru: "Посмотреть разбор 4–15–7 в энциклопедии →",
    en: "See the 4–15–7 reading in the encyclopedia →",
  } satisfies Phrase,
  professionExampleHint: {
    ru: "Линия 3–10–7: дар, форма работы и внутренний результат",
    en: "The 3–10–7 line: the gift, the shape of the work and the inner result",
  } satisfies Phrase,
  professionExampleText: {
    ru: "Общая статья объясняет порядок B→P→K. Персональная страница показывает, как значения "
      + "трёх арканов образуют связный сценарий профессиональной реализации.",
    en: "The general article explains the order B→P→K. The personal page shows how the meanings of "
      + "the three arcana make one coherent scenario of professional realisation.",
  } satisfies Phrase,
  professionExampleLink: {
    ru: "Посмотреть разбор 3–10–7 в энциклопедии →",
    en: "See the 3–10–7 reading in the encyclopedia →",
  } satisfies Phrase,
  chakraExampleHint: {
    ru: "Карта энергий для контрольной матрицы 4–3–22",
    en: "The energy map for the reference matrix 4–3–22",
  } satisfies Phrase,
  yearsExampleHint: {
    ru: "Возрастная линия для контрольной матрицы 4–3–22",
    en: "The age line for the reference matrix 4–3–22",
  } satisfies Phrase,
  calculatedResult: {
    ru: (code: string) => `Рассчитанный результат ${code}`,
    en: (code: string) => `The calculated result ${code}`,
  } satisfies PhraseFn<[string]>,
  personalExampleLink: {
    ru: "Посмотреть персональный пример в энциклопедии →",
    en: "See the personal example in the encyclopedia →",
  } satisfies Phrase,
  howToRead: { ru: "Как читать позицию", en: "How to read the position" } satisfies Phrase,
  howToReadHint: {
    ru: "Порядок, в котором смотрят на арканы",
    en: "The order in which the arcana are read",
  } satisfies Phrase,
  promoFreeLead: {
    ru: (title: string) => `Что стоит у вас в позиции «${title}» — покажет расчёт по дате рождения. `
      + "Бесплатно, без регистрации.",
    en: (title: string) => `What stands in your “${title}” position is shown by a calculation from `
      + "your date of birth. Free, with no sign-up.",
  } satisfies PhraseFn<[string]>,
  promoPaidLead: {
    ru: (title: string) => `Карта по дате рождения строится бесплатно и без регистрации. Позицию `
      + `«${title}» открывает полный разбор.`,
    en: (title: string) => `The chart is built from a date of birth for free and with no sign-up. `
      + `The “${title}” position comes with the full reading.`,
  } satisfies PhraseFn<[string]>,
  crossingsTitle: { ru: "Отдельные арканы на этой позиции", en: "Individual arcana in this position" } satisfies Phrase,
  crossingsHint: {
    ru: (n: number) => `${n} разбора: что означает конкретный аркан именно здесь`,
    en: (n: number) => `${n} readings: what one particular arcanum means right here`,
  } satisfies PhraseFn<[number]>,
  levelsTitle: { ru: "Уровни карты по отдельности", en: "The levels of the map one by one" } satisfies Phrase,
  levelsHint: {
    ru: "Каждый уровень разобран своей статьёй",
    en: "Every level has an article of its own",
  } satisfies Phrase,
  sectionPositions: { ru: "Позиции этого раздела", en: "The positions of this section" } satisfies Phrase,
  sectionPositionsHint: {
    ru: "У каждой точки — своё значение аркана",
    en: "Every point has its own meaning of the arcanum",
  } satisfies Phrase,
  allArcanaHere: { ru: "Все 22 аркана в этой позиции", en: "All 22 arcana in this position" } satisfies Phrase,
  allArcanaHereHint: {
    ru: "Откройте аркан, который стоит у вас в этой точке карты",
    en: "Open the arcanum that stands at this point of your chart",
  } satisfies Phrase,
  arcanumNumber: {
    ru: (n: number) => `${n} аркан`,
    en: (n: number) => `arcanum ${n}`,
  } satisfies PhraseFn<[number]>,
  relatedTitle: { ru: "Где ещё разбирается эта позиция", en: "Where else this position is discussed" } satisfies Phrase,
  relatedHint: { ru: "Статьи, которые ссылаются на эту страницу", en: "Articles that link to this page" } satisfies Phrase,
  nearby: { ru: "Рядом в карте", en: "Nearby in the chart" } satisfies Phrase,
  otherSections: { ru: "Другие разделы разбора", en: "Other sections of the reading" } satisfies Phrase,
  otherPositions: { ru: "Другие позиции матрицы", en: "Other positions of the matrix" } satisfies Phrase,
  allSections: { ru: "Все разделы отчёта", en: "All sections of the reading" } satisfies Phrase,
  allPositions: { ru: "Все позиции карты", en: "All positions of the chart" } satisfies Phrase,
  seeInYourChart: {
    ru: "Посмотреть эту позицию в своей карте",
    en: "See this position in your own chart",
  } satisfies Phrase,
  // Сколько разделов открыто, здесь не называется намеренно: читателю страницы позиции это
  // ничего не даёт, а число живёт сразу в двух режимах и в каждом своё.
  seeInYourChartText: {
    ru: "Расчёт бесплатный и идёт в браузере: дата рождения не уходит на сервер. Разбор "
      + "открывается сразу после расчёта.",
    en: "The calculation is free and runs in the browser: the date of birth never goes to the "
      + "server. The reading opens right after the calculation.",
  } satisfies Phrase,
};

export const encLinks = {
  moreCharacter: {
    ru: (key: string) => `Подробнее про характер ${key} в энциклопедии →`,
    en: (key: string) => `More about the character ${key} in the encyclopedia →`,
  } satisfies PhraseFn<[string]>,
  moreComfort: {
    ru: (key: string) => `Подробнее про центр и внутренние точки ${key} в энциклопедии →`,
    en: (key: string) => `More about the centre and inner points ${key} in the encyclopedia →`,
  } satisfies PhraseFn<[string]>,
  moreProfession: {
    ru: (key: string) => `Подробнее про профессию и дело по душе ${key} в энциклопедии →`,
    en: (key: string) => `More about profession and work you love ${key} in the encyclopedia →`,
  } satisfies PhraseFn<[string]>,
  moreTail: {
    ru: (key: string) => `Подробнее про кармический хвост ${key} в энциклопедии →`,
    en: (key: string) => `More about the karmic tail ${key} in the encyclopedia →`,
  } satisfies PhraseFn<[string]>,
  moreYourSection: {
    ru: (title: string) => `Подробнее про ваш раздел «${title}» в энциклопедии →`,
    en: (title: string) => `More about your “${title}” section in the encyclopedia →`,
  } satisfies PhraseFn<[string]>,
  moreSection: {
    ru: (title: string) => `Подробнее про раздел «${title}» в энциклопедии →`,
    en: (title: string) => `More about the “${title}” section in the encyclopedia →`,
  } satisfies PhraseFn<[string]>,
  // страница «аркан N в позиции X»
  triplesWith: { ru: "Тройки с этим арканом", en: "Triples with this arcanum" } satisfies Phrase,
  triplesWithHint: {
    ru: (n: number, arcanum: number) => `${n} хвостов с разбором, где стоит аркан ${arcanum}`,
    en: (n: number, arcanum: number) => `${n} tails with a reading where arcanum ${arcanum} stands`,
  } satisfies PhraseFn<[number, number]>,
  promoCrossTitle: {
    ru: "Узнать свой аркан на этой позиции",
    en: "Find your own arcanum in this position",
  } satisfies Phrase,
  promoCrossLead: {
    ru: "Карта по дате рождения строится бесплатно и без регистрации: после расчёта видно, какой "
      + "аркан стоит у вас именно здесь.",
    en: "The chart is built from a date of birth for free and with no sign-up: after the "
      + "calculation you can see which arcanum stands right here for you.",
  } satisfies Phrase,
  nearby: { ru: "Рядом", en: "Nearby" } satisfies Phrase,
  nearbyHint: {
    ru: "Та же энергия в других ролях и сама позиция",
    en: "The same energy in other roles, and the position itself",
  } satisfies Phrase,
  comfortDescription: {
    ru: (triple: string) => `Персональный разбор внутренних точек ${triple}: базовое состояние E, `
      + "автоматическая реакция M, возвращающий талант K, связи и практический шаг.",
    en: (triple: string) => `A personal reading of the inner points ${triple}: the basic state E, `
      + "the automatic reaction M, the talent K that comes back, the links and a practical step.",
  } satisfies PhraseFn<[string]>,
  professionDescription: {
    ru: (triple: string) => `Персональный разбор линии таланта ${triple}: исходный дар B, форма `
      + "работы P, внутренний результат K, связи и практический шаг.",
    en: (triple: string) => `A personal reading of the talent line ${triple}: the original gift B, `
      + "the shape of the work P, the inner result K, the links and a practical step.",
  } satisfies PhraseFn<[string]>,
  // экран оплаты
  payTitle: { ru: "Оплата", en: "Payment" } satisfies Phrase,
  priceUnknownTitle: { ru: "Цена уточняется", en: "The price is being updated" } satisfies Phrase,
  priceUnknownText: {
    ru: "Справочник цен сейчас недоступен, поэтому оплату открыть не можем. Обновите страницу "
      + "через минуту — расчёт карты работает и без этого.",
    en: "The price list is unavailable, so payment cannot be opened. Refresh the page in a minute "
      + "— the chart still works without it.",
  } satisfies Phrase,
  refresh: { ru: "Обновить", en: "Refresh" } satisfies Phrase,
};
