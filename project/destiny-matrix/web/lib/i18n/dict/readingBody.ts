import type { Phrase, PhraseFn } from "./index";

/** Тело персонального разбора: переходы, повторы, синтезы и карта чакр. */
export const readingBody = {
  decadeEdgeTitle: {
    ru: (age: number) => `Переход ${age} лет`,
    en: (age: number) => `The transition at ${age}`,
  } satisfies PhraseFn<[number]>,
  decadeEdgeQuestion: {
    ru: "Как тема одного десятилетия готовит следующий возрастной этап.",
    en: "How the theme of one decade prepares the next stage of life.",
  } satisfies Phrase,
  repeatAllTitle: {
    ru: (title: string) => `${title} во всех ролях`,
    en: (title: string) => `${title} in every role`,
  } satisfies PhraseFn<[string]>,
  repeatSomeTitle: {
    ru: (title: string, roles: string) => `${title} повторяется: позиции ${roles}`,
    en: (title: string, roles: string) => `${title} repeats: positions ${roles}`,
  } satisfies PhraseFn<[string, string]>,
  repeatAllText: {
    ru: (arcanum: number) => `Один и тот же ${arcanum} аркан проходит через весь раздел. Роли не `
      + "сливаются: каждая отвечает на свой вопрос, но одна тема становится особенно заметной и в "
      + "ресурсе, и в риске.",
    en: (arcanum: number) => `One and the same arcanum ${arcanum} runs through the whole section. `
      + "The roles do not merge: each answers its own question, but one theme becomes especially "
      + "visible both in the resource and in the risk.",
  } satisfies PhraseFn<[number]>,
  repeatSomeText: {
    ru: (arcanum: number, roles: string) => `Один и тот же ${arcanum} аркан стоит в позициях `
      + `${roles}. Это не два независимых сюжета, а усиленная тема, которая проявляется сразу в `
      + "нескольких звеньях раздела.",
    en: (arcanum: number, roles: string) => `One and the same arcanum ${arcanum} stands in positions `
      + `${roles}. These are not two independent storylines but one reinforced theme showing in `
      + "several links of the section at once.",
  } satisfies PhraseFn<[number, string]>,
  edgeAgreed: {
    ru: (question: string, leftLabel: string, rightLabel: string, leftStrength: string, rightStrength: string) =>
      `${question} В согласованном переходе «${leftLabel} → ${rightLabel}» первое качество создаёт `
      + `условие: ${leftStrength}; второе переводит его дальше: ${rightStrength}.`,
    en: (question: string, leftLabel: string, rightLabel: string, leftStrength: string, rightStrength: string) =>
      `${question} In a transition that is in tune, “${leftLabel} → ${rightLabel}”, the first `
      + `quality creates the condition: ${leftStrength}; the second carries it further: ${rightStrength}.`,
  } satisfies PhraseFn<[string, string, string, string, string]>,
  edgeTension: {
    ru: (leftKey: string, leftRisk: string, rightKey: string, rightRisk: string) =>
      `Напряжение заметно так: в позиции ${leftKey} — ${leftRisk}; в позиции ${rightKey} — `
      + `${rightRisk}. Это не конфликт арканов, а место, где важно сменить способ действия.`,
    en: (leftKey: string, leftRisk: string, rightKey: string, rightRisk: string) =>
      `The tension shows like this: at position ${leftKey} — ${leftRisk}; at position ${rightKey} `
      + `— ${rightRisk}. This is not a conflict of arcana but the place where the way of acting has to change.`,
  } satisfies PhraseFn<[string, string, string, string]>,
  edgePractice: {
    ru: (leftKey: string, leftAction: string, rightKey: string, rightAction: string) =>
      "Практический переход начинается не с попытки проявить оба аркана сразу. Сначала проверьте "
      + `действие ${leftKey}: ${leftAction} Затем добавьте действие ${rightKey}: ${rightAction}`,
    en: (leftKey: string, leftAction: string, rightKey: string, rightAction: string) =>
      "A practical transition does not start with trying to show both arcana at once. First test "
      + `the action of ${leftKey}: ${leftAction} Then add the action of ${rightKey}: ${rightAction}`,
  } satisfies PhraseFn<[string, string, string, string]>,
  pairManyTitle: {
    ru: (left: string, right: string, count: number) => `${left} и ${right} сразу в ${count} связях`,
    en: (left: string, right: string, count: number) => `${left} and ${right} in ${count} links at once`,
  } satisfies PhraseFn<[string, string, number]>,
  pairManyText: {
    ru: (a: number, b: number) => `Пара ${a}–${b} соединяет несколько ролей. Общий смысл читается `
      + "один раз, а позиционные переходы показывают разные задачи этой связи.",
    en: (a: number, b: number) => `The pair ${a}–${b} joins several roles. The shared meaning is `
      + "read once, and the positional transitions show the different tasks of this link.",
  } satisfies PhraseFn<[number, number]>,
  pairLink: {
    ru: (key: string) => `Подробнее про сочетание ${key} аркана в энциклопедии →`,
    en: (key: string) => `More about the combination ${key} in the encyclopedia →`,
  } satisfies PhraseFn<[string]>,
  synthesisIntro: {
    ru: (question: string, labels: string, target: string) => `${question} Исходные роли читаются `
      + `вместе: ${labels}. Итог «${target}» не заменяет их, а показывает результат их совместной работы.`,
    en: (question: string, labels: string, target: string) => `${question} The original roles are `
      + `read together: ${labels}. The total “${target}” does not replace them but shows the result of their joint work.`,
  } satisfies PhraseFn<[string, string, string]>,
  synthesisAgreed: {
    ru: (strengths: string, targetKey: string, targetStrength: string) =>
      `Согласованный переход начинается с двух условий — ${strengths}. В роли ${targetKey} они `
      + `складываются в качество: ${targetStrength}.`,
    en: (strengths: string, targetKey: string, targetStrength: string) =>
      `A transition that is in tune starts from two conditions — ${strengths}. In the role `
      + `${targetKey} they add up to one quality: ${targetStrength}.`,
  } satisfies PhraseFn<[string, string, string]>,
  synthesisGap: {
    ru: (risks: string, targetRisk: string) => `Разрыв возникает, если один из источников выпадает: `
      + `${risks}. Тогда итог проявляется через риск: ${targetRisk}.`,
    en: (risks: string, targetRisk: string) => `A gap appears if one of the sources drops out: `
      + `${risks}. Then the total shows through the risk: ${targetRisk}.`,
  } satisfies PhraseFn<[string, string]>,
  synthesisPractice: {
    ru: (actions: string, targetKey: string, targetAction: string) =>
      `Практическая проверка идёт в том же порядке. Сначала исходные роли: ${actions} Затем `
      + `действие итога ${targetKey}: ${targetAction}`,
    en: (actions: string, targetKey: string, targetAction: string) =>
      `The practical check goes in the same order. First the original roles: ${actions} Then the `
      + `action of the total ${targetKey}: ${targetAction}`,
  } satisfies PhraseFn<[string, string, string]>,
  // карта чакр
  columnPhysics: { ru: "физики", en: "physics" } satisfies Phrase,
  columnEnergy: { ru: "энергии", en: "energy" } satisfies Phrase,
  columnEmotions: { ru: "эмоций", en: "emotions" } satisfies Phrase,
  wherePhysics: {
    ru: ["в материальном ритме", "в наблюдаемом распорядке"],
    en: ["in the material rhythm", "in the routine you can observe"],
  } satisfies Record<"ru" | "en", string[]>,
  whereEnergy: {
    ru: ["в распределении усилия", "в выборе, куда направлять внимание"],
    en: ["in how effort is distributed", "in the choice of where to put attention"],
  } satisfies Record<"ru" | "en", string[]>,
  whereEmotions: {
    ru: ["в эмоциональном отклике", "в способе замечать и выражать переживание"],
    en: ["in the emotional response", "in the way feeling is noticed and expressed"],
  } satisfies Record<"ru" | "en", string[]>,
  chakraModifier: {
    ru: (title: string, where: string, plus: string, minus: string) =>
      `${title} ${where} проявляется через качество «${plus}»; перегрузка заметна по тенденции «${minus}».`,
    en: (title: string, where: string, plus: string, minus: string) =>
      `${title} ${where} shows through the quality “${plus}”; an overload is visible in the tendency “${minus}”.`,
  } satisfies PhraseFn<[string, string, string, string]>,
  chakraAction: {
    ru: (where: string, action: string) => `Для наблюдения ${where} используйте шаг: ${action}`,
    en: (where: string, action: string) => `To observe ${where}, use this step: ${action}`,
  } satisfies PhraseFn<[string, string]>,
  levelsTitle: { ru: "Ведущий и ресурсный уровни", en: "The leading and the resource levels" } satisfies Phrase,
  levelsCaption: {
    ru: (high: string, low: string) => `Уровни ${high}–${low}`,
    en: (high: string, low: string) => `Levels ${high}–${low}`,
  } satisfies PhraseFn<[string, string]>,
  levelsText: {
    ru: (high: string, highScore: number, low: string, lowScore: number) =>
      `${high} набирает самый заметный суммарный акцент (${highScore}), поэтому его тема чаще `
      + `других оказывается на переднем плане. ${low} имеет самый спокойный показатель (${lowScore}) `
      + "и может служить местом для бережного, небольшого эксперимента.",
    en: (high: string, highScore: number, low: string, lowScore: number) =>
      `${high} gathers the most visible total accent (${highScore}), so its theme comes to the `
      + `foreground more often than the others. ${low} has the quietest figure (${lowScore}) and can `
      + "serve as a place for a small, careful experiment.",
  } satisfies PhraseFn<[string, number, string, number]>,
  levelsNote: {
    ru: "Максимум и минимум не означают «хорошую» и «плохую» чакру: это сравнительные акценты "
      + "внутри одной карты, а не оценка состояния организма.",
    en: "A maximum and a minimum do not mean a “good” and a “bad” chakra: these are comparative "
      + "accents inside one chart, not a judgement about the body.",
  } satisfies Phrase,
  imbalanceTitle: { ru: "Главный внутренний разрыв карты", en: "The main inner gap of the chart" } satisfies Phrase,
  imbalanceCaption: {
    ru: (row: string, high: string, low: string) => `Уровень ${row} · ${high}–${low}`,
    en: (row: string, high: string, low: string) => `Level ${row} · ${high}–${low}`,
  } satisfies PhraseFn<[string, string, string]>,
  imbalanceText: {
    ru: (row: string, high: string, highValue: number, low: string, lowValue: number, gap: number, verdict: string) =>
      `${row} даёт наибольшую разницу внутри одного уровня: ${high} — ${highValue}, ${low} — `
      + `${lowValue}, разрыв — ${gap}. ${verdict}`,
    en: (row: string, high: string, highValue: number, low: string, lowValue: number, gap: number, verdict: string) =>
      `${row} gives the largest difference inside one level: ${high} — ${highValue}, ${low} — `
      + `${lowValue}, the gap is ${gap}. ${verdict}`,
  } satisfies PhraseFn<[string, string, number, string, number, number, string]>,
  imbalanceNoticeable: {
    ru: "По правилу карты это заметный разрыв: способы проявления уровня полезно согласовывать отдельно.",
    en: "By the rule of the chart this is a noticeable gap: the ways this level shows are worth "
      + "bringing into line separately.",
  } satisfies Phrase,
  imbalanceOrdinary: {
    ru: "Разница меньше порога заметного разрыва и описывает обычную вариативность способов проявления.",
    en: "The difference is below the threshold of a noticeable gap and describes the ordinary "
      + "variety in how the level shows.",
  } satisfies Phrase,
  imbalanceNote: {
    ru: "Это сравнительный показатель внутри рассчитанной карты. Он не является медицинским выводом "
      + "и описывает только различие способов проявления.",
    en: "This is a comparative figure inside a calculated chart. It is not a medical conclusion and "
      + "describes only the difference in how the level shows.",
  } satisfies Phrase,
  columnsTitle: { ru: "Согласование трёх колонок", en: "Bringing the three columns into line" } satisfies Phrase,
  columnsCaption: {
    ru: (high: string, low: string) => `Колонки ${high}–${low}`,
    en: (high: string, low: string) => `Columns ${high}–${low}`,
  } satisfies PhraseFn<[string, string]>,
  columnsText: {
    ru: (high: string, highValue: number, low: string, lowValue: number, gap: number, verdict: string) =>
      `Среди итогов сильнее выделяется колонка ${high} (${highValue}), спокойнее — колонка ${low} `
      + `(${lowValue}). Разница ${gap} ${verdict} и показывает, насколько способы проявления требуют `
      + "сознательного согласования.",
    en: (high: string, highValue: number, low: string, lowValue: number, gap: number, verdict: string) =>
      `Among the totals the ${high} column stands out more (${highValue}), the ${low} column is `
      + `quieter (${lowValue}). The difference of ${gap} ${verdict} and shows how much the ways of `
      + "showing need conscious tuning.",
  } satisfies PhraseFn<[string, number, string, number, number, string]>,
  columnsReaches: { ru: "достигает порога заметного разрыва", en: "reaches the threshold of a noticeable gap" } satisfies Phrase,
  columnsBelow: { ru: "остаётся ниже порога заметного разрыва", en: "stays below the threshold of a noticeable gap" } satisfies Phrase,
  columnsNote: {
    ru: "Практически полезно найти одно действие, которое можно одновременно увидеть в распорядке, "
      + "поддержать вниманием и проверить по эмоциональному отклику.",
    en: "In practice it helps to find one action you can see in your routine, support with "
      + "attention and check by the emotional response, all at once.",
  } satisfies Phrase,
  repeatsTitle: { ru: "Повторы арканов в карте", en: "Repeated arcana in the chart" } satisfies Phrase,
  repeatsCaption: {
    ru: (list: string) => `Повторяющиеся арканы ${list}`,
    en: (list: string) => `Repeated arcana ${list}`,
  } satisfies PhraseFn<[string]>,
  repeatsText: {
    ru: (list: string) => `Повторяются арканы ${list}. Один смысл проходит через разные уровни и `
      + "колонки, но каждый раз отвечает на другой вопрос.",
    en: (list: string) => `The arcana ${list} repeat. One meaning runs through different levels and `
      + "columns, but each time it answers a different question.",
  } satisfies PhraseFn<[string]>,
  repeatsCount: {
    ru: (n: number, count: number) => `${n} (${count} раза)`,
    en: (n: number, count: number) => `${n} (${count} times)`,
  } satisfies PhraseFn<[number, number]>,
  repeatsNone: {
    ru: "В двадцати одной ячейке нет повторяющихся арканов: связи лучше искать через уровни и итоги "
      + "колонок, а не придумывать общий повтор.",
    en: "There are no repeated arcana among the twenty-one cells: look for links through the levels "
      + "and the column totals instead of inventing a shared repetition.",
  } satisfies Phrase,
  repeatsNote: {
    ru: "Повтор усиливает тему, но не создаёт отдельного значения и не является медицинским признаком.",
    en: "A repetition strengthens the theme but creates no separate meaning and is not a medical sign.",
  } satisfies Phrase,
};

