import type { Phrase, PhraseFn } from "./index";

export const report = {
  // карта и её панели
  exampleChart: { ru: "Пример карты", en: "Example chart" } satisfies Phrase,
  yourChart: { ru: "Ваша матрица", en: "Your matrix" } satisfies Phrase,
  exampleHint: {
    ru: "Выберите свою дату выше — карта пересчитается",
    en: "Pick your own date above and the chart will be recalculated",
  } satisfies Phrase,
  allPositionsOf: {
    ru: (date: string) => `${date} · все позиции карты`,
    en: (date: string) => `${date} · every position of the chart`,
  } satisfies PhraseFn<[string]>,
  selfSearch: { ru: "Поиск себя", en: "The search for yourself" } satisfies Phrase,
  selfSearchHint: {
    ru: "Линия неба и линия земли: духовная и материальная задачи.",
    en: "The sky line and the earth line: the spiritual task and the material one.",
  } satisfies Phrase,
  sky: { ru: "Небо", en: "Sky" } satisfies Phrase,
  ground: { ru: "Земля", en: "Earth" } satisfies Phrase,
  socialisation: { ru: "Социализация", en: "Socialisation" } satisfies Phrase,
  socialisationHint: {
    ru: "Родовые ветви: результат и признание в социуме.",
    en: "The family branches: results and recognition among people.",
  } satisfies Phrase,
  maleBranch: { ru: "М", en: "M" } satisfies Phrase,
  femaleBranch: { ru: "Ж", en: "F" } satisfies Phrase,
  spiritualPurpose: { ru: "Духовное предназначение", en: "Spiritual purpose" } satisfies Phrase,
  spiritualPurposeHint: {
    ru: "Состояние, из которого получается всё остальное.",
    en: "The state everything else grows out of.",
  } satisfies Phrase,
  planetaryPurpose: { ru: "Планетарное предназначение", en: "Planetary purpose" } satisfies Phrase,
  planetaryPurposeHint: {
    ru: "То, что выходит за рамки личной истории.",
    en: "What reaches beyond your personal story.",
  } satisfies Phrase,
  mainPoints: { ru: "Главные точки", en: "The main points" } satisfies Phrase,
  mainPointsHint: {
    ru: "Шесть позиций, которые задают всё остальное",
    en: "Six positions that set up everything else",
  } satisfies Phrase,
  allPositions: { ru: "Все позиции карты", en: "Every position of the chart" } satisfies Phrase,
  allPositionsHint: {
    ru: "Позиция · аркан · как читается",
    en: "Position · arcanum · how it reads",
  } satisfies Phrase,
  columnPosition: { ru: "Позиция", en: "Position" } satisfies Phrase,
  columnArcanum: { ru: "Аркан", en: "Arcanum" } satisfies Phrase,
  columnMeaning: { ru: "Значение", en: "Meaning" } satisfies Phrase,
  // главные точки: подпись и пояснение
  pointCenter: { ru: "Центр карты", en: "Centre of the chart" } satisfies Phrase,
  pointCenterHint: {
    ru: "Ядро карты: к нему сходятся все линии",
    en: "The core of the chart: every line meets here",
  } satisfies Phrase,
  pointPortrait: { ru: "Портрет личности", en: "Personality portrait" } satisfies Phrase,
  pointPortraitHint: {
    ru: "Внешняя точка A — аркан дня рождения",
    en: "Outer point A — the arcanum of the birth day",
  } satisfies Phrase,
  pointMaterial: { ru: "Материальная задача", en: "Material task" } satisfies Phrase,
  pointMaterialHint: {
    ru: "Внешняя точка C — свёртка года рождения",
    en: "Outer point C — the birth year reduced to one arcanum",
  } satisfies Phrase,
  pointKarmic: { ru: "Кармическая задача", en: "Karmic task" } satisfies Phrase,
  pointKarmicHint: {
    ru: "Внешняя точка D — сумма A, B и C",
    en: "Outer point D — the sum of A, B and C",
  } satisfies Phrase,
  pointMoney: { ru: "Вход денежной линии", en: "Entry of the money line" } satisfies Phrase,
  pointMoneyHint: {
    ru: "Точка L — начало канала L–R2–R",
    en: "Point L — the start of the L–R2–R channel",
  } satisfies Phrase,
  pointLove: { ru: "Вход линии отношений", en: "Entry of the relationship line" } satisfies Phrase,
  pointLoveHint: {
    ru: "Точка M — начало канала M–R1–R",
    en: "Point M — the start of the M–R1–R channel",
  } satisfies Phrase,
  // карта энергий
  chakraTitle: { ru: "Карта энергий по чакрам", en: "Chakra energy map" } satisfies Phrase,
  chakraHint: {
    ru: "Семь уровней в трёх колонках: материя, энергия и чувства",
    en: "Seven levels in three columns: matter, energy and feelings",
  } satisfies Phrase,
  chakraLevel: { ru: "Уровень", en: "Level" } satisfies Phrase,
  chakraTotal: { ru: "Итого", en: "Total" } satisfies Phrase,
  // разделы разбора
  readingTitle: { ru: "Расшифровка вашей матрицы", en: "The reading of your matrix" } satisfies Phrase,
  openSections: {
    ru: (open: number) => `${open} ${open % 10 === 1 && open % 100 !== 11 ? "раздел открыт"
      : [2, 3, 4].includes(open % 10) && ![12, 13, 14].includes(open % 100) ? "раздела открыто"
      : "разделов открыто"}`,
    en: (open: number) => `${open} ${open === 1 ? "section open" : "sections open"}`,
  } satisfies PhraseFn<[number]>,
  lockedCount: {
    ru: (locked: number) => `${locked} под замком`,
    en: (locked: number) => `${locked} locked`,
  } satisfies PhraseFn<[number]>,
  sameArcanum: {
    ru: (label: string) => `Тот же аркан, что и в позиции «${label}»: толкование выше.`,
    en: (label: string) => `The same arcanum as in “${label}”: the reading is above.`,
  } satisfies PhraseFn<[string]>,
  positionsInFull: {
    ru: (n: number) => `${n} позиций в полном разборе`,
    en: (n: number) => `${n} positions in the full reading`,
  } satisfies PhraseFn<[number]>,
  checkingAccess: { ru: "Проверяем доступ…", en: "Checking access…" } satisfies Phrase,
  notOpened: { ru: "Не открыт", en: "Not opened" } satisfies Phrase,
  unlock: { ru: "Открыть", en: "Unlock" } satisfies Phrase,
  // Витрина без кассы: разделы открыты всегда, и если раздел всё-таки пуст — это сбой загрузки,
  // а не запертая покупка. Предлагать «Открыть» там, где платить негде, значит вести человека
  // на страницу оплаты, которой нет.
  notLoaded: { ru: "Не загрузился", en: "Not loaded" } satisfies Phrase,
  pairSummary: { ru: "Как складывается пара", en: "How the pair works together" } satisfies Phrase,
  rolesSummary: {
    ru: "Как складываются роли раздела",
    en: "How the roles of the section work together",
  } satisfies Phrase,
  tripleSummary: { ru: "Как складывается тройка", en: "How the three work together" } satisfies Phrase,
  // кнопки сохранения
  saveMatrix: { ru: "Сохранить матрицу в кабинет", en: "Save the matrix to your account" } satisfies Phrase,
  savedToAccount: { ru: "Сохранено в кабинете", en: "Saved to your account" } satisfies Phrase,
  saving: { ru: "Сохраняем…", en: "Saving…" } satisfies Phrase,
  saveTitle: {
    ru: (date: string) => `Матрица на ${date}`,
    en: (date: string) => `Matrix for ${date}`,
  } satisfies PhraseFn<[string]>,
  limitTail: {
    ru: "Уже сохранённые даты остаются в кабинете.",
    en: "The dates you have already saved stay in your account.",
  } satisfies Phrase,
  needLogin: {
    ru: "Нужен вход: сохранить матрицу можно только в свой кабинет.",
    en: "You need to sign in: a matrix can only be saved to your own account.",
  } satisfies Phrase,
  saveFailed: {
    ru: "Не получилось сохранить матрицу.",
    en: "The matrix could not be saved.",
  } satisfies Phrase,
  savePdf: { ru: "Сохранить как PDF", en: "Save as PDF" } satisfies Phrase,
  pdfPreparing: { ru: "Готовим PDF", en: "Preparing the PDF" } satisfies Phrase,
  pdfOpen: { ru: "Открыть PDF", en: "Open the PDF" } satisfies Phrase,
  pdfDownload: { ru: "Скачать PDF", en: "Download the PDF" } satisfies Phrase,
  pdfTitle: {
    ru: (date: string) => `Скачать разбор за ${date}`,
    en: (date: string) => `Download the reading for ${date}`,
  } satisfies PhraseFn<[string]>,
  pdfAria: {
    ru: (date: string) => `Скачать PDF разбора за ${date}`,
    en: (date: string) => `Download the PDF of the reading for ${date}`,
  } satisfies PhraseFn<[string]>,
  pdfFailed: {
    ru: "Не получилось напечатать PDF. Попробуйте ещё раз.",
    en: "The PDF could not be printed. Please try again.",
  } satisfies Phrase,
};

