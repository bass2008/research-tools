import type { Phrase, PhraseFn } from "./index";

/** Шаблоны персональных разборов: у языков разный порядок слов, поэтому фраза целиком. */
export const characterReading = {
  roleDay: { ru: "Портрет личности", en: "Personality portrait" } satisfies Phrase,
  roleDayQuestion: {
    ru: "Как вас считывают люди и с чего вы начинаете контакт",
    en: "How people read you and how you start contact",
  } satisfies Phrase,
  roleMonth: { ru: "Духовная задача", en: "Spiritual task" } satisfies Phrase,
  roleMonthQuestion: {
    ru: "Что включается изнутри и требует зрелого применения",
    en: "What switches on from the inside and asks to be used with maturity",
  } satisfies Phrase,
  roleYear: { ru: "Материальная задача", en: "Material task" } satisfies Phrase,
  roleYearQuestion: {
    ru: "Как внутреннее качество становится поступком и результатом",
    en: "How an inner quality turns into an action and a result",
  } satisfies Phrase,
  summaryOne: {
    ru: (a: number, b: number, c: number, title: string) =>
      `В тройке ${a}–${b}–${c} одна тема проходит через весь характер. ${title} определяет и `
      + "первое впечатление, и внутреннюю задачу, и способ действовать. Это даёт цельность, но "
      + "требует особенно внимательно следить за теневой стороной аркана.",
    en: (a: number, b: number, c: number, title: string) =>
      `In the triple ${a}–${b}–${c} one theme runs through the whole character. ${title} sets the `
      + "first impression, the inner task and the way of acting alike. That gives wholeness, but "
      + "it also asks you to watch the shadow side of the arcanum especially closely.",
  } satisfies PhraseFn<[number, number, number, string]>,
  summaryTwo: {
    ru: (a: number, b: number, c: number, repeated: string, single: string) =>
      `В тройке ${a}–${b}–${c} тема ${repeated} звучит дважды, поэтому она становится основной `
      + `привычкой характера. ${single} не отменяет её, а показывает место, где привычный способ `
      + "приходится дополнять другим качеством.",
    en: (a: number, b: number, c: number, repeated: string, single: string) =>
      `In the triple ${a}–${b}–${c} the theme of ${repeated} sounds twice, so it becomes the main `
      + `habit of the character. ${single} does not cancel it but shows the place where the usual `
      + "way has to be complemented by another quality.",
  } satisfies PhraseFn<[number, number, number, string, string]>,
  summaryThree: {
    ru: (a: number, b: number, c: number, at: string, bt: string, ct: string) =>
      `Тройка ${a}–${b}–${c} соединяет три разные задачи: ${at} задаёт первое впечатление, `
      + `${bt} работает изнутри, а ${ct} проверяет характер поступками. Цельность здесь появляется `
      + "не из одинаковых качеств, а из умения переводить одно в другое.",
    en: (a: number, b: number, c: number, at: string, bt: string, ct: string) =>
      `The triple ${a}–${b}–${c} joins three different tasks: ${at} sets the first impression, `
      + `${bt} works from the inside, and ${ct} tests the character through actions. Wholeness here `
      + "comes not from identical qualities but from the ability to translate one into another.",
  } satisfies PhraseFn<[number, number, number, string, string, string]>,
  strength: {
    ru: (a: string, b: string, c: string) =>
      `Главная сила тройки проявляется, когда человек одновременно ${a}, ${b} и в практических `
      + `решениях ${c}. Тогда внешний образ не расходится с внутренним мотивом, а обещанное `
      + "подтверждается поступком.",
    en: (a: string, b: string, c: string) =>
      `The main strength of the triple shows when a person at once ${a}, ${b} and, in practical `
      + `decisions, ${c}. Then the outer image does not diverge from the inner motive, and what was `
      + "promised is confirmed by an action.",
  } satisfies PhraseFn<[string, string, string]>,
  tension: {
    ru: (a: string, b: string, c: string) =>
      `На внешнем уровне риск выглядит так: человек ${a}. Изнутри напряжение проявляется, когда `
      + `человек ${b}. В материальных решениях напряжение закрепляется, когда человек ${c}. Это не `
      + "три приговора, а три места, где один и тот же жизненный эпизод можно проверить по фактам.",
    en: (a: string, b: string, c: string) =>
      `On the outer level the risk looks like this: a person ${a}. From the inside the tension shows `
      + `when a person ${b}. In material decisions the tension settles in when a person ${c}. These `
      + "are not three verdicts but three places where one and the same episode of life can be "
      + "checked against the facts.",
  } satisfies PhraseFn<[string, string, string]>,
  practice: {
    ru: (c: string) =>
      "Возьмите одну повторяющуюся ситуацию ближайшей недели и ответьте письменно на три вопроса: "
      + "какое впечатление я произвожу, чего на самом деле хочу и какой поступок это подтвердит. "
      + `Начать лучше с сильной стороны позиции C: человек ${c}. После действия сравните результат `
      + "с первоначальным образом — так тройка становится рабочим наблюдением, а не набором ярлыков.",
    en: (c: string) =>
      "Take one situation that repeats in the coming week and answer three questions in writing: "
      + "what impression do I make, what do I actually want, and which action will confirm it. "
      + `It is better to start from the strong side of position C: a person ${c}. After you act, `
      + "compare the result with the original image — that turns the triple into a working "
      + "observation rather than a set of labels.",
  } satisfies PhraseFn<[string]>,
};

