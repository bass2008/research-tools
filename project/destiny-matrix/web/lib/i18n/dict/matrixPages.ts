import type { Phrase, PhraseFn } from "./index";

export const matrixPages = {
  catalogTitle: {
    ru: "Все матрицы судьбы: 5544 карты по свёрнутым числам даты",
    en: "Every destiny matrix: 5544 charts by the reduced numbers of a date",
  } satisfies Phrase,
  catalogDescription: {
    ru: "Каталог матриц судьбы: 5544 карты по свёрнутым числам даты. На каждой — октаграмма, "
      + "позиции карты и два бесплатных раздела разбора.",
    en: "A catalogue of destiny matrices: 5544 charts by the reduced numbers of a date. Each one "
      + "has the octagram, the positions of the chart and two free sections of the reading.",
  } satisfies Phrase,
  catalogH1: { ru: "Все матрицы судьбы", en: "Every destiny matrix" } satisfies Phrase,
  catalogLead: {
    ru: (years: string, count: number) => `Матрица зависит не от даты, а от трёх свёрнутых чисел: `
      + `аркана дня (1–22), аркана месяца (1–12) и аркана года${years}. Поэтому все даты рождения `
      + `с 1900 года дают ${count} различных карт — каждая разобрана отдельной страницей. Свою карту удобнее получить`,
    en: (years: string, count: number) => `A matrix depends not on the date itself but on three `
      + `reduced numbers: the arcanum of the day (1–22), of the month (1–12) and of the year${years}. `
      + `That is why every date of birth since 1900 gives ${count} different charts — each with its own page. `
      + "The easiest way to get your own chart is",
  } satisfies PhraseFn<[string, number]>,
  catalogCalcLink: { ru: "расчётом по дате", en: "to calculate it by date" } satisfies Phrase,
  catalogCalcTail: {
    ru: ": он идёт в браузере, дата не уходит на сервер.",
    en: ": it runs in the browser and the date never goes to the server.",
  } satisfies Phrase,
  addressTitle: { ru: "Как устроен адрес", en: "How the address is built" } satisfies Phrase,
  addressHint: {
    ru: "Слаг матрицы — три числа через дефис",
    en: "A matrix slug is three numbers separated by hyphens",
  } satisfies Phrase,
  addressExample: {
    ru: "— день сведён к 14, месяц к 6, год к 7. Так читается матрица всех, кто родился 14 июня "
      + "года с суммой цифр 7 (например, 2005).",
    en: "— the day reduces to 14, the month to 6, the year to 7. This is the matrix of everyone "
      + "born on 14 June of a year whose digits add up to 7 (2005, for example).",
  } satisfies Phrase,
  allFreeSections: {
    ru: "Карта и все 20 разделов разбора на каждой странице открыты бесплатно.",
    en: "The chart and all 20 sections of the reading are free on every page.",
  } satisfies Phrase,
  paidTail: {
    ru: "Карта и два раздела на каждой странице открыты бесплатно, остальные 18 входят в полный разбор за",
    en: "The chart and two sections are free on every page; the other 18 come with the full reading for",
  } satisfies Phrase,
  entryByDay: { ru: "Вход по аркану дня", en: "Entry by the arcanum of the day" } satisfies Phrase,
  entryLead: {
    ru: (years: string) => `Внутри каждой страницы — ссылки на все 12 месяцев, все ${years} года `
      + "и все 22 аркана дня, поэтому от любой карты можно дойти до любой другой.",
    en: (years: string) => `Every page links to all 12 months, all ${years} of the year and all 22 `
      + "arcana of the day, so any chart leads to any other.",
  } satisfies PhraseFn<[string]>,
  yearArcanaCount: {
    ru: (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "аркан"
      : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "аркана" : "арканов"}`,
    en: (n: number) => `${n} ${n === 1 ? "arcanum" : "arcana"}`,
  } satisfies PhraseFn<[number]>,
  dayWord: { ru: "день", en: "day" } satisfies Phrase,
  dayArcanum: {
    ru: (day: number) => `Аркан дня ${day}`,
    en: (day: number) => `Arcanum ${day} of the day`,
  } satisfies PhraseFn<[number]>,
  catalogMissing: { ru: "Каталог ещё не собран", en: "The catalogue is not built yet" } satisfies Phrase,
  catalogMissingHint: {
    ru: "Нет content/matrices.json — список троек считает engine/precompute.py",
    en: "content/matrices.json is missing — engine/precompute.py builds the list of triples",
  } satisfies Phrase,
  catalogMissingText: {
    ru: "Расчёт по своей дате работает и без каталога: он идёт в браузере на том же движке.",
    en: "Calculating your own date works without the catalogue: it runs in the browser on the same engine.",
  } satisfies Phrase,
  whereNext: { ru: "Куда дальше", en: "Where to go next" } satisfies Phrase,
  whereNextHint: {
    ru: "Справочник, на который ссылается каждая позиция карты",
    en: "The encyclopedia every position of the chart links to",
  } satisfies Phrase,
  encyclopediaFull: { ru: "Энциклопедия матрицы судьбы", en: "Destiny matrix encyclopedia" } satisfies Phrase,
  linkCharacter: { ru: "Характер", en: "Character" } satisfies Phrase,
  linkMoney: { ru: "Деньги", en: "Money" } satisfies Phrase,
  linkRelations: { ru: "Отношения", en: "Relationships" } satisfies Phrase,
  linkCenter: { ru: "Центр карты", en: "Centre of the chart" } satisfies Phrase,
  findYours: { ru: "Найти свою матрицу", en: "Find your own matrix" } satisfies Phrase,
  findYoursText: {
    ru: "Вводить слаг руками не нужно: расчёт по дате рождения сам приведёт к нужной карте и "
      + "покажет карту и два раздела сразу.",
    en: "There is no need to type a slug: a calculation by date of birth leads to the right chart "
      + "and shows it with two sections at once.",
  } satisfies Phrase,
  calcFree: { ru: "Рассчитать матрицу бесплатно", en: "Calculate the matrix for free" } satisfies Phrase,
  calcMatrix: { ru: "Рассчитать матрицу", en: "Calculate the matrix" } satisfies Phrase,
  // страница одной матрицы
  pageTitle: {
    ru: (slug: string, center: number, title: string) => `Матрица ${slug}: центр ${center} «${title}»`,
    en: (slug: string, center: number, title: string) => `Matrix ${slug}: centre ${center} “${title}”`,
  } satisfies PhraseFn<[string, number, string]>,
  pageDescription: {
    ru: (slug: string, day: number, month: number, year: number, center: string, mission: string,
         money: number, love: number, dates: string) =>
      `Разбор карты ${slug} (день ${day}, месяц ${month}, год ${year}): центр ${center}, `
      + `кармическая задача ${mission}, денежный канал ${money}, линия отношений ${love}. `
      + `Два раздела бесплатно; такую карту дают ${dates} рождения.`,
    en: (slug: string, day: number, month: number, year: number, center: string, mission: string,
         money: number, love: number, dates: string) =>
      `The reading of chart ${slug} (day ${day}, month ${month}, year ${year}): centre ${center}, `
      + `karmic task ${mission}, money channel ${money}, relationship line ${love}. `
      + `Two sections are free; ${dates} of birth give this chart.`,
  } satisfies PhraseFn<[string, number, number, number, string, string, number, number, string]>,
  datesCount: {
    ru: (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "дата"
      : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "даты" : "дат"}`,
    en: (n: number) => `${n} ${n === 1 ? "date" : "dates"}`,
  } satisfies PhraseFn<[number]>,
  h1: {
    ru: (slug: string) => `Матрица судьбы ${slug}`,
    en: (slug: string) => `Destiny matrix ${slug}`,
  } satisfies PhraseFn<[string]>,
  centreCard: { ru: "центр", en: "centre" } satisfies Phrase,
  missionCard: { ru: "кармическая задача", en: "karmic task" } satisfies Phrase,
  slugLead: {
    ru: (day: number, month: number, monthName: string, year: number, center: string, mission: string) =>
      `Карта, в которой день сводится к аркану ${day}, месяц — к ${month} (${monthName}), а год — `
      + `к ${year}. Центр карты — ${center}, кармическая задача — ${mission}. Ниже все позиции карты `
      + "и два бесплатных раздела; чтобы посмотреть свою карту,",
    en: (day: number, month: number, monthName: string, year: number, center: string, mission: string) =>
      `A chart where the day reduces to arcanum ${day}, the month to ${month} (${monthName}) and the `
      + `year to ${year}. The centre of the chart is ${center}, the karmic task is ${mission}. Below are `
      + "all the positions of the chart and two free sections; to see your own chart,",
  } satisfies PhraseFn<[number, number, string, number, string, string]>,
  enterBirthDate: { ru: "введите дату рождения", en: "enter your date of birth" } satisfies Phrase,
  runsInBrowser: { ru: "— расчёт идёт в браузере.", en: "— the calculation runs in the browser." } satisfies Phrase,
  octagramTitle: { ru: "Октаграмма этой матрицы", en: "The octagram of this matrix" } satisfies Phrase,
  octagramHint: {
    ru: "Восемь внешних позиций, четыре точки комфорта и центр; по кругу — десятилетия",
    en: "Eight outer positions, four comfort points and the centre; the decades run around the circle",
  } satisfies Phrase,
  allPositionsHere: { ru: "Все позиции этой карты", en: "Every position of this chart" } satisfies Phrase,
  readingHere: { ru: "Разбор по этой матрице", en: "The reading of this matrix" } satisfies Phrase,
  allOpenFree: {
    ru: (n: number) => `Все ${n} разделов открыты без регистрации и оплаты.`,
    en: (n: number) => `All ${n} sections are open with no sign-up and no payment.`,
  } satisfies PhraseFn<[number]>,
  freeOpenPaidTail: {
    ru: (paid: number) => `Открыты без регистрации и оплаты. Остальные ${paid} разделов входят в полный разбор за`,
    en: (paid: number) => `Open with no sign-up and no payment. The other ${paid} sections come with the full reading for`,
  } satisfies PhraseFn<[number]>,
  moreInFull: { ru: "Что ещё есть в полном разборе", en: "What else the full reading has" } satisfies Phrase,
  moreInFullHint: {
    ru: (n: number) => `${n} разделов: род, деньги, отношения, программы и годы`,
    en: (n: number) => `${n} sections: family, money, relationships, programs and years`,
  } satisfies PhraseFn<[number]>,
  whichDates: {
    ru: "Какие даты рождения дают эту матрицу",
    en: "Which dates of birth give this matrix",
  } satisfies Phrase,
  whichDatesHint: {
    ru: (dates: string) => `${dates}: аркан дня повторяется каждые 22 числа, аркан года — у всех лет с той же суммой цифр`,
    en: (dates: string) => `${dates}: the arcanum of the day repeats every 22 days, the arcanum of the year is shared by every year with the same digit sum`,
  } satisfies PhraseFn<[string]>,
  andMore: {
    ru: (n: number) => `и ещё ${n}`,
    en: (n: number) => `and ${n} more`,
  } satisfies PhraseFn<[number]>,
  reducedSameMonth: {
    ru: (day: number, second: number, month: string) => `Методика работает со свёрнутыми числами, `
      + `поэтому ${day} и ${second} ${month} дают одну и ту же карту.`,
    en: (day: number, second: number, month: string) => `The method works with reduced numbers, so `
      + `${day} and ${second} ${month} give one and the same chart.`,
  } satisfies PhraseFn<[number, number, string]>,
  reducedSameYear: {
    ru: (day: number, month: string, year: number) => `Методика работает со свёрнутыми числами, `
      + `поэтому ${day} ${month} любого года, который сворачивается в ${year}, даёт одну и ту же карту.`,
    en: (day: number, month: string, year: number) => `The method works with reduced numbers, so `
      + `${day} ${month} of any year that reduces to ${year} gives one and the same chart.`,
  } satisfies PhraseFn<[number, string, number]>,
  neighbours: { ru: "Соседние матрицы", en: "Neighbouring matrices" } satisfies Phrase,
  sameDayMonth: {
    ru: "Тот же день и месяц, другой аркан года",
    en: "The same day and month, another arcanum of the year",
  } satisfies Phrase,
  sameDayYear: { ru: "Тот же день и год, другой месяц", en: "The same day and year, another month" } satisfies Phrase,
  sameMonthYear: { ru: "Тот же месяц и год, другой день", en: "The same month and year, another day" } satisfies Phrase,
  yoursMayDiffer: { ru: "Ваша матрица может быть другой", en: "Your matrix may be different" } satisfies Phrase,
  yoursMayDifferText: {
    ru: (slug: string) => `Эта страница собрана по тройке ${slug}. Свою карту постройте по дате `
      + "рождения: расчёт бесплатный и идёт в браузере — дата не уходит на сервер.",
    en: (slug: string) => `This page is built for the triple ${slug}. Build your own chart from your `
      + "date of birth: the calculation is free and runs in the browser — the date never goes to the server.",
  } satisfies PhraseFn<[string]>,
  chartAndAllOpen: {
    ru: "Карта и все разделы разбора открываются сразу.",
    en: "The chart and every section of the reading open at once.",
  } satisfies Phrase,
  chartAndTwoOpen: {
    ru: "Карта и два раздела открываются сразу, полный разбор —",
    en: "The chart and two sections open at once; the full reading costs",
  } satisfies Phrase,
  calcMine: { ru: "Рассчитать свою матрицу", en: "Calculate my own matrix" } satisfies Phrase,
  yearLabel: {
    ru: (year: number) => `год ${year}`,
    en: (year: number) => `year ${year}`,
  } satisfies PhraseFn<[number]>,
  dayLabelShort: {
    ru: (day: number) => `день ${day}`,
    en: (day: number) => `day ${day}`,
  } satisfies PhraseFn<[number]>,
  // подписи каналов
  lineMoney: { ru: "Деньги", en: "Money" } satisfies Phrase,
  lineMoneyHint: {
    ru: "Канал достатка: продолжение, условие и итог.",
    en: "The channel of abundance: what continues it, what it needs and what it ends with.",
  } satisfies Phrase,
  lineRelations: { ru: "Отношения", en: "Relationships" } satisfies Phrase,
  lineRelationsHint: {
    ru: "Линия близости от материнской ветви.",
    en: "The line of closeness coming from the mother's branch.",
  } satisfies Phrase,
  lineTalents: { ru: "Таланты", en: "Talents" } satisfies Phrase,
  lineTalentsHint: {
    ru: "Что дано, при каком условии раскрывается и что выходит.",
    en: "What is given, on what condition it opens and what comes out of it.",
  } satisfies Phrase,
  lineSkyGround: { ru: "Небо и земля", en: "Sky and earth" } satisfies Phrase,
  lineSkyGroundHint: {
    ru: "Духовная и материальная задачи.",
    en: "The spiritual task and the material one.",
  } satisfies Phrase,
  lineFamily: { ru: "Род", en: "Family line" } satisfies Phrase,
  lineFamilyHint: {
    ru: "Мужская и женская ветви и планетарное предназначение.",
    en: "The male and female branches and the planetary purpose.",
  } satisfies Phrase,
  lineTail: { ru: "Кармический хвост", en: "Karmic tail" } satisfies Phrase,
  lineTailHint: {
    ru: "То, что пришло с вами и повторяется.",
    en: "What came here with you and keeps repeating.",
  } satisfies Phrase,
};
