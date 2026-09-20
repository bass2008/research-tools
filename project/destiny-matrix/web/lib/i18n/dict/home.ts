import type { Phrase, PhraseFn } from "./index";

export const home = {
  // первый экран
  heroBuy: { ru: "Купить полный разбор — ", en: "Buy the full reading — " } satisfies Phrase,
  heroFree: { ru: "Рассчитать полный разбор бесплатно", en: "Get the full reading for free" } satisfies Phrase,
  heroToReport: { ru: "Перейти к полному разбору", en: "Go to the full reading" } satisfies Phrase,
  showSlide: {
    ru: (heading: string) => `Показать: ${heading}`,
    en: (heading: string) => `Show: ${heading}`,
  } satisfies PhraseFn<[string]>,
  prevSlide: { ru: "Предыдущее", en: "Previous" } satisfies Phrase,
  nextSlide: { ru: "Следующее", en: "Next" } satisfies Phrase,
  // промо-блок справочника
  promoTitle: { ru: "Постройте свою матрицу", en: "Build your own matrix" } satisfies Phrase,
  // витрина
  priceWhat: {
    ru: (period: string) => `полный разбор, все 20 разделов, ${period}`,
    en: (period: string) => `the full reading, all 20 sections, ${period}`,
  } satisfies PhraseFn<[string]>,
  priceUnknown: {
    ru: "Цена уточняется — справочник сейчас недоступен. Расчёт карты работает и без него.",
    en: "The price is being updated — the price list is unavailable. The chart still works without it.",
  } satisfies Phrase,
  freeAllSections: {
    ru: "полный разбор, все 20 разделов",
    en: "the full reading, all 20 sections",
  } satisfies Phrase,
  freeNote: {
    ru: "карта и 2 раздела — бесплатно, без регистрации",
    en: "the chart and 2 sections — free, no sign-up",
  } satisfies Phrase,
  freeNoteAll: {
    ru: "карта и все разделы — без регистрации",
    en: "the chart and every section — no sign-up",
  } satisfies Phrase,
  chipSections: { ru: "20 разделов отчёта", en: "20 sections of the reading" } satisfies Phrase,
  chipChakras: { ru: "Карта энергий по чакрам", en: "Chakra energy map" } satisfies Phrase,
  chipDecades: { ru: "Разбор по десятилетиям до 80 лет", en: "Reading by decades up to 80" } satisfies Phrase,
  chipOnePayment: { ru: "Один платёж, без списаний", en: "One payment, no recurring charges" } satisfies Phrase,
  chipNoPayment: { ru: "Без оплаты и регистрации", en: "No payment, no sign-up" } satisfies Phrase,
  plansLink: { ru: "Что входит", en: "What is included" } satisfies Phrase,
  tariffsLine: {
    ru: (list: string) => `Тарифы: ${list}. `,
    en: (list: string) => `Plans: ${list}. `,
  } satisfies PhraseFn<[string]>,
  // блок «что вы держите в руках»
  pillarsEyebrow: { ru: "Что вы держите в руках", en: "What you are holding" } satisfies Phrase,
  pillarsTitle: {
    ru: "Опоры персональной модели личности",
    en: "The pillars of a personal model of personality",
  } satisfies Phrase,
  pillarCenter: { ru: "Центр карты", en: "Centre of the chart" } satisfies Phrase,
  pillarCenterText: {
    ru: "Ядро матрицы: центральное число, к которому сходятся все линии. С него начинают читать карту и к нему возвращаются в конце.",
    en: "The core of the matrix: the central number where every line meets. The reading starts here and comes back here at the end.",
  } satisfies Phrase,
  pillarPortrait: { ru: "Портрет личности", en: "Personality portrait" } satisfies Phrase,
  pillarPortraitText: {
    ru: "Как вас считывают люди в первые минуты и какую роль вы занимаете в группе — часто не ту, которую выбрали бы сами.",
    en: "How people read you in the first minutes and which role you take in a group — often not the one you would choose.",
  } satisfies Phrase,
  pillarMotivation: { ru: "Внутренняя мотивация", en: "Inner motivation" } satisfies Phrase,
  pillarMotivationText: {
    ru: "Глубинные причины решений: что вами двигает, когда вы устали и уже не притворяетесь.",
    en: "The deeper reasons behind decisions: what moves you when you are tired and no longer pretending.",
  } satisfies Phrase,
  pillarResources: { ru: "Системные ресурсы", en: "Systemic resources" } satisfies Phrase,
  pillarResourcesText: {
    ru: "Родовая поддержка и накопленный опыт: на что можно опереться, даже если сейчас так не кажется.",
    en: "Family support and accumulated experience: what you can lean on, even when it does not feel that way.",
  } satisfies Phrase,
};