export const characterLinks = {
  abTitle: { ru: "Внешний образ и внутренняя задача", en: "Outer image and inner task" } satisfies Phrase,
  abQuestion: {
    ru: "Эта связь показывает, совпадает ли первое впечатление с тем, что движет человеком изнутри.",
    en: "This link shows whether the first impression matches what drives the person from within.",
  } satisfies Phrase,
  bcTitle: { ru: "От внутреннего качества к поступку", en: "From an inner quality to an action" } satisfies Phrase,
  bcQuestion: {
    ru: "Эта связь показывает, насколько естественно внутренняя задача превращается в практическое действие.",
    en: "This link shows how naturally the inner task turns into a practical action.",
  } satisfies Phrase,
  acTitle: { ru: "Обещание образа и реальное поведение", en: "The promise of the image and the real behaviour" } satisfies Phrase,
  acQuestion: {
    ru: "Эта связь сверяет то, чего люди ждут по первому впечатлению, с тем, как человек действует на деле.",
    en: "This link checks what people expect from the first impression against how the person actually acts.",
  } satisfies Phrase,
  repeatAll: {
    ru: (title: string) => `${title} во всех трёх ролях`,
    en: (title: string) => `${title} in all three roles`,
  } satisfies PhraseFn<[string]>,
  repeatSome: {
    ru: (title: string, where: string) => `${title} повторяется: позиции ${where}`,
    en: (title: string, where: string) => `${title} repeats: positions ${where}`,
  } satisfies PhraseFn<[string, string]>,
  repeatAllText: {
    ru: (arcanum: number) => `Один и тот же ${arcanum} аркан задаёт внешний образ, внутреннюю и `
      + "материальную задачи. Характер получается собранным вокруг одной темы: разные части "
      + "личности не спорят о направлении, но усиливают цену любого перекоса.",
    en: (arcanum: number) => `One and the same arcanum ${arcanum} sets the outer image, the inner `
      + "task and the material one. The character gathers around a single theme: the parts of the "
      + "personality do not argue about direction, but they raise the price of any imbalance.",
  } satisfies PhraseFn<[number]>,
  repeatSomeText: {
    ru: (arcanum: number, where: string) => `Один и тот же ${arcanum} аркан стоит в позициях `
      + `${where}. Повтор не добавляет второй независимый сюжет: он делает одну тему заметнее и `
      + "переносит её сразу между несколькими слоями характера.",
    en: (arcanum: number, where: string) => `One and the same arcanum ${arcanum} stands in positions `
      + `${where}. The repetition does not add a second independent storyline: it makes one theme `
      + "more visible and carries it across several layers of the character at once.",
  } satisfies PhraseFn<[number, string]>,
  pairTwice: {
    ru: (left: string, right: string) => `${left} и ${right} сразу в двух связях`,
    en: (left: string, right: string) => `${left} and ${right} in two links at once`,
  } satisfies PhraseFn<[string, string]>,
  pairTwiceText: {
    ru: (a: number, b: number) => `Одна и та же пара ${a}–${b} связывает сразу несколько ролей. `
      + "Общий сюжет пары читается один раз, а позиционные варианты ниже показывают каждый переход отдельно.",
    en: (a: number, b: number) => `One and the same pair ${a}–${b} links several roles at once. `
      + "The shared storyline is read once, and the positional variants below show each transition separately.",
  } satisfies PhraseFn<[number, number]>,
  pairLink: {
    ru: (key: string) => `Подробнее про сочетание ${key} аркана в энциклопедии →`,
    en: (key: string) => `More about the combination ${key} in the encyclopedia →`,
  } satisfies PhraseFn<[string]>,
  title: {
    ru: (slug: string, a: string, b: string, c: string) => `Характер ${slug}: ${a}, ${b} и ${c}`,
    en: (slug: string, a: string, b: string, c: string) => `Character ${slug}: ${a}, ${b} and ${c}`,
  } satisfies PhraseFn<[string, string, string, string]>,
  lead: {
    ru: "Персональный разбор трёх исходных точек матрицы: A отвечает за портрет личности, B — за "
      + "духовную задачу, C — за материальное проявление характера.",
    en: "A personal reading of the three starting points of the matrix: A stands for the "
      + "personality portrait, B for the spiritual task and C for how the character shows in matter.",
  } satisfies Phrase,
  rolesTitle: { ru: "Три слоя характера", en: "The three layers of the character" } satisfies Phrase,
  rolesLead: {
    ru: "Каждая точка отвечает на свой вопрос. Поэтому один аркан нельзя назначить «главным», а "
      + "остальные считать дополнениями: внешний образ, внутренний мотив и действие работают одновременно.",
    en: "Each point answers its own question. That is why no arcanum can be named “the main one” "
      + "while the others are treated as additions: the outer image, the inner motive and the "
      + "action work at the same time.",
  } satisfies Phrase,
  interactionsTitle: { ru: "Как арканы работают вместе", en: "How the arcana work together" } satisfies Phrase,
  interactionsLead: {
    ru: "Сначала читаются три роли, затем связи между ними. Если числовая пара повторяется, её "
      + "смысл не дублируется: один сюжет рассматривается сразу в нескольких переходах.",
    en: "First the three roles are read, then the links between them. If a pair of numbers repeats, "
      + "its meaning is not duplicated: one storyline is examined across several transitions at once.",
  } satisfies Phrase,
};

