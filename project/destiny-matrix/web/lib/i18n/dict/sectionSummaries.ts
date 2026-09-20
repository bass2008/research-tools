import type { Phrase, PhraseFn } from "./index";

/** Итоги и практики разделов: у каждого раздела свой текст, подставляется список ролей. */
export const sectionSummaries = {
  chakraLevelKey: {
    ru: (n: number) => `физика ${n}`,
    en: (n: number) => `physics ${n}`,
  } satisfies PhraseFn<[number]>,
  chakraLevelLabel: {
    ru: (n: number) => `Физика уровня ${n}`,
    en: (n: number) => `Physics of level ${n}`,
  } satisfies PhraseFn<[number]>,
  chakraLevelQuestion: {
    ru: "Как аркан проявляется в материальном ритме уровня",
    en: "How the arcanum shows in the material rhythm of the level",
  } satisfies Phrase,
  decadeLabel: {
    ru: (from: number, to: number) => `${from}–${to} лет`,
    en: (from: number, to: number) => `${from}–${to} years`,
  } satisfies PhraseFn<[number, number]>,
  decadeQuestion: {
    ru: "Какая тема задаёт фон десятилетия и готовит переход к следующему этапу",
    en: "Which theme sets the background of the decade and prepares the move to the next stage",
  } satisfies Phrase,
  summary: {
    realisation: {
      ru: (labels: string) => `Путь ${labels} связывает корневую задачу, личный рост и пользу для `
        + "других: следующий уровень не отменяет предыдущий, а переводит его в более широкий масштаб.",
      en: (labels: string) => `The path ${labels} links the root task, personal growth and `
        + "usefulness to others: the next level does not cancel the previous one but carries it to "
        + "a wider scale.",
    } satisfies PhraseFn<[string]>,
    karma40: {
      ru: (labels: string) => `Пара ${labels} описывает наследуемое правило и привычный способ `
        + "защищать внутреннюю опору в первой части пути. Возрастная граница здесь задаёт ракурс "
        + "чтения, а не обещает событие в день сорокалетия.",
      en: (labels: string) => `The pair ${labels} describes an inherited rule and the habitual way `
        + "of defending your inner footing in the first half of the path. The age boundary sets the "
        + "angle of reading; it does not promise an event on your fortieth birthday.",
    } satisfies PhraseFn<[string]>,
    resources: {
      ru: (labels: string) => `Связка ${labels} показывает вход в ресурс и условие, при котором `
        + "результат удаётся удерживать. Она не обещает богатства и проверяется только через реальные решения.",
      en: (labels: string) => `The link ${labels} shows the entry into a resource and the condition `
        + "under which the result can be kept. It promises no wealth and is checked only through real decisions.",
    } satisfies PhraseFn<[string]>,
    family_gifts: {
      ru: (labels: string) => `Четыре роли ${labels} показывают поддержку обеих ветвей и два разных `
        + "способа превратить её в собственную силу, не оценивая семью и не назначая виноватых.",
      en: (labels: string) => `The four roles ${labels} show the support of both branches and two `
        + "different ways of turning it into your own strength, without judging the family or "
        + "naming anyone guilty.",
    } satisfies PhraseFn<[string]>,
    soul_tasks: {
      ru: (labels: string) => `Три роли ${labels} соединяют две исходные внутренние задачи с общим `
        + "уроком, который можно проверить по повторяющимся решениям.",
      en: (labels: string) => `The three roles ${labels} join the two original inner tasks with a `
        + "shared lesson that can be checked against repeating decisions.",
    } satisfies PhraseFn<[string]>,
    purpose: {
      ru: (labels: string) => `Траектория ${labels} показывает четыре масштаба одной темы: от `
        + "верности себе до вклада за пределами личной истории.",
      en: (labels: string) => `The trajectory ${labels} shows four scales of one theme: from being `
        + "true to yourself to a contribution beyond your personal story.",
    } satisfies PhraseFn<[string]>,
    money: {
      ru: (labels: string) => `Линия ${labels} описывает вход, направление, личный выбор и `
        + "устойчивость денежного результата, но не прогнозирует сумму или дату дохода.",
      en: (labels: string) => `The line ${labels} describes the entry, the direction, the personal `
        + "choice and the stability of a money result, but it forecasts neither an amount nor a date of income.",
    } satisfies PhraseFn<[string]>,
    money40: {
      ru: (labels: string) => `Зрелый ракурс ${labels} показывает, как накопленный опыт меняет `
        + "привычный денежный вход; формула не переключается автоматически в день сорокалетия.",
      en: (labels: string) => `The mature angle ${labels} shows how accumulated experience changes `
        + "the habitual money entry; the formula does not switch automatically on your fortieth birthday.",
    } satisfies PhraseFn<[string]>,
    relations: {
      ru: (labels: string) => `Сценарий ${labels} описывает способ входить в близость, проходить `
        + "главный узел, строить договорённости и сохранять внутренний ресурс. Это не совместимость "
        + "двух дат и не прогноз брака.",
      en: (labels: string) => `The scenario ${labels} describes the way you enter closeness, pass `
        + "the main knot, build agreements and keep your inner resource. It is neither the "
        + "compatibility of two dates nor a forecast of marriage.",
    } satisfies PhraseFn<[string]>,
    parents_children: {
      ru: (labels: string) => `Связка ${labels} показывает два полученных семейных правила и то, `
        + "как они продолжаются в собственном поведении — независимо от того, есть ли у человека дети.",
      en: (labels: string) => `The link ${labels} shows two family rules you received and how they `
        + "continue in your own behaviour — whether or not you have children.",
    } satisfies PhraseFn<[string]>,
    ancestry: {
      ru: (labels: string) => `Четыре роли ${labels} показывают повторяющийся родовой сценарий и `
        + "масштаб его изменения; формула не считает семь отдельных поколений и не говорит о «проклятиях».",
      en: (labels: string) => `The four roles ${labels} show a repeating family scenario and the `
        + "scale of changing it; the formula counts no seven separate generations and says nothing about “curses”.",
    } satisfies PhraseFn<[string]>,
    body_resource: {
      ru: (labels: string) => `Связка ${labels} описывает бытовую устойчивость, расход запаса и `
        + "наблюдаемый способ восстановления. Это не заключение о состоянии организма и не профильная рекомендация.",
      en: (labels: string) => `The link ${labels} describes everyday stability, the spending of your `
        + "reserve and an observable way of recovering. It is not a conclusion about your body and not professional advice.",
    } satisfies PhraseFn<[string]>,
    rest: {
      ru: (labels: string) => `Пара ${labels} соединяет способ переключения с проверяемым признаком `
        + "восстановления: после подходящего отдыха возвращаются ясность и способность действовать.",
      en: (labels: string) => `The pair ${labels} joins a way of switching with a checkable sign of `
        + "recovery: after the right kind of rest, clarity and the ability to act come back.",
    } satisfies PhraseFn<[string]>,
    loops: {
      ru: (labels: string) => `Связка ${labels} показывает корень повторяющегося сюжета, состояние `
        + "автопилота и точку выхода. Тройка становится «программой» только как часть рассчитанного "
        + "раздела, а не сама по себе.",
      en: (labels: string) => `The link ${labels} shows the root of a repeating storyline, the state `
        + "of autopilot and the point of exit. The triple becomes a “program” only as part of a "
        + "calculated section, not on its own.",
    } satisfies PhraseFn<[string]>,
    fallback: {
      ru: (labels: string) => `Последовательность ${labels} читается как единый раздел с разными ролями.`,
      en: (labels: string) => `The sequence ${labels} reads as one section with different roles.`,
    } satisfies PhraseFn<[string]>,
  },
  practice: {
    realisation: {
      ru: (action: string) => "Возьмите один повторяющийся сюжет D и запишите: какой новый личный "
        + "ответ возможен, кому он станет полезен и какое действие можно выполнить за неделю. "
        + `Начните с подсказки последней роли: ${action}`,
      en: (action: string) => "Take one repeating storyline D and write down: which new personal "
        + "answer is possible, who it will be useful to and which action can be done within a week. "
        + `Start from the hint of the last role: ${action}`,
    } satisfies PhraseFn<[string]>,
    karma40: {
      ru: (action: string) => "Найдите одно семейное правило, которое включилось автоматически, и "
        + "проверьте его на нынешней ситуации. Сохраните полезную часть I, а для нового ответа "
        + `используйте действие J: ${action}`,
      en: (action: string) => "Find one family rule that switched on automatically and test it "
        + "against your current situation. Keep the useful part of I, and for a new answer use the "
        + `action of J: ${action}`,
    } satisfies PhraseFn<[string]>,
    resources: {
      ru: (action: string) => "Выберите один небольшой результат и проверьте оба звена: что открыло "
        + "вход L и какое действие R2 поможет удержать движение без обещаний быстрого достатка. "
        + `Подсказка: ${action}`,
      en: (action: string) => "Pick one small result and check both links: what opened the entry L "
        + "and which action of R2 helps keep the movement going, with no promises of quick wealth. "
        + `Hint: ${action}`,
    } satisfies PhraseFn<[string]>,
    family_gifts: {
      ru: (action: string) => "Назовите по одному реально полученному ресурсу каждой ветви и "
        + "выберите один способ применить их без долга и обвинений. Начните с действия последней "
        + `роли: ${action}`,
      en: (action: string) => "Name one resource you really received from each branch and pick one "
        + `way to use them without debt or blame. Start from the action of the last role: ${action}`,
    } satisfies PhraseFn<[string]>,
    soul_tasks: {
      ru: (action: string) => "В одной ситуации разделите две исходные задачи и общий урок: что "
        + `требовала B, что возвращала D и какое действие проверит итог неба. Подсказка: ${action}`,
      en: (action: string) => "In one situation separate the two original tasks and the shared "
        + `lesson: what B asked for, what D brought back and which action will test the total of the sky. Hint: ${action}`,
    } satisfies PhraseFn<[string]>,
    purpose: {
      ru: (action: string) => "Отметьте, какой из четырёх уровней уже подтверждён поступками, где "
        + "возникает разрыв и какой один шаг соединит личное решение с пользой для других. "
        + `Подсказка: ${action}`,
      en: (action: string) => "Note which of the four levels is already confirmed by actions, where "
        + `the gap appears and which single step will join a personal decision with usefulness to others. Hint: ${action}`,
    } satisfies PhraseFn<[string]>,
    money: {
      ru: (action: string) => "Разберите один денежный эпизод по четырём звеньям и выберите "
        + "эксперимент, который можно измерить не суммой обещанного дохода, а выполненным действием. "
        + `Подсказка: ${action}`,
      en: (action: string) => "Take one money episode apart along the four links and choose an "
        + `experiment measured by an action you carried out, not by a promised amount. Hint: ${action}`,
    } satisfies PhraseFn<[string]>,
    money40: {
      ru: (action: string) => "Сравните один привычный денежный способ с тем, что теперь даёт "
        + "накопленный опыт, и проведите небольшой эксперимент без ожидания резкого возрастного "
        + `перелома. Подсказка: ${action}`,
      en: (action: string) => "Compare one habitual money method with what accumulated experience "
        + `gives you now, and run a small experiment without expecting a sharp turn with age. Hint: ${action}`,
    } satisfies PhraseFn<[string]>,
    relations: {
      ru: (action: string) => "Возьмите один реальный разговор и отметьте первую реакцию, главный "
        + `узел, форму договорённости и способ сохранить себя. Начните с действия K: ${action}`,
      en: (action: string) => "Take one real conversation and note the first reaction, the main "
        + `knot, the shape of the agreement and the way you keep yourself. Start from the action of K: ${action}`,
    } satisfies PhraseFn<[string]>,
    parents_children: {
      ru: (action: string) => "Вспомните одно семейное правило, которое повторяется в общении с "
        + "близкими, и сформулируйте способ передать его ценность без автоматической жёсткости. "
        + `Подсказка: ${action}`,
      en: (action: string) => "Recall one family rule that repeats in how you talk with those close "
        + `to you, and put into words a way of passing on its value without automatic harshness. Hint: ${action}`,
    } satisfies PhraseFn<[string]>,
    ancestry: {
      ru: (action: string) => "Выберите один подтверждённый семейный сценарий, разделите вклады "
        + `двух ветвей и определите действие, которое меняет продолжение сейчас. Подсказка: ${action}`,
      en: (action: string) => "Pick one confirmed family scenario, separate the contributions of "
        + `the two branches and define the action that changes the continuation now. Hint: ${action}`,
    } satisfies PhraseFn<[string]>,
    body_resource: {
      ru: (action: string) => "В течение недели отмечайте режим, после которого возвращается "
        + "бытовая устойчивость, не превращая наблюдение в медицинский вывод. Начните с действия "
        + `итога: ${action}`,
      en: (action: string) => "For a week, note the routine after which everyday stability comes "
        + `back, without turning the observation into a medical conclusion. Start from the action of the total: ${action}`,
    } satisfies PhraseFn<[string]>,
    rest: {
      ru: (action: string) => "Проведите недельный эксперимент с одним форматом отдыха и оцените "
        + `его по ясному признаку E: стало ли проще возвращаться к своим делам. Подсказка: ${action}`,
      en: (action: string) => "Run a week-long experiment with one format of rest and judge it by "
        + `the clear sign of E: has it become easier to return to your own affairs. Hint: ${action}`,
    } satisfies PhraseFn<[string]>,
    loops: {
      ru: (action: string) => "Запишите один полный круг «триггер → автопилот → последствия» и "
        + `заранее выберите действие точки выхода. Подсказка: ${action}`,
      en: (action: string) => "Write down one full circle “trigger → autopilot → consequences” and "
        + `choose the action of the point of exit in advance. Hint: ${action}`,
    } satisfies PhraseFn<[string]>,
    fallback: {
      ru: (action: string) => "Проверьте последовательность на одной реальной ситуации и начните с "
        + `действия последней роли: ${action}`,
      en: (action: string) => "Test the sequence against one real situation and start from the "
        + `action of the last role: ${action}`,
    } satisfies PhraseFn<[string]>,
  },
  strengthLine: {
    ru: (list: string) => `Согласованный вариант заметен так: ${list}.`,
    en: (list: string) => `The version that is in tune looks like this: ${list}.`,
  } satisfies PhraseFn<[string]>,
  tensionLine: {
    ru: (list: string) => `Разрыв между ролями можно проверить по признакам: ${list}. Это рабочие `
      + "гипотезы для наблюдения, а не неизменные свойства человека.",
    en: (list: string) => `The gap between the roles can be checked by these signs: ${list}. These `
      + "are working hypotheses for observation, not fixed properties of a person.",
  } satisfies PhraseFn<[string]>,
};

