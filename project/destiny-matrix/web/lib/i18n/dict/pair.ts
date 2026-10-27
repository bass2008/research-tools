import type { Phrase, PhraseFn } from "./index";
import type { Lang as Locale } from "../lang";

// Слова разбора пары. Отдельно от D (Decision 10): их читает только страница совместимости.
export const DP = {
  navTitle: { ru: "Совместимость", en: "Compatibility" } satisfies Phrase,
  pageTitle: { ru: "Матрица судьбы совместимость: рассчитать по дате рождения", en: "Destiny matrix compatibility calculator by date of birth" } satisfies Phrase,
  pageDescription: {
    ru: "Рассчитать совместимость и матрицу судьбы пары онлайн и бесплатно: по двум датам рождения — чакры пары, ради чего вы встретились и задачи союза.",
    en: "Free destiny matrix compatibility calculator for couples: two birth dates give your couple's matrix, its chakras, why you met and what binds you.",
  } satisfies Phrase,
  h1: { ru: "Совместимость по матрице судьбы", en: "Destiny matrix compatibility for couples" } satisfies Phrase,
  // Раздел разбора «Совместимость в работе» (Лисовская, глава 5): своя матрица из сложения дат.
  business: {
    title: { ru: "Совместимость в работе", en: "Compatibility at work" } satisfies Phrase,
    lead: {
      ru: "Деловая совместимость считается иначе: даты складываются напрямую — день с днём, месяц с месяцем, год с годом, — и на полученную «дату» строится своя матрица. Она отвечает, как сложится общее дело, сделка или партнёрство.",
      en: "Business compatibility is counted differently: the dates are added directly — day to day, month to month, year to year — and a matrix of its own is built on the resulting “date”. It shows how a shared venture, a deal or a partnership will go.",
    } satisfies Phrase,
    date: {
      ru: (d: number, m: number, y: number) => `Деловая «дата»: ${d}.${m}.${y}`,
      en: (d: number, m: number, y: number) => `Business “date”: ${d}.${m}.${y}`,
    } satisfies PhraseFn<[number, number, number]>,
    count: {
      ru: (open: number, all: number) => `Открыто сфер: ${open} из ${all}`,
      en: (open: number, all: number) => `${open} of ${all} spheres open`,
    } satisfies PhraseFn<[number, number]>,
    sphere: {
      base: { title: { ru: "На чём держится партнёрство", en: "What the partnership stands on" }, lead: { ru: "Основа ваших деловых отношений.", en: "The foundation of your working relationship." } },
      view: { title: { ru: "Как партнёр видит вас", en: "How your partner sees you" }, lead: { ru: "Как вас воспринимает другая сторона и в чём ваше преимущество.", en: "How the other side perceives you and where your advantage lies." } },
      plus: { title: { ru: "Плюс сделки", en: "The upside of the deal" }, lead: { ru: "Чего вы достигнете вместе, если всё пойдёт хорошо.", en: "What you achieve together if things go well." } },
      minus: { title: { ru: "С чем придётся смириться", en: "What you will have to accept" }, lead: { ru: "Минусы, которые придут вместе со сделкой.", en: "The downsides that come with the deal." } },
      gain: { title: { ru: "Материальная выгода", en: "Material gain" }, lead: { ru: "Что партнёрство даст обоим в деньгах и вещах.", en: "What the partnership gives both of you in money and goods." } },
      result: { title: { ru: "Результат и выгода", en: "Result and benefit" }, lead: { ru: "К чему придёт общее дело.", en: "Where the shared venture leads." } },
      trouble: { title: { ru: "Трудности сотрудничества", en: "Difficulties of working together" }, lead: { ru: "Где будут трения и на чём возможны конфликты.", en: "Where friction arises and what conflicts may rest on." } },
      hidden: { title: { ru: "Что может остаться за кадром", en: "What may stay behind the scenes" }, lead: { ru: "Что другая сторона может не сказать и к чему стоит подготовиться.", en: "What the other side may not tell you and what to prepare for." } },
      finance: { title: { ru: "Финансовый итог", en: "Financial outcome" }, lead: { ru: "Линия финансов: насколько выгодной будет сделка и что на неё влияет.", en: "The money line: how profitable the deal will be and what affects it." } },
      relations: { title: { ru: "Как договариваться", en: "How to reach agreement" }, lead: { ru: "Линия отношений: как держать уважение и на каких условиях работать.", en: "The relationship line: how to keep respect and on what terms to work." } },
    },
    point: {
      base: { ru: "Основа", en: "Foundation" }, view: { ru: "Ваш образ", en: "Your image" }, plus: { ru: "Плюс", en: "Upside" },
      minus: { ru: "Минус", en: "Downside" }, gain: { ru: "Выгода", en: "Gain" }, result: { ru: "Результат", en: "Result" },
      trouble: { ru: "Трудности", en: "Difficulties" }, hiddenA: { ru: "Скрытое", en: "Hidden" }, hiddenB: { ru: "Скрытое", en: "Hidden" },
      finIn: { ru: "Вход в деньги", en: "Way into money" }, finWay: { ru: "Путь к выгоде", en: "Path to profit" }, finTotal: { ru: "Итог", en: "Outcome" },
      relCommon: { ru: "Что объединяет", en: "What unites" }, relTerms: { ru: "Условия", en: "Terms" },
    },
  },
  // Раздел энциклопедии «Арканы в совместимости»: хаб и страница на энергию 2–22.
  encCompat: {
    calcTitle: { ru: "Посчитайте матрицу своей пары", en: "Work out your couple's matrix" } satisfies Phrase,
    calcLead: {
      ru: "Две даты рождения — и вы увидите, в каких точках вашей пары стоит этот аркан и что он значит именно там.",
      en: "Two birth dates show which points of your couple's matrix hold this arcanum and what it means there.",
    } satisfies Phrase,
    calcButton: { ru: "Рассчитать совместимость", en: "Calculate compatibility" } satisfies Phrase,
    hubLead: {
      ru: "Две даты рождения — и вы увидите матрицу пары: её центр, кармический хвост, чакры и деловую совместимость. Расчёт бесплатный и идёт в браузере.",
      en: "Two birth dates show your couple's matrix: its centre, karmic tail, chakras and business compatibility. The calculation is free and runs in your browser.",
    } satisfies Phrase,
    calcLink: { ru: "Калькулятор совместимости", en: "Compatibility calculator" } satisfies Phrase,
    deckHint: { ru: "Выберите аркан, чтобы прочитать, что он значит в паре", en: "Pick an arcanum to read what it means in a couple" } satisfies Phrase,
    inPersonal: {
      ru: (n: number, title: string) => `${n} аркан (${title}) в личной матрице судьбы`,
      en: (n: number, title: string) => `Arcanum ${n} (${title}) in a personal destiny matrix`,
    } satisfies PhraseFn<[number, string]>,
    inPersonalHint: { ru: "Тот же аркан в карте одного человека", en: "The same arcanum in one person's chart" } satisfies Phrase,
    others: { ru: "Другие арканы в совместимости", en: "Other arcana in compatibility" } satisfies Phrase,
    all: { ru: "Все арканы в совместимости", en: "All arcana in compatibility" } satisfies Phrase,
    listTitle: { ru: "Арканы в матрице пары", en: "Arcana in a couple's matrix" } satisfies Phrase,
    pageCrumb: { ru: (n: number, title: string) => `${n} · ${title}`, en: (n: number, title: string) => `${n} · ${title}` } satisfies PhraseFn<[number, string]>,
  },
  encPairTail: {
    crumb: { ru: "Кармические хвосты пары", en: "Couple karmic tails" } satisfies Phrase,
    short: {
      ru: "У пары свой кармический хвост: каждую его точку складывают из одноимённых точек двух личных матриц. Сочетаний 97, и у каждого своя статья — найдите тройку из вашего расчёта.",
      en: "A couple has its own karmic tail: each point is the sum of the same points of the two personal matrices. There are 97 combinations, each with its own article — find the three numbers from your reading.",
    } satisfies Phrase,
    listTitle: { ru: "Хвосты пары по главной задаче", en: "Couple tails by the main task" } satisfies Phrase,
    listHint: {
      ru: (count: number) => `Тройка читается в порядке «вход в задачу — середина — главная задача». Статей: ${count}.`,
      en: (count: number) => `Read the three numbers as “entry to the task — middle — main task”. Articles: ${count}.`,
    } satisfies PhraseFn<[number]>,
    groupTitle: { ru: (n: number, title: string) => `Главная задача — ${n} · ${title}`, en: (n: number, title: string) => `Main task — ${n} · ${title}` } satisfies PhraseFn<[number, string]>,
    searchLabel: { ru: "Найти хвост пары по трём числам", en: "Find a couple tail by its three numbers" } satisfies Phrase,
    searchPlaceholder: { ru: "например, 9-21-12", en: "for example, 9-21-12" } satisfies Phrase,
    missing: {
      ru: (key: string) => `Хвоста пары ${key} в методе нет. Порядок чисел важен: проверьте, что первым идёт вход в задачу, а последним — главная задача.`,
      en: (key: string) => `There is no couple tail ${key} in the method. The order matters: the entry to the task comes first and the main task last.`,
    } satisfies PhraseFn<[string]>,
    calcTitle: { ru: "Найдите хвост своей пары", en: "Find your couple's tail" } satisfies Phrase,
    calcLead: {
      ru: "Две даты рождения — и вы увидите кармический хвост вашей пары вместе с центром, чакрами и остальными точками матрицы. Расчёт бесплатный.",
      en: "Two birth dates show your couple's karmic tail together with the centre, chakras and the other points of the matrix. The calculation is free.",
    } satisfies Phrase,
    whereNext: { ru: "Куда дальше", en: "Where next" } satisfies Phrase,
    sibling: { ru: (key: string) => `Хвост пары ${key} — те же числа в другом порядке`, en: (key: string) => `Couple tail ${key}: the same numbers in another order` } satisfies PhraseFn<[string]>,
    personal: { ru: (key: string) => `Личный кармический хвост ${key}`, en: (key: string) => `Personal karmic tail ${key}` } satisfies PhraseFn<[string]>,
    pairTwin: { ru: (key: string) => `Кармический хвост ${key} в совместимости`, en: (key: string) => `Karmic tail ${key} in compatibility` } satisfies PhraseFn<[string]>,
    all: { ru: "Все хвосты пары", en: "All couple tails" } satisfies Phrase,
  },
  // Пять надписей карусели — по одной на композицию CalcHero; ссылки ведут к разделам разбора ниже.
  slides: [
    {
      eyebrow: { ru: "Arcana Sense · матрица судьбы пары по двум датам рождения", en: "Arcana Sense · compatibility by two birth dates" } satisfies Phrase,
      heading: { ru: "Совместимость по матрице судьбы", en: "Destiny matrix compatibility for couples" } satisfies Phrase,
      link: { ru: "Что входит в разбор", en: "What the reading includes" } satisfies Phrase,
      href: "#pair-reading",
    },
    {
      eyebrow: { ru: "атмосфера · ради чего встретились", en: "atmosphere · why you met" } satisfies Phrase,
      heading: { ru: "Ради чего вы встретились и что между вами", en: "Why you met and what is between you" } satisfies Phrase,
      link: { ru: "Открытые сферы", en: "Open spheres" } satisfies Phrase,
      href: "#sec-meet",
    },
    {
      eyebrow: { ru: "центр · образ · задачи · ценности", en: "centre · image · tasks · values" } satisfies Phrase,
      heading: { ru: "Пять главных карт вашей пары", en: "The five main cards of your couple" } satisfies Phrase,
      link: { ru: "Главные точки", en: "Main points" } satisfies Phrase,
      href: "#pair-main",
    },
    {
      eyebrow: { ru: "две даты — одна карта", en: "two dates, one chart" } satisfies Phrase,
      heading: { ru: "Как пара сложилась из двух матриц", en: "How the couple adds up from two matrices" } satisfies Phrase,
      link: { ru: "Сложение матриц", en: "Adding the matrices" } satisfies Phrase,
      href: "#pair-merge",
    },
    {
      eyebrow: { ru: "12 сфер пары", en: "12 spheres of the couple" } satisfies Phrase,
      heading: { ru: "Деньги, отношения, родители и задачи — в одном разборе", en: "Money, relationships, parents and tasks — in one reading" } satisfies Phrase,
      link: { ru: "Совместимость в работе", en: "Compatibility at work" } satisfies Phrase,
      href: "#pair-business",
    },
  ],
  // Под примером пары — вопросы и ответы: пример уже показывает карту, сферы и что под замком.
  seo: {
    combination: {
      ru: "Сочетания арканов одной личной карты разобраны в справочнике —",
      en: "Combinations of arcana within one personal chart are explained in the reference —",
    } satisfies Phrase,
    combinationLink: { ru: "сочетания арканов", en: "arcana combinations" } satisfies Phrase,
    arcanaLine: {
      ru: "Что значит каждый аркан в матрице пары, по точкам, —",
      en: "What each arcanum means in a couple's matrix, point by point, —",
    } satisfies Phrase,
    articlesLine: {
      ru: "Отдельные статьи — о центре пары, её кармическом хвосте и совместимости в работе:",
      en: "Separate articles cover the couple's centre, its karmic tail and compatibility at work:",
    } satisfies Phrase,
    faqTitle: { ru: "Частые вопросы", en: "Frequent questions" } satisfies Phrase,
    faq: [
      {
        q: { ru: "Как рассчитать совместимость по матрице судьбы?", en: "How do I calculate destiny matrix compatibility?" } satisfies Phrase,
        a: {
          ru: "Введите две даты рождения в форму выше и нажмите «Рассчитать совместимость». Карта пары, главные числа и две сферы появятся сразу — бесплатно и без регистрации.",
          en: "Enter two dates of birth in the form above and press “Calculate compatibility”. The couple's chart, the main numbers and two spheres appear at once, for free and with no sign-up.",
        } satisfies Phrase,
      },
      {
        q: { ru: "Как считается матрица пары?", en: "How is the couple's matrix calculated?" } satisfies Phrase,
        a: {
          ru: "Сначала строится личная матрица судьбы каждого партнёра, затем матрица пары: каждая её точка — сумма одноимённых точек двух личных матриц, свёрнутая до числа от 1 до 22. Личное, социальное и духовное предназначение пары пересчитываются из её же сумм, поэтому у пары свои числа, а не среднее двух карт. Так считает школа Лисовской. Такую карту ещё называют совместной матрицей судьбы или матрицей судьбы с партнёром.",
          en: "First each partner's personal destiny matrix is built, then the couple's matrix: each of its points is the sum of the same points of the two personal matrices, reduced to a number from 1 to 22. The couple's personal, social and spiritual purposes are recalculated from its own sums, so the couple has numbers of its own rather than an average of two charts. This is how the Lisovskaya school counts. People also call it a joint destiny matrix; love, partner and relationship compatibility in the destiny matrix all mean this same calculation.",
        } satisfies Phrase,
      },
      {
        q: { ru: "Как считается совместимость по чакрам по дате рождения?", en: "How is chakra compatibility calculated from dates of birth?" } satisfies Phrase,
        a: {
          ru: "У каждого партнёра по дате рождения строится личная карта семи чакр: физика, энергия и эмоции. Карта чакр пары складывает одноимённые числа двух карт и сворачивает сумму до 22 — так в паре складывает точки школа Лисовской. Получаются семь сфер общей жизни, от общей опоры до того, что вдохновляет двоих, и общее энергополе союза. Карта считается бесплатно, а готовые толкования семи чакр и общего энергополя по числам вашей пары открываются сразу после покупки.",
          en: "Each partner's personal map of seven chakras is built from the date of birth: physics, energy and emotions. The couple's chakra map adds the matching numbers of the two maps and reduces the sum to 22, the way the Lisovskaya school adds the points of a couple. The result is seven spheres of shared life, from your common footing to what inspires you both, and the overall energy field of the union. The map is free; ready-made readings of all seven chakras and the overall energy field for your couple’s numbers open immediately after purchase.",
        } satisfies Phrase,
      },
      {
        q: { ru: "Нужны ли время и место рождения?", en: "Do I need the time and place of birth?" } satisfies Phrase,
        a: {
          ru: "Нет. Матрица судьбы строится только по дате: дню, месяцу и году рождения каждого партнёра.",
          en: "No. The destiny matrix is built from the date alone: the day, month and year of birth of each partner.",
        } satisfies Phrase,
      },
      {
        q: { ru: "Что открыто бесплатно?", en: "What is free?" } satisfies Phrase,
        a: {
          ru: "Карта пары, карта чакр пары, главные числа, две сферы целиком («Ради чего встретились» и «Атмосфера внутри пары»), подписи пяти главных карт и две сферы совместимости в работе. Полный разбор открывает все сферы, включая кармический хвост пары, индивидуальное толкование чакр пары, всю совместимость в работе и PDF.",
          en: "The couple's chart, the couple's chakra map, the main numbers, two full spheres (“Why you met” and “The atmosphere inside the couple”), the captions of the five main cards and two spheres of compatibility at work. The full reading opens every sphere, including the couple's karmic tail, an individual reading of the couple's chakras, all of compatibility at work and a PDF.",
        } satisfies Phrase,
      },
      {
        q: { ru: "Уходят ли даты рождения на сервер?", en: "Do the dates of birth go to the server?" } satisfies Phrase,
        a: {
          ru: "Нет. Расчёт идёт в браузере: даты не покидают его, пока вы сами не сохраните пару в кабинет.",
          en: "No. The calculation runs in your browser: the dates do not leave it until you save the couple to your account.",
        } satisfies Phrase,
      },
      {
        q: { ru: "Подходит ли расчёт для мужчины и женщины?", en: "Does the calculation work for a man and a woman?" } satisfies Phrase,
        a: {
          ru: "Да. Совместимость мужчины и женщины считается по двум датам рождения, пол в расчёт не входит: матрица пары складывается из чисел дат, а сферы разбора описывают пару, а не роли «он» и «она».",
          en: "Yes. Compatibility of a man and a woman is worked out from two dates of birth, and sex is not part of the calculation: the couple's matrix is built from the numbers of the dates, and the spheres of the reading describe the couple, not the roles of “him” and “her”.",
        } satisfies Phrase,
      },
      {
        q: { ru: "Можно ли посчитать совместимость пары одного пола?", en: "Can I work out compatibility for a same-sex couple?" } satisfies Phrase,
        a: {
          ru: "Да. Расчёт от пола не зависит, поэтому совместимость двух женщин или двух мужчин считается так же, как любой другой пары, и разбор читается так же. Форма пол не спрашивает.",
          en: "Yes. The calculation does not depend on sex, so compatibility of two women or two men is worked out the same way as for any other couple, and the reading is read the same way. The form does not ask for sex.",
        } satisfies Phrase,
      },
      {
        q: { ru: "Можно ли посчитать совместимость с другом или коллегой?", en: "Can I work out compatibility with a friend or a colleague?" } satisfies Phrase,
        a: {
          ru: "Да. Матрица пары описывает любые отношения двух людей: Лисовская прямо пишет, что это не обязательно муж и жена — это могут быть друзья, коллеги, начальник. Расчёт тот же, сферы о детях и быте читайте по смыслу ваших отношений, а для работы в разборе есть отдельный раздел «Совместимость в работе».",
          en: "Yes. The couple's matrix describes any relationship between two people: Lisovskaya says plainly that it need not be husband and wife — it can be friends, colleagues, a boss. The calculation is the same; read the spheres about children and home life in the light of your relationship, and for work the reading has a separate section, “Compatibility at work”.",
        } satisfies Phrase,
      },
      {
        q: { ru: "Чем совместимость отличается от сочетания арканов?", en: "How is compatibility different from a combination of arcana?" } satisfies Phrase,
        a: {
          ru: "Сочетание — два аркана одной личной карты, которые стоят в связанных точках. Совместимость — отдельная карта пары, сложенная из двух дат рождения.",
          en: "A combination is two arcana of one personal chart that stand in linked points. Compatibility is a separate chart of the couple built from two dates of birth.",
        } satisfies Phrase,
      },
    ],
  },
  lead: {
    ru: "Две даты рождения — и вы увидите, что между вами, когда никто не смотрит, ради чего вы встретились и чему паре предстоит научиться. Расчёт бесплатный и идёт в вашем браузере.",
    en: "Two birth dates show what is between you when nobody is watching, why you met and what the couple has to learn. The calculation is free and runs in your browser.",
  } satisfies Phrase,
  formTitle: { ru: "Введите две даты рождения", en: "Enter two birth dates" } satisfies Phrase,
  formHint: {
    ru: "Без регистрации. Имена нужны только для подписи разбора.",
    en: "No sign-up needed. Names are used only to title the reading.",
  } satisfies Phrase,
  first: { ru: "Первый партнёр", en: "First partner" } satisfies Phrase,
  second: { ru: "Второй партнёр", en: "Second partner" } satisfies Phrase,
  name: { ru: "Имя", en: "Name" } satisfies Phrase,
  optional: { ru: "необязательно", en: "optional" } satisfies Phrase,
  addNames: { ru: "Добавить имена", en: "Add names" } satisfies Phrase,
  submit: { ru: "Рассчитать совместимость", en: "Calculate compatibility" } satisfies Phrase,
  dateError: { ru: (who: string, why: string) => `${who}: ${why}`, en: (who: string, why: string) => `${who}: ${why}` } satisfies PhraseFn<[string, string]>,
  example: { ru: "Пример расчёта", en: "Sample calculation" } satisfies Phrase,
  partnerA: { ru: "Партнёр 1", en: "Partner 1" } satisfies Phrase,
  partnerB: { ru: "Партнёр 2", en: "Partner 2" } satisfies Phrase,
  and: { ru: (a: string, b: string) => `${a} и ${b}`, en: (a: string, b: string) => `${a} and ${b}` } satisfies PhraseFn<[string, string]>,
  pairDates: { ru: (a: string, b: string) => `Пара ${a} и ${b}`, en: (a: string, b: string) => `Couple ${a} and ${b}` } satisfies PhraseFn<[string, string]>,

  mapTitle: { ru: "Матрица пары", en: "Couple matrix" } satisfies Phrase,
  keysTitle: { ru: "Главные числа", en: "Key numbers" } satisfies Phrase,
  summaryTitle: { ru: "Главное о вашей паре", en: "The essence of your couple" } satisfies Phrase,
  inFull: { ru: "в полном разборе", en: "in the full reading" } satisfies Phrase,
  mainTitle: { ru: "Главные точки пары", en: "Main points of the couple" } satisfies Phrase,
  mainLead: { ru: "Пять главных позиций вашей пары", en: "The five main positions of your couple" } satisfies Phrase,
  mergeTitle: { ru: "Из чего сложилась пара", en: "How the couple adds up" } satisfies Phrase,
  mergeLead: { ru: "Две личные матрицы и их сумма", en: "Two personal matrices and their sum" } satisfies Phrase,
  allTitle: { ru: "Все сферы пары", en: "All spheres of the couple" } satisfies Phrase,
  chakras: {
    title: { ru: "Чакры пары", en: "The couple's chakras" } satisfies Phrase,
    lockedRow: {
      ru: "Откроется в полном разборе · по числам вашей пары",
      en: "Opens in the full reading · for your couple’s numbers",
    } satisfies Phrase,
    lead: {
      ru: "Семь сфер общей жизни · три аркана в каждой · нажмите, чтобы прочитать",
      en: "Seven spheres of your life together · three arcana in each · tap to read",
    } satisfies Phrase,
    lockedLead: {
      ru: "Семь сфер общей жизни · три аркана в каждой. Толкования по числам вашей пары открываются сразу после покупки.",
      en: "Seven spheres of your life together · three arcana in each. Readings for your couple’s numbers open immediately after purchase.",
    } satisfies Phrase,
    printLead: { ru: "Семь сфер общей жизни · три аркана в каждой", en: "Seven spheres of your life together · three arcana in each" } satisfies Phrase,
    locked: { ru: "Толкование доступно в полном разборе пары", en: "The reading is available in the full couple reading" } satisfies Phrase,
    unlockHint: {
      ru: "Толкования семи чакр и общего энергополя по числам вашей пары открываются сразу после покупки.",
      en: "Readings of all seven chakras and the overall energy field for your couple’s numbers open immediately after purchase.",
    } satisfies Phrase,
    originLead: {
      ru: "Каждое число — сумма тех же чисел ваших двух личных карт чакр, свёрнутая до 22, как вся матрица пары. Поэтому эмоции пары не всегда равны сумме её физики и энергии: они складываются из эмоций каждого из вас.",
      en: "Each number is the sum of the same numbers in your two personal chakra maps, reduced to 22 like the whole couple's matrix. That is why the couple's emotions do not always equal the sum of its physics and energy: they add up from each partner's emotions.",
    } satisfies Phrase,
    intro: {
      ru: "Чакры пары — семь сфер вашей общей жизни, от того, на чём вы стоите, до того, что вас вдохновляет. В каждой три аркана: что вы делаете вдвоём, что вами движет и как вы это переживаете. Это символическая карта союза, а не приговор и не оценка отношений.",
      en: "The couple's chakras are seven spheres of your life together, from what you stand on to what inspires you. Each holds three arcana: what you do as two, what drives you and how you live it. This is a symbolic map of the union, not a verdict or a grade of the relationship.",
    } satisfies Phrase,
    note: {
      ru: "Чакры для пары — метод Arcana Sense по правилу сложения из книги Юлианы Лисовской: каждое число — сумма тех же чисел двух личных карт. Тексты — толкование символов, а не прогноз.",
      en: "Chakras for a couple are an Arcana Sense method built on the addition rule from Yuliana Lisovskaya's book: each number is the sum of the same numbers in two personal maps. The texts interpret symbols; they are not a forecast.",
    } satisfies Phrase,
    topics: {
      muladhara: { ru: "Общая опора: дом, уклад, чувство защищённости", en: "Your shared footing: home, routine, a sense of safety" },
      svadhisthana: { ru: "Радость вдвоём: отдых, игра, общие желания", en: "Joy together: rest, play, shared wishes" },
      manipura: { ru: "Общая воля: как вы решаете и действуете", en: "Your shared will: how you decide and act" },
      anahata: { ru: "Забота друг о друге: нежность, поддержка, принятие", en: "Caring for each other: tenderness, support, acceptance" },
      vishuddha: { ru: "Ваше слово: разговор, споры, обещания", en: "Your word: talk, arguments, promises" },
      ajna: { ru: "Общий взгляд: как вы понимаете происходящее", en: "Your shared view: how you make sense of things" },
      sahasrara: { ru: "Что вас вдохновляет: смысл больше вас двоих", en: "What inspires you: a meaning bigger than the two of you" },
      energy_field: { ru: "Общий тон союза", en: "The overall tone of your union" },
    },
    reduction: {
      ru: "Если число больше 22, складываем его цифры. Итог колонки — свёрнутая сумма её семи чисел; если сумма ровно 100, получается 10: единицы в паре не бывает.",
      en: "If a number is above 22, its digits are added. A column total is the reduced sum of its seven numbers; a sum of exactly 100 gives 10, because a couple never has a 1.",
    } satisfies Phrase,
  },

  allLead: { ru: "Сфера · числа · значение", en: "Sphere · numbers · meaning" } satisfies Phrase,
  colSphere: { ru: "Сфера", en: "Sphere" } satisfies Phrase,
  colNumbers: { ru: "Числа", en: "Numbers" } satisfies Phrase,
  colMeaning: { ru: "Значение", en: "Meaning" } satisfies Phrase,
  colPoint: { ru: "Точка", en: "Point" } satisfies Phrase,
  colCouple: { ru: "Пара", en: "Couple" } satisfies Phrase,
  readingTitle: { ru: "Расшифровка пары", en: "The couple's reading" } satisfies Phrase,
  openCount: { ru: (n: number) => `Разбор открыт · сфер: ${n}`, en: (n: number) => `Reading unlocked · ${n} spheres` } satisfies PhraseFn<[number]>,
  freeCount: {
    ru: (open: number, locked: number) => `Открыто разделов: ${open} · под замком: ${locked}`,
    en: (open: number, locked: number) => `${open} sections open · ${locked} locked`,
  } satisfies PhraseFn<[number, number]>,
  unlock: { ru: "Открыть", en: "Unlock" } satisfies Phrase,
  ctaTitle: { ru: "Полный разбор пары", en: "Full couple reading" } satisfies Phrase,
  ctaText: {
    ru: (n: number) => `Ещё ${n} сфер, толкование чакр пары и PDF.`,
    en: (n: number) => `${n} more spheres, a reading of the couple's chakras and a PDF.`,
  } satisfies PhraseFn<[number]>,
  buy: { ru: (price: string) => `Купить разбор пары — ${price}`, en: (price: string) => `Buy the couple reading — ${price}` } satisfies PhraseFn<[string]>,
  buyNoPrice: { ru: "Купить разбор пары", en: "Buy the couple reading" } satisfies Phrase,
  exampleCta: {
    ru: "Это пример. Введите две даты рождения — разбор пересчитается для вашей пары.",
    en: "This is an example. Enter two dates of birth and the reading will be recalculated for your couple.",
  } satisfies Phrase,
  exampleButton: { ru: "Ввести свои даты", en: "Enter your dates" } satisfies Phrase,
  saveToAccount: { ru: "Сохранить в кабинет", en: "Save to my account" } satisfies Phrase,
  openFull: { ru: "Открыть полный разбор", en: "Open the full reading" } satisfies Phrase,
  opening: { ru: "Открываем…", en: "Opening…" } satisfies Phrase,
  openFailed: { ru: "Не удалось открыть разбор. Попробуйте ещё раз.", en: "The reading could not be opened. Try again." } satisfies Phrase,
  stub: { ru: "Текст этого раздела готовится.", en: "The text of this section is being prepared." } satisfies Phrase,
  amplified: {
    ru: (name: string, points: string) => `Карта «${name}» есть и в этом разделе, и в дополнительных точках матрицы пары: ${points}. В методике пары такое совпадение усиливает тему раздела.`,
    en: (name: string, points: string) => `The “${name}” card appears both in this section and at additional points of the couple’s matrix: ${points}. In the couple’s method, this match reinforces the section’s theme.`,
  } satisfies PhraseFn<[string, string]>,
  amplifierPoint: {
    H: { ru: "H — нижний правый угол", en: "H — bottom-right corner" } satisfies Phrase,
    I: { ru: "I — нижний левый угол", en: "I — bottom-left corner" } satisfies Phrase,
  },
  inEncyclopedia: { ru: (name: string) => `«${name}» в энциклопедии`, en: (name: string) => `“${name}” in the encyclopedia` } satisfies PhraseFn<[string]>,
  inCompatibility: { ru: (name: string) => `«${name}» в совместимости`, en: (name: string) => `“${name}” in compatibility` } satisfies PhraseFn<[string]>,
  // Links from the reading to encyclopedia articles about the same sphere.
  article: {
    tasks: { ru: "Как считается и читается кармический хвост пары →", en: "How a couple's karmic tail is calculated and read →" } satisfies Phrase,
    atmosphere: { ru: "Центр совместимости: какие арканы бывают в центре пары →", en: "The centre of compatibility: which arcana a couple's centre holds →" } satisfies Phrase,
    business: { ru: "Как считается совместимость в работе →", en: "How business compatibility is calculated →" } satisfies Phrase,
    characters: { ru: "Как устроена совместимость характеров →", en: "How compatibility of characters works →" } satisfies Phrase,
  },
  byYourPair: { ru: "По вашей паре", en: "From your couple" } satisfies Phrase,
  tailArticle: { ru: "Что значит хвост вашей пары", en: "What your couple's tail means" } satisfies Phrase,
  moreTail: {
    ru: (key: string) => `Читать полную статью про кармический хвост пары ${key} в энциклопедии →`,
    en: (key: string) => `Read the full article on the couple's karmic tail ${key} in the encyclopedia →`,
  } satisfies PhraseFn<[string]>,
  tailPersonal: {
    ru: (key: string) => `Хвост ${key.replaceAll("-", " ")} в личной матрице судьбы →`,
    en: (key: string) => `The ${key.replaceAll("-", " ")} tail in a personal destiny matrix →`,
  } satisfies PhraseFn<[string]>,
  subFull: {
    ru: (who: string, open: number, total: number) => `${who} · открыто ${open} из ${total} разделов`,
    en: (who: string, open: number, total: number) => `${who} · ${open} of ${total} sections open`,
  } satisfies PhraseFn<[string, number, number]>,
  pdfTitle: { ru: (who: string) => `Совместимость: ${who}`, en: (who: string) => `Compatibility: ${who}` } satisfies PhraseFn<[string]>,
  savedTitle: { ru: "Разбор пары", en: "Couple reading" } satisfies Phrase,
  savedDescription: { ru: "Сохранённый разбор совместимости.", en: "Saved compatibility reading." } satisfies Phrase,
  kind: { ru: "Совместимость", en: "Compatibility" } satisfies Phrase,
  calcLink: { ru: "Посчитать совместимость", en: "Calculate compatibility" } satisfies Phrase,
  openPair: { ru: "Открыть разбор", en: "Open the reading" } satisfies Phrase,
  merged: { ru: "пересчёт из сумм пары", en: "recalculated from the couple's sums" } satisfies Phrase,

  sphere: {
    meet: {
      title: { ru: "Ради чего встретились", en: "Why you met" } satisfies Phrase,
      lead: { ru: "Зачем вы друг другу и что вам вместе создать.", en: "What you are to each other and what to create together." } satisfies Phrase,
    },
    atmosphere: {
      title: { ru: "Атмосфера внутри пары", en: "The atmosphere inside the couple" } satisfies Phrase,
      lead: { ru: "Что происходит между вами, когда никто не смотрит.", en: "What happens between you when nobody is watching." } satisfies Phrase,
    },
    characters: {
      title: { ru: "Совместимость характеров", en: "Compatibility of characters" } satisfies Phrase,
      lead: { ru: "Узнаёт ли каждый из вас себя в карте другого.", en: "Whether each of you recognises yourself in the other's chart." } satisfies Phrase,
    },
    image: {
      title: { ru: "Какой пару видят другие", en: "How others see the couple" } satisfies Phrase,
      lead: { ru: "Каким ваш союз видят друзья, родные и коллеги.", en: "How friends, family and colleagues see your union." } satisfies Phrase,
    },
    fills: {
      title: { ru: "Что наполняет союз", en: "What fills the union" } satisfies Phrase,
      lead: { ru: "Что возвращает паре силы после трудных периодов.", en: "What restores the couple's strength after hard times." } satisfies Phrase,
    },
    material: {
      title: { ru: "Отношение к материальному", en: "Attitude to material things" } satisfies Phrase,
      lead: { ru: "Дом, вещи, траты и накопления.", en: "Home, things, spending and savings." } satisfies Phrase,
    },
    money: {
      title: { ru: "Деньги пары", en: "The couple's money" } satisfies Phrase,
      lead: { ru: "Откуда приходит достаток и где он утекает.", en: "Where prosperity comes from and where it leaks." } satisfies Phrase,
    },
    relations: {
      title: { ru: "Отношения и общий язык", en: "Relationship and common language" } satisfies Phrase,
      lead: { ru: "Как вы договариваетесь и что вас соединяет.", en: "How you agree and what connects you." } satisfies Phrase,
    },
    parents: {
      title: { ru: "Пара как родители", en: "The couple as parents" } satisfies Phrase,
      lead: {
        ru: "Какие вы вместе в роли старших — для своих детей, если они есть или будут, и для всех, о ком вы заботитесь.",
        en: "What you are like together as elders — for your children, if you have or will have them, and for everyone you care for.",
      } satisfies Phrase,
    },
    tasks: {
      title: { ru: "Кармический хвост пары", en: "The couple's karmic tail" } satisfies Phrase,
      lead: { ru: "Задачи пары: чему вам вдвоём предстоит научиться.", en: "The couple's tasks: what the two of you have to learn." } satisfies Phrase,
    },
    spoils: {
      title: { ru: "Что может испортить", en: "What can spoil it" } satisfies Phrase,
      lead: { ru: "Из-за чего у вас случаются серьёзные ссоры.", en: "What causes serious quarrels between you." } satisfies Phrase,
    },
    values: {
      title: { ru: "Ценности пары", en: "The couple's values" } satisfies Phrase,
      lead: { ru: "Ради чего существует ваш союз.", en: "What your union exists for." } satisfies Phrase,
    },
  },

  role: {
    image: { ru: "Образ пары", en: "Image of the couple" } satisfies Phrase,
    create: { ru: "Что создать вместе", en: "What to create together" } satisfies Phrase,
    atmosphere: { ru: "Атмосфера", en: "Atmosphere" } satisfies Phrase,
    seen: { ru: "Каким вас видят", en: "How you are seen" } satisfies Phrase,
    fills: { ru: "Что наполняет", en: "What fills" } satisfies Phrase,
    material: { ru: "Быт и вещи", en: "Home and things" } satisfies Phrase,
    moneyIn: { ru: "Вход в деньги", en: "Way into money" } satisfies Phrase,
    moneyPath: { ru: "Путь к достатку", en: "Path to prosperity" } satisfies Phrase,
    moneyLeak: { ru: "Где утекает", en: "Where it leaks" } satisfies Phrase,
    success: { ru: "Успехи и союз", en: "Success and the union" } satisfies Phrase,
    connects: { ru: "Что соединяет", en: "What connects" } satisfies Phrase,
    language: { ru: "Общий язык", en: "Common language" } satisfies Phrase,
    parents: { ru: "Родители вместе", en: "Parents together" } satisfies Phrase,
    teach: { ru: "Чему учите", en: "What you teach" } satisfies Phrase,
    taskIn: { ru: "Вход в задачу", en: "Entry to the task" } satisfies Phrase,
    taskMid: { ru: "Середина задачи", en: "Middle of the task" } satisfies Phrase,
    task: { ru: "Главная задача", en: "Main task" } satisfies Phrase,
    spoils: { ru: "Где искрит", en: "Where it sparks" } satisfies Phrase,
    values: { ru: "Ценности", en: "Values" } satisfies Phrase,
    tasks: { ru: "Кармический хвост пары", en: "The couple's karmic tail" } satisfies Phrase,
    character: { ru: "Основа характера", en: "Core of character" } satisfies Phrase,
    wishes: { ru: "Желания", en: "Wishes" } satisfies Phrase,
  },

  summary: {
    meet: { ru: "Зачем вы вместе", en: "Why you are together" } satisfies Phrase,
    atmosphere: { ru: "Что между вами", en: "What is between you" } satisfies Phrase,
    characters: { ru: "Характеры", en: "Characters" } satisfies Phrase,
    tasks: { ru: "Чему учиться", en: "What to learn" } satisfies Phrase,
    values: { ru: "Ради чего союз", en: "What the union is for" } satisfies Phrase,
  },

  characterBoth: {
    ru: (name: string) => `В основе характера у вас обоих одна карта — ${name}, и каждый находит её в карте другого.`,
    en: (name: string) => `You both have the same card at the core of your character — ${name}, and each finds it in the other's chart.`,
  } satisfies PhraseFn<[string]>,
  characterOne: {
    ru: (name: string) => `Основа характера одного из вас — ${name}, и она звучит в карте другого.`,
    en: (name: string) => `The core of one partner's character is ${name}, and it sounds in the other's chart.`,
  } satisfies PhraseFn<[string]>,
  wishesOne: {
    ru: (name: string) => `Желания одного из вас отражены в карте другого: аркан «${name}».`,
    en: (name: string) => `One partner's wishes sound in the other's chart through ${name}.`,
  } satisfies PhraseFn<[string]>,

  merge: {
    E: { ru: "Центр", en: "Centre" } satisfies Phrase,
    A: { ru: "День", en: "Day" } satisfies Phrase,
    B: { ru: "Месяц", en: "Month" } satisfies Phrase,
    D: { ru: "Хвост, низ", en: "Tail, bottom" } satisfies Phrase,
    N: { ru: "Хвост, середина", en: "Tail, middle" } satisfies Phrase,
    M: { ru: "Хвост, верх", en: "Tail, top" } satisfies Phrase,
  },
};
