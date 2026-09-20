import type { Phrase, PhraseFn } from "./index";

/** Подписи точек карты: ключ и символ — контракт, слово — перевод. */
export const mapPoints = {
  day: { ru: "Портрет личности", en: "Personality portrait" } satisfies Phrase,
  month: { ru: "Духовная задача", en: "Spiritual task" } satisfies Phrase,
  year: { ru: "Материальная задача", en: "Material task" } satisfies Phrase,
  mission: { ru: "Кармическая задача", en: "Karmic task" } satisfies Phrase,
  father_line: { ru: "Духовная мужская линия рода", en: "Spiritual male family line" } satisfies Phrase,
  mother_line: { ru: "Духовная женская линия рода", en: "Spiritual female family line" } satisfies Phrase,
  descendants: { ru: "Материальная мужская линия рода", en: "Material male family line" } satisfies Phrase,
  inheritance: { ru: "Материальная женская линия рода", en: "Material female family line" } satisfies Phrase,
  comfort_west: { ru: "Внутренняя левая точка", en: "Inner left point" } satisfies Phrase,
  comfort_north: { ru: "Внутренняя точка таланта", en: "Inner point of talent" } satisfies Phrase,
  comfort_east: { ru: "Вход денежной линии", en: "Entry of the money line" } satisfies Phrase,
  comfort_south: { ru: "Вход отношений и хвоста", en: "Entry of relationships and the tail" } satisfies Phrase,
  karmic_tail_middle: { ru: "Середина кармического хвоста", en: "Middle of the karmic tail" } satisfies Phrase,
  ajna_physics: { ru: "Аджна, физика", en: "Ajna, physics" } satisfies Phrase,
  ajna_energy: { ru: "Аджна, энергия", en: "Ajna, energy" } satisfies Phrase,
  anahata_physics: { ru: "Анахата, физика", en: "Anahata, physics" } satisfies Phrase,
  anahata_energy: { ru: "Анахата, энергия", en: "Anahata, energy" } satisfies Phrase,
  money_love_crossing: { ru: "Скрещение линий", en: "Crossing of the lines" } satisfies Phrase,
  love_middle: { ru: "Под сердцем", en: "Under the heart" } satisfies Phrase,
  money_middle: { ru: "Середина денежной линии", en: "Middle of the money line" } satisfies Phrase,
  center: { ru: "Центр карты", en: "Centre of the chart" } satisfies Phrase,
};

export const octagram = {
  portrait: { ru: "Портрет личности · A", en: "Personality portrait · A" } satisfies Phrase,
  fatherLine: { ru: "Духовная мужская линия · F", en: "Spiritual male line · F" } satisfies Phrase,
  spiritualTask: { ru: "Духовная задача · B", en: "Spiritual task · B" } satisfies Phrase,
  motherLine: { ru: "Духовная женская линия · G", en: "Spiritual female line · G" } satisfies Phrase,
  materialTask: { ru: "Материальная задача · C", en: "Material task · C" } satisfies Phrase,
  descendants: { ru: "Материальная мужская линия · H", en: "Material male line · H" } satisfies Phrase,
  karmicTask: { ru: "Кармическая задача · D", en: "Karmic task · D" } satisfies Phrase,
  inheritance: { ru: "Материальная женская линия · I", en: "Material female line · I" } satisfies Phrase,
  innerLeft: { ru: "Внутренняя левая · J", en: "Inner left · J" } satisfies Phrase,
  talentPoint: { ru: "Точка таланта · K", en: "Point of talent · K" } satisfies Phrase,
  moneyEntry: { ru: "Вход денег · L", en: "Entry of money · L" } satisfies Phrase,
  loveEntry: { ru: "Вход отношений и хвоста · M", en: "Entry of relationships and the tail · M" } satisfies Phrase,
  centre: { ru: "Центр карты · зона комфорта", en: "Centre of the chart · comfort zone" } satisfies Phrase,
  /** Оси схемы: вертикаль — небо, горизонталь — земля. Подписи стоят внутри квадрата. */
  sky: { ru: "небо", en: "sky" } satisfies Phrase,
  earth: { ru: "земля", en: "earth" } satisfies Phrase,
  nodeTitle: {
    ru: (label: string, n: number, title: string) => `${label}: аркан ${n} — ${title}`,
    en: (label: string, n: number, title: string) => `${label}: arcanum ${n} — ${title}`,
  } satisfies PhraseFn<[string, number, string]>,
  diagramAria: {
    ru: "Октаграмма матрицы судьбы: восемь внешних позиций, четыре точки комфорта, центр и восемь "
      + "точек второго порядка — середины линий любви, денег, кармического хвоста и таланта",
    en: "The octagram of the destiny matrix: eight outer positions, four comfort points, the centre "
      + "and eight second-order points — the middles of the lines of love, money, the karmic tail "
      + "and talent",
  } satisfies Phrase,
  mapAria: {
    ru: (names: string) => `Схема матрицы судьбы, отмечено: ${names}`,
    en: (names: string) => `Destiny matrix diagram, highlighted: ${names}`,
  } satisfies PhraseFn<[string]>,
  cardAlt: {
    ru: (n: number, title: string) => `Аркан ${n} — ${title}`,
    en: (n: number, title: string) => `Arcanum ${n} — ${title}`,
  } satisfies PhraseFn<[number, string]>,
  faqTitle: { ru: "Частые вопросы", en: "Common questions" } satisfies Phrase,
  relatedTitle: { ru: "Смотрите также", en: "See also" } satisfies Phrase,
  relatedHint: {
    ru: "Страницы, на которые ссылается разбор, и те, что ссылаются на него",
    en: "Pages this reading links to, and pages that link to it",
  } satisfies Phrase,
  encTitle: { ru: "Энциклопедия матрицы судьбы", en: "Destiny matrix encyclopedia" } satisfies Phrase,
  encNavAria: { ru: "Разделы справочника", en: "Sections of the encyclopedia" } satisfies Phrase,
  hubPromoTitle: { ru: "Посмотреть это в своей карте", en: "See this in your own chart" } satisfies Phrase,
  hubPromoLead: {
    ru: "Расчёт по дате рождения бесплатный и идёт в браузере, без регистрации.",
    en: "The calculation by date of birth is free, runs in the browser and needs no sign-up.",
  } satisfies Phrase,
  hubWhereNext: { ru: "Куда дальше", en: "Where to go next" } satisfies Phrase,
  hubWhereNextHint: { ru: "Справочник и полный разбор", en: "The encyclopedia and the full reading" } satisfies Phrase,
  karmicTail: { ru: "Кармический хвост", en: "Karmic tail" } satisfies Phrase,
  matrixForYear: { ru: "Матрица судьбы на год", en: "Destiny matrix for the year" } satisfies Phrase,
  fullReadingAll: { ru: "Полный разбор всех 20 разделов —", en: "The full reading of all 20 sections —" } satisfies Phrase,
  calcFreeLead: {
    ru: "Расчёт бесплатный и идёт в браузере: дата рождения не уходит на сервер.",
    en: "The calculation is free and runs in the browser: the date of birth never goes to the server.",
  } satisfies Phrase,
  pairTitle: {
    ru: (a: number, b: number) => `${a} и ${b}`,
    en: (a: number, b: number) => `${a} and ${b}`,
  } satisfies PhraseFn<[number, number]>,
};