export const homeMeta = {
  title: {
    ru: "Матрица судьбы — расчёт по дате рождения с расшифровкой",
    // «Calculator», а не «calculate»: главная и есть калькулятор, и спрашивают её именно так —
    // «destiny matrix calculator», «free destiny matrix calculator», «destiny matrix calculator
    // with explanation». Форма глагола этих запросов не ловит.
    en: "Destiny matrix calculator — free chart with explanation",
  } satisfies Phrase,
  descriptionHead: {
    ru: "Рассчитайте матрицу судьбы по дате рождения: октаграмма 22 арканов, карта энергий по чакрам, ",
    en: "Free destiny matrix calculator: your date of birth gives the octagram of 22 arcana, the chakra map, ",
  } satisfies Phrase,
  descriptionFree: {
    ru: "20 разделов разбора. Расчёт и весь разбор — бесплатно, без регистрации.",
    en: "20 sections of the reading — all free, no sign-up.",
  } satisfies Phrase,
  descriptionPaidHead: {
    ru: "20 разделов разбора. Расчёт и два раздела бесплатно",
    en: "20 sections of the reading. The calculation and two sections are free",
  } satisfies Phrase,
  descriptionPaidPrice: {
    ru: (price: string) => `, полный разбор — ${price}.`,
    en: (price: string) => `, the full reading costs ${price}.`,
  } satisfies PhraseFn<[string]>,
  productName: {
    ru: "Матрица судьбы — полный разбор",
    en: "Destiny matrix — the full reading",
  } satisfies Phrase,
  productDescription: {
    ru: "Персональный разбор по дате рождения: октаграмма арканов, карта энергий по чакрам, 20 разделов.",
    en: "A personal reading by date of birth: the octagram of arcana, the chakra energy map, 20 sections.",
  } satisfies Phrase,
};

export const quote = {
  text: {
    ru: "В матрице нет приговора: есть склонности и цена, которую каждая из них берёт. Куда "
      + "вложить силы, а где не спорить с собой — решаете вы.",
    en: "The matrix passes no sentence: there are tendencies, and each of them has its price. "
      + "Where to put your effort, and where to stop arguing with yourself, is up to you.",
  } satisfies Phrase,
};

export const slides = {
  landing: [
    {
      eyebrow: { ru: "Arcana Sense · матрица судьбы по 22 арканам",
                 en: "Arcana Sense · destiny matrix of 22 arcana" } satisfies Phrase,
      heading: { ru: "Матрица судьбы: разбор по дате рождения",
                 en: "Destiny matrix: a reading by date of birth" } satisfies Phrase,
      link: { ru: "Что входит в разбор", en: "What the reading includes" } satisfies Phrase,
    },
    {
      eyebrow: { ru: "17 позиций карты", en: "17 positions of the chart" } satisfies Phrase,
      heading: { ru: "Октаграмма: где какой аркан стоит именно у вас",
                 en: "The octagram: which arcanum stands where in your chart" } satisfies Phrase,
      link: { ru: "Позиции карты", en: "Positions of the chart" } satisfies Phrase,
    },
    {
      eyebrow: { ru: "портрет · центр · материальная задача",
                 en: "portrait · centre · material task" } satisfies Phrase,
      heading: { ru: "Три аркана, с которых читают вашу карту",
                 en: "The three arcana a reading starts from" } satisfies Phrase,
      link: { ru: "22 аркана", en: "22 arcana" } satisfies Phrase,
    },
    {
      eyebrow: { ru: "разбор по десятилетиям до 80 лет",
                 en: "a reading by decades up to 80" } satisfies Phrase,
      heading: { ru: "Какая энергия ведёт вас в каждом десятилетии",
                 en: "Which energy leads you through each decade" } satisfies Phrase,
      link: { ru: "Матрица на год", en: "Matrix for the year" } satisfies Phrase,
    },
    {
      eyebrow: { ru: "20 разделов отчёта", en: "20 sections of the reading" } satisfies Phrase,
      heading: { ru: "Деньги, отношения, род и предназначение — в одном разборе",
                 en: "Money, relationships, family and purpose — in one reading" } satisfies Phrase,
      link: { ru: "Каталог матриц", en: "Matrix catalogue" } satisfies Phrase,
    },
  ],
  encyclopedia: [
    {
      eyebrow: { ru: "Arcana Sense · 22 аркана", en: "Arcana Sense · 22 arcana" } satisfies Phrase,
      heading: { ru: "Матрица судьбы по дате рождения",
                 en: "Destiny matrix by date of birth" } satisfies Phrase,
      link: { ru: "Что входит в разбор", en: "What the reading includes" } satisfies Phrase,
    },
    {
      eyebrow: { ru: "17 позиций карты", en: "17 positions of the chart" } satisfies Phrase,
      heading: { ru: "Посмотрите свои арканы в октаграмме",
                 en: "See your own arcana in the octagram" } satisfies Phrase,
      link: { ru: "Позиции карты", en: "Positions of the chart" } satisfies Phrase,
    },
    {
      eyebrow: { ru: "портрет · центр · материальная задача",
                 en: "portrait · centre · material task" } satisfies Phrase,
      heading: { ru: "Ваши три главных аркана — за минуту",
                 en: "Your three main arcana — in a minute" } satisfies Phrase,
      link: { ru: "22 аркана", en: "22 arcana" } satisfies Phrase,
    },
    {
      eyebrow: { ru: "как читается персональный год",
                 en: "how a personal year is read" } satisfies Phrase,
      heading: { ru: "Аркан вашего года и что он требует",
                 en: "The arcanum of your year and what it asks for" } satisfies Phrase,
      link: { ru: "Матрица на год", en: "Matrix for the year" } satisfies Phrase,
    },
    {
      eyebrow: { ru: "20 разделов отчёта", en: "20 sections of the reading" } satisfies Phrase,
      heading: { ru: "Весь справочник — на вашей дате рождения",
                 en: "The whole encyclopedia — applied to your date of birth" } satisfies Phrase,
      link: { ru: "Разделы отчёта", en: "Sections of the reading" } satisfies Phrase,
    },
  ],
};