export const reportSheet = {
  /** Как назван доступ в шапке отчёта, когда имени тарифа в базе нет. */
  planReading: { ru: "разбор", en: "a reading" } satisfies Phrase,
  planUnlimited: { ru: "без ограничений", en: "no limits" } satisfies Phrase,
  planSingle: { ru: "разовый разбор", en: "a single reading" } satisfies Phrase,
  planFree: { ru: "бесплатные разделы", en: "the free sections" } satisfies Phrase,
  ageRange: {
    ru: (from: number, to: number) => `${from}–${to} лет`,
    en: (from: number, to: number) => `${from}–${to} years`,
  } satisfies PhraseFn<[number, number]>,
  title: { ru: "Разбор матрицы судьбы", en: "Destiny matrix reading" } satisfies Phrase,
  planNamed: {
    ru: (plan: string) => `тариф «${plan}»`,
    en: (plan: string) => `plan “${plan}”`,
  } satisfies PhraseFn<[string]>,
  freeAccess: { ru: "бесплатный доступ", en: "free access" } satisfies Phrase,
  openOf: {
    ru: (open: number, total: number) => `открыто ${open} из ${total} разделов`,
    en: (open: number, total: number) => `${open} of ${total} sections open`,
  } satisfies PhraseFn<[number, number]>,
  moreInFull: {
    ru: (n: number) => `Ещё ${n} ${n % 10 === 1 && n % 100 !== 11 ? "раздел"
      : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "раздела" : "разделов"} в полном разборе`,
    en: (n: number) => `${n} more ${n === 1 ? "section" : "sections"} in the full reading`,
  } satisfies PhraseFn<[number]>,
  moreInFullText: {
    ru: "Сейчас открыты бесплатные разделы. Полный разбор добавляет остальные — одним платежом, без подписки.",
    en: "The free sections are open now. The full reading adds the rest — one payment, no subscription.",
  } satisfies Phrase,
  // итог разбора
  conclusionTitle: { ru: "Итог разбора", en: "The bottom line" } satisfies Phrase,
  mainStrength: { ru: "Главная сила", en: "Main strength" } satisfies Phrase,
  mainTension: { ru: "Главное напряжение", en: "Main tension" } satisfies Phrase,
  practicalStep: { ru: "Практический шаг", en: "Practical step" } satisfies Phrase,
  // кубики роли
  essence: { ru: "Суть.", en: "Essence." } satisfies Phrase,
  strength: { ru: "Сила.", en: "Strength." } satisfies Phrase,
  risk: { ru: "Риск.", en: "Risk." } satisfies Phrase,
  action: { ru: "Действие.", en: "Action." } satisfies Phrase,
  // ссылки раздела
  byYourMatrix: { ru: "По вашей матрице", en: "From your matrix" } satisfies Phrase,
  aboutMethod: { ru: "О методе", en: "About the method" } satisfies Phrase,
  howToRead: {
    ru: (title: string) => `Как читать раздел «${title}» →`,
    en: (title: string) => `How to read the “${title}” section →`,
  } satisfies PhraseFn<[string]>,
  // персональная статья раздела
  personalEyebrow: { ru: "Персональный раздел матрицы", en: "A personal section of the matrix" } satisfies Phrase,
  howSectionWorks: {
    ru: (title: string) => `Как устроен раздел «${title}»`,
    en: (title: string) => `How the “${title}” section works`,
  } satisfies PhraseFn<[string]>,
  personalExplainer: {
    ru: "Общая статья объясняет метод чтения раздела, а эта страница применяет его к вашему рассчитанному результату.",
    en: "The general article explains how the section is read; this page applies that to your own result.",
  } satisfies Phrase,
  openSectionArticle: { ru: "Открыть статью о разделе", en: "Open the article about the section" } satisfies Phrase,
  backToReport: { ru: "Вернуться к отчёту", en: "Back to the reading" } satisfies Phrase,
  otherDate: { ru: "Рассчитать другую дату", en: "Calculate another date" } satisfies Phrase,
  // длинный разбор
  combinationCaption: {
    ru: (slug: string) => `Как складывается сочетание ${slug}`,
    en: (slug: string) => `How the ${slug} combination works together`,
  } satisfies PhraseFn<[string]>,
  currentStage: { ru: " · текущий этап", en: " · current stage" } satisfies Phrase,
  nextStage: { ru: " · следующий этап", en: " · next stage" } satisfies Phrase,
  sameAsRole: {
    ru: (label: string) => `Тот же аркан, что и в роли «${label}»: разбор выше. Обе позиции `
      + "формулы дали одно число, поэтому второй раз тот же текст не повторяется.",
    en: (label: string) => `The same arcanum as in the “${label}” role: the reading is above. Both `
      + "positions of the formula produced one number, so the same text is not repeated.",
  } satisfies PhraseFn<[string]>,
  interactionRoles: {
    ru: (roles: string) => `Позиции ${roles}`,
    en: (roles: string) => `Positions ${roles}`,
  } satisfies PhraseFn<[string]>,
};