/** Два раздела со своим каркасом вывода: линия таланта и лестница предназначения. */
export const professionLine = {
  summary: {
    ru: (a: number, b: number, c: number, at: string, bt: string, ct: string) =>
      `Линия ${a}–${b}–${c} читается как путь B→P→K: ${at} задаёт исходный дар, ${bt} — подходящие `
      + `задачи и формат труда, а ${ct} — внутренний результат зрелой реализации. Это не список `
      + "обязательных профессий, а способ проверить выбранную работу.",
    en: (a: number, b: number, c: number, at: string, bt: string, ct: string) =>
      `The line ${a}–${b}–${c} reads as the path B→P→K: ${at} sets the original gift, ${bt} the `
      + `suitable tasks and format of work, and ${ct} the inner result of mature realisation. This `
      + "is not a list of obligatory professions but a way to test the work you have chosen.",
  } satisfies PhraseFn<[number, number, number, string, string, string]>,
  strength: {
    ru: (first: string, middle: string, last: string) =>
      `Линия работает согласованно так: в исходном даре ${first}; в рабочих задачах держится `
      + `принцип «${middle}»; в результате ${last}.`,
    en: (first: string, middle: string, last: string) =>
      `The line works in tune like this: in the original gift ${first}; in work tasks the principle `
      + `“${middle}” holds; in the result ${last}.`,
  } satisfies PhraseFn<[string, string, string]>,
  tension: {
    ru: (first: string, middle: string, last: string) =>
      `Разрыв начинается, когда исходный дар искажается: ${first}. Неподходящая форма работы `
      + `заметна по риску: ${middle}. В итоге ${last}. Это повод проверить формат задач, а не `
      + "объявлять всю профессию ошибочной.",
    en: (first: string, middle: string, last: string) =>
      `The gap starts when the original gift is distorted: ${first}. An unsuitable form of work `
      + `shows through the risk: ${middle}. In the result ${last}. This is a reason to check the `
      + "format of the tasks, not to declare the whole profession a mistake.",
  } satisfies PhraseFn<[string, string, string]>,
  practice: {
    ru: (action: string) => "Выберите одну рабочую задачу и разложите её по линии: какое качество B "
      + "вы реально применили, какой формат P помог получить результат и что изменилось во "
      + `внутреннем состоянии K. Следующий эксперимент берите из действия позиции P: ${action}`,
    en: (action: string) => "Take one work task and lay it out along the line: which quality of B "
      + "you actually used, which format P helped to get the result and what changed in the inner "
      + `state K. Take the next experiment from the action of position P: ${action}`,
  } satisfies PhraseFn<[string]>,
};