export const comfort = {
  centerLabel: { ru: "Базовое состояние", en: "Basic state" } satisfies Phrase,
  centerQuestion: {
    ru: "В каком состоянии человеку проще чувствовать себя собой и сохранять опору",
    en: "In which state it is easier to feel like yourself and keep your footing",
  } satisfies Phrase,
  reactionLabel: { ru: "Автоматическая реакция", en: "Automatic reaction" } satisfies Phrase,
  reactionQuestion: {
    ru: "Что включается первым в отношениях, напряжении и знакомых повторяющихся сюжетах",
    en: "What switches on first in relationships, in tension and in familiar repeating storylines",
  } satisfies Phrase,
  talentLabel: { ru: "Талант, возвращающий управление", en: "The talent that gives control back" } satisfies Phrase,
  talentQuestion: {
    ru: "Какое качество помогает выйти из автоматической реакции и снова действовать осознанно",
    en: "Which quality helps you leave the automatic reaction and act consciously again",
  } satisfies Phrase,
  sameAll: {
    ru: (slug: string) => `В последовательности ${slug} один аркан проходит через все роли раздела. `
      + "Это делает тему цельной и заметной, но особенно усиливает риск действовать одним способом "
      + "там, где вопросы у точек разные.",
    en: (slug: string) => `In the sequence ${slug} one arcanum runs through every role of the section. `
      + "That makes the theme whole and visible, but it also increases the risk of acting the same "
      + "way where the points ask different questions.",
  } satisfies PhraseFn<[string]>,
  repeated: {
    ru: (slug: string, title: string, count: number, contrast: string) =>
      `В последовательности ${slug} тема ${title} звучит ${count} раза и становится привычным `
      + `способом проходить раздел. ${contrast}`,
    en: (slug: string, title: string, count: number, contrast: string) =>
      `In the sequence ${slug} the theme of ${title} sounds ${count} times and becomes the usual `
      + `way of going through the section. ${contrast}`,
  } satisfies PhraseFn<[string, string, number, string]>,
  contrastWith: {
    ru: (title: string) => `${title} показывает место, где этот способ нужно дополнить другим `
      + "качеством, а не повторить ещё раз.",
    en: (title: string) => `${title} shows the place where this way has to be complemented by `
      + "another quality rather than repeated once more.",
  } satisfies PhraseFn<[string]>,
  contrastNone: {
    ru: "Роли всё равно отвечают на разные вопросы и не сливаются в одну.",
    en: "The roles still answer different questions and do not merge into one.",
  } satisfies Phrase,
  summary: {
    ru: (a: number, b: number, c: number, at: string, bt: string, ct: string) =>
      `Тройка ${a}–${b}–${c} описывает внутренний цикл: ${at} задаёт базовое состояние, ${bt} `
      + `включается как первая реакция, а ${ct} показывает качество, через которое проще вернуть управление.`,
    en: (a: number, b: number, c: number, at: string, bt: string, ct: string) =>
      `The triple ${a}–${b}–${c} describes an inner cycle: ${at} sets the basic state, ${bt} `
      + `switches on as the first reaction, and ${ct} shows the quality that makes it easier to take control back.`,
  } satisfies PhraseFn<[number, number, number, string, string, string]>,
  strength: {
    ru: (first: string, middle: string, last: string) =>
      `Опора тройки появляется, когда в базовом состоянии ${first}, в первой реакции ${middle}, `
      + `а для возвращения к себе ${last}.`,
    en: (first: string, middle: string, last: string) =>
      `The triple finds its footing when in the basic state ${first}, in the first reaction `
      + `${middle}, and to come back to yourself ${last}.`,
  } satisfies PhraseFn<[string, string, string]>,
  tension: {
    ru: (first: string, middle: string, last: string) =>
      `Цикл уводит от центра, когда ${first}; затем автоматически ${middle}; а попытка `
      + `восстановиться закрепляет перекос, если он ${last}. Эти признаки полезно проверять по `
      + "одной реальной ситуации, а не принимать за постоянные качества.",
    en: (first: string, middle: string, last: string) =>
      `The cycle leads away from the centre when ${first}; then automatically ${middle}; and the `
      + `attempt to recover locks the imbalance in if it ${last}. These signs are worth checking `
      + "against one real situation rather than taking them as permanent qualities.",
  } satisfies PhraseFn<[string, string, string]>,
  practice: {
    ru: (action: string) => "При следующей сильной реакции сделайте короткую паузу и назовите три "
      + "вещи: что было моей опорой до события, что я сделал автоматически и какое действие "
      + `позиции K вернёт управление. Начните с подсказки: ${action}`,
    en: (action: string) => "At the next strong reaction take a short pause and name three things: "
      + "what was my footing before the event, what I did automatically, and which action of "
      + `position K will give control back. Start from the hint: ${action}`,
  } satisfies PhraseFn<[string]>,
};
