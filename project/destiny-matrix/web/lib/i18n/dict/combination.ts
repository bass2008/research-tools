import type { Phrase, PhraseFn } from "./index";

/** Связи пары арканов внутри разделов: заголовок, вопрос и подписи ролей. */
export const combination = {
  ab: {
    title: { ru: "Внешний образ и внутренняя задача", en: "Outer image and inner task" } satisfies Phrase,
    question: {
      ru: "Как первое впечатление соотносится с тем, что движет человеком изнутри",
      en: "How the first impression relates to what drives the person from within",
    } satisfies Phrase,
    left: { ru: "портрет личности", en: "personality portrait" } satisfies Phrase,
    right: { ru: "духовная задача", en: "spiritual task" } satisfies Phrase,
  },
  bc: {
    title: { ru: "От внутреннего качества к поступку", en: "From an inner quality to an action" } satisfies Phrase,
    question: {
      ru: "Как внутренняя задача превращается в практическое действие",
      en: "How the inner task turns into a practical action",
    } satisfies Phrase,
    left: { ru: "духовная задача", en: "spiritual task" } satisfies Phrase,
    right: { ru: "материальная задача", en: "material task" } satisfies Phrase,
  },
  ac: {
    title: { ru: "Первое впечатление и реальное поведение", en: "First impression and real behaviour" } satisfies Phrase,
    question: {
      ru: "Совпадает ли ожидание от внешнего образа с тем, как человек действует на деле",
      en: "Whether what the outer image promises matches how the person actually acts",
    } satisfies Phrase,
    left: { ru: "портрет личности", en: "personality portrait" } satisfies Phrase,
    right: { ru: "материальная задача", en: "material task" } satisfies Phrase,
  },
  em: {
    title: { ru: "Внутренняя опора и автоматическая реакция", en: "Inner footing and automatic reaction" } satisfies Phrase,
    question: {
      ru: "Что происходит с базовым состоянием, когда человек реагирует без подготовки",
      en: "What happens to the basic state when a person reacts without preparation",
    } satisfies Phrase,
    left: { ru: "внутренний центр", en: "inner centre" } satisfies Phrase,
    right: { ru: "автоматическая реакция", en: "automatic reaction" } satisfies Phrase,
  },
  ek: {
    title: { ru: "Внутренний центр и форма таланта", en: "Inner centre and the shape of talent" } satisfies Phrase,
    question: {
      ru: "Как врождённый талант помогает вернуться в устойчивое состояние",
      en: "How an inborn talent helps you return to a stable state",
    } satisfies Phrase,
    left: { ru: "внутренний центр", en: "inner centre" } satisfies Phrase,
    right: { ru: "талант, возвращающий управление", en: "the talent that gives control back" } satisfies Phrase,
  },
  mk: {
    title: { ru: "От реакции к возвращению в центр", en: "From reaction back to the centre" } satisfies Phrase,
    question: {
      ru: "Как перевести первую реакцию в действие, которое возвращает человеку управление",
      en: "How to turn the first reaction into an action that gives control back",
    } satisfies Phrase,
    left: { ru: "автоматическая реакция", en: "automatic reaction" } satisfies Phrase,
    right: { ru: "талант, возвращающий управление", en: "the talent that gives control back" } satisfies Phrase,
  },
  bp: {
    title: { ru: "Исходный дар и форма работы", en: "The original gift and the shape of the work" } satisfies Phrase,
    question: {
      ru: "Как врождённый дар превращается в конкретный тип профессиональных задач",
      en: "How an inborn gift turns into a particular kind of professional task",
    } satisfies Phrase,
    left: { ru: "исходный дар", en: "original gift" } satisfies Phrase,
    right: { ru: "форма профессиональной реализации", en: "the shape of professional realisation" } satisfies Phrase,
  },
  pk: {
    title: { ru: "Форма работы и внутренний результат", en: "The shape of the work and the inner result" } satisfies Phrase,
    question: {
      ru: "Как выбранный способ работать влияет на ощущение реализованности",
      en: "How the chosen way of working affects the sense of being realised",
    } satisfies Phrase,
    left: { ru: "форма профессиональной реализации", en: "the shape of professional realisation" } satisfies Phrase,
    right: { ru: "внутренний результат", en: "inner result" } satisfies Phrase,
  },
  bk: {
    title: { ru: "Дар и результат его реализации", en: "The gift and the result of realising it" } satisfies Phrase,
    question: {
      ru: "Совпадает ли итог работы с тем качеством, которое было дано изначально",
      en: "Whether the result of the work matches the quality that was given in the first place",
    } satisfies Phrase,
    left: { ru: "исходный дар", en: "original gift" } satisfies Phrase,
    right: { ru: "внутренний результат", en: "inner result" } satisfies Phrase,
  },
  groups: {
    character: {
      title: { ru: "Как пара работает в характере", en: "How the pair works in character" } satisfies Phrase,
      lead: {
        ru: "Допустимые порядки пары для трёх связей раздела «Характер и личные качества».",
        en: "The possible orders of the pair for the three links of the “Character and personal qualities” section.",
      } satisfies Phrase,
      link: {
        ru: "Как читается раздел «Характер и личные качества» →",
        en: "How the “Character and personal qualities” section is read →",
      } satisfies Phrase,
    },
    comfort: {
      title: {
        ru: "Как пара работает в центре и внутренних точках",
        en: "How the pair works in the centre and the inner points",
      } satisfies Phrase,
      lead: {
        ru: "Допустимые порядки пары для связей внутреннего центра E, реакции M и возвращающего таланта K.",
        en: "The possible orders of the pair for the links of the inner centre E, the reaction M and the talent K that gives control back.",
      } satisfies Phrase,
      link: {
        ru: "Как читается раздел «Центр и внутренние точки» →",
        en: "How the “The centre and the inner points” section is read →",
      } satisfies Phrase,
    },
    profession: {
      title: { ru: "Как пара работает в линии таланта", en: "How the pair works in the talent line" } satisfies Phrase,
      lead: {
        ru: "Допустимые порядки пары для перехода от исходного дара B через форму работы P к результату K.",
        en: "The possible orders of the pair for the move from the original gift B through the shape of the work P to the result K.",
      } satisfies Phrase,
      link: {
        ru: "Как читается раздел «Профессия и дело по душе» →",
        en: "How the “Profession and work you love” section is read →",
      } satisfies Phrase,
    },
  },
  heading: {
    ru: (ln: number, lt: string, lr: string, rn: number, rt: string, rr: string) =>
      `${ln} ${lt} в ${lr}, ${rn} ${rt} в ${rr}`,
    en: (ln: number, lt: string, lr: string, rn: number, rt: string, rr: string) =>
      `${ln} ${lt} at ${lr}, ${rn} ${rt} at ${rr}`,
  } satisfies PhraseFn<[number, string, string, number, string, string]>,
  intro: {
    ru: (question: string, lt: string, lr: string, ll: string, le: string,
         rt: string, rr: string, rl: string, re: string) =>
      `${question}. В этом порядке ${lt} занимает позицию ${lr} — ${ll}: ${le} ${rt} занимает `
      + `позицию ${rr} — ${rl}: ${re}`,
    en: (question: string, lt: string, lr: string, ll: string, le: string,
         rt: string, rr: string, rl: string, re: string) =>
      `${question}. In this order ${lt} takes position ${lr} — ${ll}: ${le} ${rt} takes position `
      + `${rr} — ${rl}: ${re}`,
  } satisfies PhraseFn<[string, string, string, string, string, string, string, string, string]>,
  strong: {
    ru: (lr: string, ls: string, rr: string, rs: string) =>
      `В сильном проявлении в позиции ${lr} ${ls}, а в позиции ${rr} — ${rs}. Пара работает `
      + "согласованно, когда первое качество задаёт свой этап, а второе не спорит с ним, а "
      + "продолжает его в собственной роли.",
    en: (lr: string, ls: string, rr: string, rs: string) =>
      `At its strongest, at position ${lr} ${ls}, and at position ${rr} — ${rs}. The pair works in `
      + "tune when the first quality sets its own stage and the second does not argue with it but "
      + "continues it in its own role.",
  } satisfies PhraseFn<[string, string, string, string]>,
  tension: {
    ru: (lr: string, lrisk: string, rr: string, rrisk: string) =>
      `Напряжение появляется, когда в позиции ${lr} ${lrisk}, а в позиции ${rr} — ${rrisk}. `
      + "Проверять эту связь полезно по последовательности: что было показано или задумано "
      + "сначала и каким действием ситуация завершилась.",
    en: (lr: string, lrisk: string, rr: string, rrisk: string) =>
      `Tension appears when at position ${lr} ${lrisk}, and at position ${rr} — ${rrisk}. This `
      + "link is best checked as a sequence: what was shown or intended first, and which action "
      + "the situation ended with.",
  } satisfies PhraseFn<[string, string, string, string]>,
  practiceFirst: {
    ru: (a: number, lt: string, b: number, rt: string) =>
      "Сначала определите позиции пары в своей карте: смысл сочетания меняется в зависимости от "
      + "того, читается ли оно в характере, во внутренних точках или в линии таланта. Для "
      + `${a} ${lt} и ${b} ${rt} важно не менять арканы местами автоматически, а выбрать вариант `
      + "с точным порядком ролей.",
    en: (a: number, lt: string, b: number, rt: string) =>
      "First find the positions of the pair in your own chart: the meaning of a combination "
      + "changes depending on whether it is read in character, in the inner points or in the "
      + `talent line. For ${a} ${lt} and ${b} ${rt} it matters not to swap the arcana `
      + "automatically but to pick the variant with the exact order of roles.",
  } satisfies PhraseFn<[number, string, number, string]>,
  practiceSecond: {
    ru: (lplus: string, rplus: string, lminus: string, rminus: string) =>
      "Затем сравните один реальный эпизод с двумя сторонами пары. Отметьте, где человек "
      + `${lplus} и где ${rplus}; отдельно проверьте моменты, когда он ${lminus} или ${rminus}. `
      + "Такое наблюдение показывает, какое качество стоит включать первым, а каким завершать действие.",
    en: (lplus: string, rplus: string, lminus: string, rminus: string) =>
      "Then compare one real episode against both sides of the pair. Note where the person "
      + `${lplus} and where ${rplus}; check separately the moments when they ${lminus} or ${rminus}. `
      + "Such an observation shows which quality to switch on first and which one to finish the action with.",
  } satisfies PhraseFn<[string, string, string, string]>,
};