/** Блок «те же позиции в соседнем разделе» и темы поворотных десятилетий. */
export const sharedBlock = {
  manyTitle: {
    ru: (other: string) => `Те же позиции в разделе «${other}»`,
    en: (other: string) => `The same positions in the “${other}” section`,
  } satisfies PhraseFn<[string]>,
  manyCaption: {
    ru: "Одни и те же позиции карты, два разных вопроса",
    en: "The same positions of the chart, two different questions",
  } satisfies Phrase,
  manyLeadNamed: {
    ru: (labels: string, places: string, other: string) =>
      `${labels} — это ${places}. Те же позиции читает раздел «${other}»: `,
    en: (labels: string, places: string, other: string) =>
      `${labels} are ${places}. The same positions are read by the “${other}” section: `,
  } satisfies PhraseFn<[string, string, string]>,
  manyLeadPlain: {
    ru: (labels: string, other: string) =>
      `${labels} — те же позиции, что читает и раздел «${other}»: `,
    en: (labels: string, other: string) =>
      `${labels} are the same positions the “${other}” section reads: `,
  } satisfies PhraseFn<[string, string]>,
  manyBody: {
    ru: "там они стоят в другом ряду и отвечают на другой вопрос, но значения арканов те же. "
      + "Если вы открыли оба разбора, часть текста совпадёт: это не ошибка расчёта, а одни и те же "
      + "позиции в двух рамках.",
    en: "there they stand in another row and answer another question, but the meanings of the "
      + "arcana are the same. If you have opened both readings, part of the text will coincide: "
      + "this is not a calculation error but the same positions in two frames.",
  } satisfies Phrase,
  oneTitle: {
    ru: (other: string) => `Та же позиция в разделе «${other}»`,
    en: (other: string) => `The same position in the “${other}” section`,
  } satisfies PhraseFn<[string]>,
  oneCaption: {
    ru: "Одна позиция карты, два разных вопроса",
    en: "One position of the chart, two different questions",
  } satisfies Phrase,
  aliasNamed: {
    ru: (alias: string) => `там она названа «${alias}», `,
    en: (alias: string) => `there it is called “${alias}”, `,
  } satisfies PhraseFn<[string]>,
  aliasPlain: { ru: "там она ", en: "there it " } satisfies Phrase,
  oneLeadNamed: {
    ru: (label: string, place: string, other: string, alias: string) =>
      `${label} — это ${place}. Ту же позицию читает раздел «${other}»: ${alias}`,
    en: (label: string, place: string, other: string, alias: string) =>
      `${label} is ${place}. The same position is read by the “${other}” section: ${alias}`,
  } satisfies PhraseFn<[string, string, string, string]>,
  oneLeadPlain: {
    ru: (label: string, other: string, alias: string) =>
      `${label} — та же позиция, что читает и раздел «${other}»: ${alias}`,
    en: (label: string, other: string, alias: string) =>
      `${label} is the same position the “${other}” section reads: ${alias}`,
  } satisfies PhraseFn<[string, string, string]>,
  oneBody: {
    ru: "стоит в другом ряду и отвечает на другой вопрос, но значение аркана то же. Если вы "
      + "открыли оба разбора, часть текста совпадёт: это не ошибка расчёта, а одна позиция в двух рамках.",
    en: "stands in another row and answers another question, but the meaning of the arcanum is the "
      + "same. If you have opened both readings, part of the text will coincide: this is not a "
      + "calculation error but one position in two frames.",
  } satisfies Phrase,
  openOther: {
    ru: (other: string) => `Открыть разбор «${other}» для этой матрицы →`,
    en: (other: string) => `Open the “${other}” reading for this matrix →`,
  } satisfies PhraseFn<[string]>,
  /** Своего разбора соседнего раздела по адресу нет — уводим на общую статью. */
  openGeneral: {
    ru: (other: string) => `Как читается раздел «${other}» →`,
    en: (other: string) => `How the “${other}” section is read →`,
  } satisfies PhraseFn<[string]>,
  turning: {
    ru: {
      10: "смену курса",
      13: "завершение прежнего этапа",
      16: "перестройку неработающей конструкции",
      20: "подведение итогов и новый ответ",
      21: "завершение большого цикла",
      22: "начало нового цикла",
    },
    en: {
      10: "a change of course",
      13: "the end of the previous stage",
      16: "rebuilding a construction that no longer works",
      20: "summing up and a new answer",
      21: "the end of a large cycle",
      22: "the start of a new cycle",
    },
  } satisfies Record<"ru" | "en", Record<number, string>>,
};