export const purposeLadder = {
  summary: {
    ru: (ladder: string) => `Траектория ${ladder} показывает четыре масштаба одной темы: от `
      + "верности себе до вклада за пределами личной истории.",
    en: (ladder: string) => `The trajectory ${ladder} shows four scales of one theme: from being `
      + "true to yourself to a contribution beyond your personal story.",
  } satisfies PhraseFn<[string]>,
  carried: {
    // Кавычки ставит вызывающий: ролей бывает несколько, и обрамлять надо каждую.
    ru: (title: string, roles: string) => `Уровень, который уже проживается, виден по повтору: `
      + `${title} стоит сразу в ролях ${roles}. Значит тема уже переносится через масштаб, а не `
      + "начинается заново на каждом уровне.",
    en: (title: string, roles: string) => `The level you already live through is visible through `
      + `the repetition: ${title} stands at once in the roles ${roles}. So the theme is already `
      + "carried across scales instead of starting anew at every level.",
  } satisfies PhraseFn<[string, string]>,
  noCarried: {
    ru: (label: string, title: string) => `Ни один аркан не повторяется на двух уровнях, поэтому `
      + `опорой служит нижний: ${label} — ${title}. Это единственный масштаб, который можно `
      + "подтвердить поступком без чужого участия; остальные три расширяют его.",
    en: (label: string, title: string) => `No arcanum repeats on two levels, so the lowest one is `
      + `the footing: ${label} — ${title}. It is the only scale you can confirm by an action `
      + "without anyone else; the other three widen it.",
  } satisfies PhraseFn<[string, string]>,
  gap: {
    ru: (l1: string, l2: string, t1: string, t2: string) =>
      `Разрыв проходит между ролями «${l1}» и «${l2}»: ${t1} и ${t2} остаются вне повторяющейся `
      + "темы, поэтому переход от первого ко второму приходится делать сознательно.",
    en: (l1: string, l2: string, t1: string, t2: string) =>
      `The gap runs between the roles “${l1}” and “${l2}”: ${t1} and ${t2} stay outside the `
      + "repeating theme, so the move from the first to the second has to be made consciously.",
  } satisfies PhraseFn<[string, string, string, string]>,
  noGap: {
    ru: "Явного разрыва нет: повторяющаяся тема проходит по всей траектории, и риск здесь другой — "
      + "принять привычное за уже пройденное.",
    en: "There is no clear gap: the repeating theme runs through the whole trajectory, and the risk "
      + "here is different — taking the familiar for something already completed.",
  } satisfies Phrase,
  eachLevel: {
    ru: (list: string) => `Каждый уровень просит своего качества: ${list}. Одна тема не переносится `
      + "с уровня на уровень сама, и каждый переход приходится делать отдельным решением.",
    en: (list: string) => `Every level asks for its own quality: ${list}. One theme does not carry `
      + "itself from level to level, and each move has to be made as a separate decision.",
  } satisfies PhraseFn<[string]>,
  practiceGap: {
    ru: (l1: string, l2: string, action: string) => `Возьмите одно решение последнего месяца и `
      + `проверьте его на границе «${l1} → ${l2}»: что вы сделали для себя и что из этого стало `
      + `полезно другим. Подсказка: ${action}`,
    en: (l1: string, l2: string, action: string) => `Take one decision from the past month and test `
      + `it at the border “${l1} → ${l2}”: what you did for yourself and what of it became useful `
      + `to others. Hint: ${action}`,
  } satisfies PhraseFn<[string, string, string]>,
  practicePlain: {
    ru: (action: string) => "Возьмите одно решение последнего месяца и проверьте, на каком из "
      + "четырёх уровней оно подтверждено поступком, а на каком осталось намерением. "
      + `Подсказка: ${action}`,
    en: (action: string) => "Take one decision from the past month and check on which of the four "
      + `levels it is confirmed by an action and on which it stayed an intention. Hint: ${action}`,
  } satisfies PhraseFn<[string]>,
};