/** Блок «полный разбор» под расчётом: он живёт и на главной, и на странице «Мой разбор». */
export const unlockBox = {
  exampleTitleFree: { ru: "Так выглядит полный разбор", en: "This is what the full reading looks like" } satisfies Phrase,
  openTitleFree: { ru: "Разбор открыт полностью", en: "The reading is fully open" } satisfies Phrase,
  exampleLeadFree: {
    ru: "Это карта-пример: выберите свою дату выше, и все 20 разделов пересчитаются по ней. ",
    en: "This is an example chart: pick your own date above and all 20 sections will be recalculated. ",
  } satisfies Phrase,
  openLeadFree: {
    ru: "Все 20 разделов по вашей дате открыты без оплаты. ",
    en: "All 20 sections for your date are open without payment. ",
  } satisfies Phrase,
  saveForPdf: {
    ru: "Чтобы вернуться к разбору с другого устройства и скачать PDF, сохраните дату в кабинет.",
    en: "To open the reading from another device and download the PDF, save the date to your account.",
  } satisfies Phrase,
  saveDate: { ru: "Сохранить дату в кабинет", en: "Save the date to your account" } satisfies Phrase,
  exampleTitle: { ru: "Что покажет полный разбор", en: "What the full reading shows" } satisfies Phrase,
  openTitle: { ru: "Открыть полный разбор", en: "Open the full reading" } satisfies Phrase,
  exampleLead: {
    ru: "Это карта-пример. Выберите свою дату выше — и те же 20 разделов пересчитаются по ней: ",
    en: "This is an example chart. Pick your own date above and the same 20 sections will be recalculated: ",
  } satisfies Phrase,
  openLead: {
    ru: "Все 20 разделов по вашей дате: ",
    en: "All 20 sections for your date: ",
  } satisfies Phrase,
  contents: {
    ru: "деньги, отношения, род до седьмого колена, толкование карты энергий и разбор по десятилетиям до 80 лет.",
    en: "money, relationships, the family line down to the seventh generation, the energy map and a reading by decades up to 80.",
  } satisfies Phrase,
  onePayment: {
    ru: (price: string) => `${price} — один платёж, без подписки.`,
    en: (price: string) => `${price} — one payment, no subscription.`,
  } satisfies PhraseFn<[string]>,
  priceUnknown: { ru: "Цена уточняется.", en: "The price is being updated." } satisfies Phrase,
  alreadyPaid: {
    ru: "Разбор уже оплачен. Толкования печатает сервер, поэтому дата открывается на отдельной странице.",
    en: "The reading is already paid for. The server prints the texts, so the date opens on its own page.",
  } satisfies Phrase,
  unlimitedPlan: {
    ru: "Ваш тариф открывает любые даты. Толкования печатает сервер, поэтому сохраните эту дату в кабинет — разбор откроется на отдельной странице.",
    en: "Your plan opens any date. The server prints the texts, so save this date to your account and the reading will open on its own page.",
  } satisfies Phrase,
  saveAndOpen: {
    ru: "Сохранить дату и открыть полный разбор",
    en: "Save the date and open the full reading",
  } satisfies Phrase,
  alreadyBought: {
    ru: "Уже оплачивали?",
    en: "Already paid?",
  } satisfies Phrase,
  signInTail: {
    ru: "— доступ живёт в аккаунте, а не в браузере.",
    en: "— access lives in your account, not in the browser.",
  } satisfies Phrase,
  signIn: { ru: "Войдите", en: "Sign in" } satisfies Phrase,
  // страница «Мой разбор»
  reportOpenFree: {
    ru: "Все 20 разделов по этой дате открыты без оплаты. Чтобы вернуться к ним с другого устройства и скачать PDF, сохраните дату в кабинет.",
    en: "All 20 sections for this date are open without payment. To come back to them from another device and download the PDF, save the date to your account.",
  } satisfies Phrase,
  grantedTitle: {
    ru: "Полный разбор по этой дате собирает сервер",
    en: "The full reading for this date is assembled by the server",
  } satisfies Phrase,
  grantedText: {
    ru: (locked: number) => `Тариф оплачен, но толкования платных разделов в браузер не приходят: `
      + `их печатает сервер по сохранённой матрице. Сохраните эту дату в кабинет — и ${locked} `
      + "разделов откроются на странице разбора.",
    en: (locked: number) => `The plan is paid for, but the texts of the paid sections never reach `
      + `the browser: the server prints them from the saved matrix. Save this date to your account `
      + `and ${locked} sections will open on the reading page.`,
  } satisfies PhraseFn<[number]>,
  savedEarlier: {
    ru: "Уже сохраняли раньше?",
    en: "Saved it before?",
  } satisfies Phrase,
  accountHasList: {
    ru: "— там список ваших матриц.",
    en: "— your matrices are listed there.",
  } satisfies Phrase,
  lockedLeft: {
    ru: (locked: number) => `Осталось ${locked} разделов под замком`,
    en: (locked: number) => `${locked} sections are still locked`,
  } satisfies PhraseFn<[number]>,
  lockedLead: {
    ru: "Полный разбор открывает деньги, отношения, родовые задачи, программы и разбор по десятилетиям до 80 лет.",
    en: "The full reading opens money, relationships, family tasks, programs and a reading by decades up to 80.",
  } satisfies Phrase,
  onePaymentPdf: {
    ru: (price: string) => `${price} — один платёж, без подписки: разбор открыт в аккаунте и скачивается в PDF.`,
    en: (price: string) => `${price} — one payment, no subscription: the reading stays in your account and downloads as a PDF.`,
  } satisfies PhraseFn<[string]>,
  signedInAs: {
    ru: (email: string) => `Вы вошли как ${email}: покупка откроет разделы в этом аккаунте.`,
    en: (email: string) => `You are signed in as ${email}: the purchase will open the sections in this account.`,
  } satisfies PhraseFn<[string]>,
  signInTailAccount: {
    ru: "— доступ привязан к аккаунту, а не к браузеру.",
    en: "— access is tied to the account, not to the browser.",
  } satisfies Phrase,
  noDateTitle: { ru: "Дата не выбрана", en: "No date selected" } satisfies Phrase,
  signedInNoDate: {
    ru: (email: string) => `Вы вошли как ${email}. Сохранённые даты открываются из`,
    en: (email: string) => `You are signed in as ${email}. Saved dates open from your`,
  } satisfies PhraseFn<[string]>,
  accountWord: { ru: "кабинета", en: "account" } satisfies Phrase,
  noDateTail: {
    ru: ", а новую можно посчитать здесь.",
    en: ", and a new one can be calculated here.",
  } satisfies Phrase,
  paidNoSession: {
    ru: "Если разбор оплачен,",
    en: "If the reading is paid for,",
  } satisfies Phrase,
  paidNoSessionTail: {
    ru: "— он привязан к аккаунту, а не к браузеру.",
    en: "— it is tied to the account, not to the browser.",
  } satisfies Phrase,
  browserOnly: {
    ru: "Отчёт строится в браузере по вашей дате рождения — на сервер она не уходит, поэтому и здесь её нет, пока вы не укажете дату. По той же причине расчёт не переносится в новую вкладку: он остаётся в той, где вы его сделали.",
    en: "The reading is built in your browser from your date of birth — it never goes to the server, so it is not here until you enter a date. For the same reason the calculation does not move to a new tab: it stays in the one where you made it.",
  } satisfies Phrase,
  setDate: { ru: "Указать дату рождения", en: "Enter a date of birth" } satisfies Phrase,
  buildingReport: { ru: "Собираем отчёт…", en: "Building the reading…" } satisfies Phrase,
  readingTitle: { ru: "Разбор матрицы судьбы", en: "Destiny matrix reading" } satisfies Phrase,
  sectionsOpen: {
    ru: (open: number) => `${open} ${open % 10 === 1 && open % 100 !== 11 ? "раздел"
      : [2, 3, 4].includes(open % 10) && ![12, 13, 14].includes(open % 100) ? "раздела" : "разделов"} открыто`,
    en: (open: number) => `${open} ${open === 1 ? "section" : "sections"} open`,
  } satisfies PhraseFn<[number]>,
};