/** Каркас двух особых разделов: карты чакр и возрастной линии. */
export const chakraYears = {
  columnPhysicsTitle: { ru: "Физика", en: "Physics" } satisfies Phrase,
  columnEnergyTitle: { ru: "Энергия", en: "Energy" } satisfies Phrase,
  columnEmotionsTitle: { ru: "Эмоции", en: "Emotions" } satisfies Phrase,
  chakraCaption: {
    ru: "Как читается персональная карта семи уровней",
    en: "How a personal map of seven levels is read",
  } satisfies Phrase,
  chakraSummary: {
    ru: (leading: string) => `Карта соединяет семь уровней и три колонки. Ведущий акцент — `
      + `${leading}; вывод строится по значениям всех ячеек, итогам колонок, повторам и разрывам, `
      + "а не по одному максимальному числу.",
    en: (leading: string) => `The map joins seven levels and three columns. The leading accent is `
      + `${leading}; the conclusion is built from the values of all the cells, the column totals, `
      + "the repetitions and the gaps, not from one maximum number.",
  } satisfies PhraseFn<[string]>,
  chakraStrength: {
    ru: "Ресурс карты проявляется, когда материальный ритм, распределение усилия и эмоциональный "
      + "отклик проверяются вместе и ни одна колонка не объявляется главной навсегда.",
    en: "The resource of the map shows when the material rhythm, the distribution of effort and the "
      + "emotional response are checked together and no column is declared the main one forever.",
  } satisfies Phrase,
  chakraTension: {
    ru: "Дисбаланс — это заметная разница способов проявления внутри карты, а не заключение о "
      + "состоянии организма. Безопасный вывод описывает только наблюдаемое поведение.",
    en: "An imbalance is a visible difference between ways of showing inside the chart, not a "
      + "conclusion about the body. A safe conclusion describes only observable behaviour.",
  } satisfies Phrase,
  chakraPractice: {
    ru: "Выберите один уровень и в течение недели наблюдайте три колонки: что происходит в "
      + "распорядке, куда уходит усилие и какой отклик остаётся после действия. Меняйте только "
      + "один небольшой элемент за раз.",
    en: "Pick one level and watch the three columns for a week: what happens in your routine, where "
      + "effort goes and which response is left after an action. Change only one small element at a time.",
  } satisfies Phrase,
  yearsCaption: {
    ru: "Как читается персональная линия до 80 лет",
    en: "How a personal line up to 80 is read",
  } satisfies Phrase,
  returnsTitle: { ru: "Возвращение темы", en: "The return of a theme" } satisfies Phrase,
  returnsText: {
    ru: (arcanum: number, stages: string) => `${arcanum} аркан возвращается на этапах ${stages}`,
    en: (arcanum: number, stages: string) => `arcanum ${arcanum} comes back at the stages ${stages}`,
  } satisfies PhraseFn<[number, string]>,
  returnsTail: {
    ru: ". Возврат не повторяет период буквально: прежняя тема встречается с новым опытом.",
    en: ". A return does not repeat the period literally: the earlier theme meets new experience.",
  } satisfies Phrase,
  sharpTitle: { ru: "Резкая смена темы", en: "An abrupt change of theme" } satisfies Phrase,
  sharpMarker: {
    ru: (arcanum: number, theme: string) => `${arcanum} аркан обозначает ${theme}`,
    en: (arcanum: number, theme: string) => `arcanum ${arcanum} marks ${theme}`,
  } satisfies PhraseFn<[number, string]>,
  sharpText: {
    ru: (fromA: number, toA: number, fromB: number, toB: number, markers: string) =>
      `Переход ${fromA}–${toA} → ${fromB}–${toB} отмечен как резкая смена темы: ${markers}. Это `
      + "характеристика смены ракурса, а не обещание события на границе десятилетий.",
    en: (fromA: number, toA: number, fromB: number, toB: number, markers: string) =>
      `The transition ${fromA}–${toA} → ${fromB}–${toB} is marked as an abrupt change of theme: `
      + `${markers}. This describes a change of angle, not a promise of an event at the border of decades.`,
  } satisfies PhraseFn<[number, number, number, number, string]>,
  sharpJoin: { ru: ", а ", en: ", and " } satisfies Phrase,
  yearsSummaryUnknown: {
    ru: (slug: string) => `Линия ${slug} описывает восемь десятилетий подряд. Текущий этап `
      + "отмечается только в персональном разборе: откройте раздел из своего расчёта, чтобы линия "
      + "показала возраст.",
    en: (slug: string) => `The line ${slug} describes eight decades in a row. The current stage is `
      + "marked only in a personal reading: open the section from your own calculation so the line "
      + "shows the age.",
  } satisfies PhraseFn<[string]>,
  yearsSummaryCurrent: {
    ru: (age: number, from: number, to: number, arcanum: number, title: string, next: string) =>
      `Сейчас возраст ${age} лет относится к этапу ${from}–${to} с ${arcanum} арканом ${title}. ${next}`,
    en: (age: number, from: number, to: number, arcanum: number, title: string, next: string) =>
      `The age of ${age} belongs to the stage ${from}–${to} with arcanum ${arcanum} ${title}. ${next}`,
  } satisfies PhraseFn<[number, number, number, number, string, string]>,
  yearsNext: {
    ru: (from: number, to: number, arcanum: number, title: string) =>
      `Следующий этап ${from}–${to} переводит линию к ${arcanum} аркану ${title}.`,
    en: (from: number, to: number, arcanum: number, title: string) =>
      `The next stage ${from}–${to} carries the line to arcanum ${arcanum} ${title}.`,
  } satisfies PhraseFn<[number, number, number, string]>,
  yearsLast: {
    ru: "Это последний этап шкалы до 80 лет.",
    en: "This is the last stage of the scale up to 80.",
  } satisfies Phrase,
  yearsBeyond: {
    ru: (age: number) => `Возраст ${age} лет находится за пределами шкалы до 80. Восемь периодов `
      + "читаются как пройденная линия опыта, а не как прогноз следующего десятилетия.",
    en: (age: number) => `The age of ${age} is beyond the scale of 80. The eight periods read as a `
      + "line of experience already lived, not as a forecast of the next decade.",
  } satisfies PhraseFn<[number]>,
  yearsStrengthUnknown: {
    ru: "Сильные стороны линии видны при сравнении десятилетий между собой: одна и та же тема на "
      + "разных этапах проходит по-разному.",
    en: "The strengths of the line show when the decades are compared with each other: the same "
      + "theme goes differently at different stages.",
  } satisfies Phrase,
  yearsStrengthBeyond: {
    ru: "Ресурс линии — возможность сопоставить повторяющиеся темы разных десятилетий с реальными "
      + "событиями своей биографии.",
    en: "The resource of the line is the chance to match repeating themes of different decades with "
      + "the real events of your own biography.",
  } satisfies Phrase,
  yearsTensionUnknown: {
    ru: "Риск линии — читать восемь арканов как расписание событий. Возрастная рамка меняет вопрос "
      + "этапа, а не обещает происшествие.",
    en: "The risk of the line is reading eight arcana as a schedule of events. The age frame changes "
      + "the question of the stage; it promises no incident.",
  } satisfies Phrase,
  yearsTensionCurrent: {
    ru: (risk: string) => `${risk} Возрастная рамка не обещает конкретных событий и не отменяет `
      + "личный выбор.",
    en: (risk: string) => `${risk} The age frame promises no particular events and does not cancel `
      + "personal choice.",
  } satisfies PhraseFn<[string]>,
  yearsTensionBeyond: {
    ru: "После 80 лет раздел не продолжает формулу произвольными прогнозами.",
    en: "Beyond 80 the section does not continue the formula with arbitrary forecasts.",
  } satisfies Phrase,
  yearsPracticeUnknown: {
    ru: "Сопоставьте периоды с тем, что происходило на самом деле, и отметьте, какая тема "
      + "возвращалась. Персональный возраст покажет разбор из вашего расчёта.",
    en: "Match the periods with what actually happened and note which theme came back. Your own age "
      + "is shown by the reading from your own calculation.",
  } satisfies Phrase,
  yearsPracticeCurrent: {
    ru: (action: string, next: string) => `Для текущего этапа используйте действие: ${action}${next}`,
    en: (action: string, next: string) => `For the current stage use this action: ${action}${next}`,
  } satisfies PhraseFn<[string, string]>,
  yearsPracticeNext: {
    ru: (essence: string) => ` Переход готовит вопрос следующего периода: ${essence}`,
    en: (essence: string) => ` The transition prepares the question of the next period: ${essence}`,
  } satisfies PhraseFn<[string]>,
  yearsPracticeBeyond: {
    ru: "Отметьте, какие темы возвращались на разных этапах, и отделите подтверждённые факты от "
      + "поздних объяснений.",
    en: "Note which themes came back at different stages and separate confirmed facts from later "
      + "explanations.",
  } satisfies Phrase,
};

/** Заголовки и подводки персональных разборов разделов. */
export const sectionReading = {
  titleForMatrix: {
    ru: (title: string, date: string) => `${title} для матрицы ${date}`,
    en: (title: string, date: string) => `${title} for matrix ${date}`,
  } satisfies PhraseFn<[string, string]>,
  titleLine: {
    ru: (title: string, slug: string) => `${title}: линия ${slug}`,
    en: (title: string, slug: string) => `${title}: line ${slug}`,
  } satisfies PhraseFn<[string, string]>,
  titleRoles: {
    ru: (title: string, slug: string, roles: string) => `${title} ${slug}: ${roles}`,
    en: (title: string, slug: string, roles: string) => `${title} ${slug}: ${roles}`,
  } satisfies PhraseFn<[string, string, string]>,
  exampleLead: {
    ru: "Общая статья объясняет порядок и границы метода.",
    en: "The general article explains the order and the limits of the method.",
  } satisfies Phrase,
  exampleChakras: {
    ru: (lead: string, date: string) => `${lead} Карта матрицы ${date} показывает все семь уровней `
      + "в трёх колонках и общий итог каждой колонки.",
    en: (lead: string, date: string) => `${lead} The map of matrix ${date} shows all seven levels `
      + "in three columns and the total of each column.",
  } satisfies PhraseFn<[string, string]>,
  exampleYears: {
    ru: (lead: string, code: string) => `${lead} Линия ${code} показывает восемь десятилетий подряд, `
      + "переходы между ними и возвращение темы.",
    en: (lead: string, code: string) => `${lead} Line ${code} shows eight decades in a row, the `
      + "moves between them and the return of a theme.",
  } satisfies PhraseFn<[string, string]>,
  exampleRoles: {
    ru: (lead: string, code: string, roles: string) => `${lead} На результате ${code} те же правила `
      + `читают роли раздела: ${roles}.`,
    en: (lead: string, code: string, roles: string) => `${lead} On result ${code} the same rules `
      + `read the roles of the section: ${roles}.`,
  } satisfies PhraseFn<[string, string, string]>,
};
