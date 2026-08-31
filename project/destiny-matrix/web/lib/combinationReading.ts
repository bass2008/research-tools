import {
  arcanumContent,
  combinationContent,
  type ArcanumContent,
  type CombinationContent,
} from "./content";

export type CombinationContextKey = "A-B" | "B-C" | "A-C";

interface ContextDefinition {
  key: CombinationContextKey;
  title: string;
  question: string;
  leftRole: "A" | "B" | "C";
  rightRole: "A" | "B" | "C";
  leftLabel: string;
  rightLabel: string;
}

export interface CombinationContextReading {
  key: CombinationContextKey;
  title: string;
  question: string;
  order: string;
  heading: string;
  paragraphs: string[];
}

export interface CombinationContextSection {
  key: CombinationContextKey;
  title: string;
  question: string;
  variants: CombinationContextReading[];
}

export interface CombinationArticleReading {
  slug: string;
  title: string;
  short: string;
  meaning: string[];
  contexts: CombinationContextSection[];
  practice: string[];
}

const CONTEXTS: ContextDefinition[] = [
  {
    key: "A-B",
    title: "Внешний образ и внутренняя задача",
    question: "Как первое впечатление соотносится с тем, что движет человеком изнутри",
    leftRole: "A",
    rightRole: "B",
    leftLabel: "портрет личности",
    rightLabel: "духовная задача",
  },
  {
    key: "B-C",
    title: "От внутреннего качества к поступку",
    question: "Как внутренняя задача превращается в практическое действие",
    leftRole: "B",
    rightRole: "C",
    leftLabel: "духовная задача",
    rightLabel: "материальная задача",
  },
  {
    key: "A-C",
    title: "Первое впечатление и реальное поведение",
    question: "Совпадает ли ожидание от внешнего образа с тем, как человек действует на деле",
    leftRole: "A",
    rightRole: "C",
    leftLabel: "портрет личности",
    rightLabel: "материальная задача",
  },
];

const ARCANA = new Map<number, ArcanumContent>();
const PAIRS = new Map<string, CombinationContent>();

function arcanum(number: number): ArcanumContent {
  const cached = ARCANA.get(number);
  if (cached) return cached;
  const value = arcanumContent(number);
  if (!value) throw new Error(`[combination] нет аркана ${number}`);
  ARCANA.set(number, value);
  return value;
}

function pair(a: number, b: number): CombinationContent {
  const slug = `${Math.min(a, b)}-${Math.max(a, b)}`;
  const cached = PAIRS.get(slug);
  if (cached) return cached;
  const value = combinationContent(slug);
  if (!value) throw new Error(`[combination] нет сочетания ${slug}`);
  PAIRS.set(slug, value);
  return value;
}

function definition(key: CombinationContextKey): ContextDefinition {
  const value = CONTEXTS.find((item) => item.key === key);
  if (!value) throw new Error(`[combination] неизвестный контекст ${key}`);
  return value;
}

/**
 * Один позиционный вариант пары. Его используют и каноническая статья сочетания, и
 * персональная статья характера — второго набора текстов для одного смысла нет.
 */
export function buildCombinationContext(
  leftNumber: number,
  rightNumber: number,
  key: CombinationContextKey,
): CombinationContextReading {
  if (leftNumber === rightNumber) {
    throw new Error(`[combination] одинаковые арканы ${leftNumber}-${rightNumber} читаются как повтор`);
  }
  const context = definition(key);
  const left = arcanum(leftNumber);
  const right = arcanum(rightNumber);

  return {
    key,
    title: context.title,
    question: context.question,
    order: `${leftNumber}-${rightNumber}`,
    heading: `${leftNumber} ${left.title} в ${context.leftRole}, ${rightNumber} ${right.title} в ${context.rightRole}`,
    paragraphs: [
      `${context.question}. В этом порядке ${left.title} занимает позицию ${context.leftRole} — ${context.leftLabel} с темой «${left.short}». ${right.title} занимает позицию ${context.rightRole} — ${context.rightLabel} с темой «${right.short}».`,
      `В сильном проявлении в позиции ${context.leftRole} человек ${left.plus[0]}, а в позиции ${context.rightRole} — ${right.plus[0]}. Пара работает согласованно, когда первое качество задаёт свой этап, а второе не спорит с ним, а продолжает его в собственной роли.`,
      `Напряжение появляется, когда в позиции ${context.leftRole} человек ${left.minus[0]}, а в позиции ${context.rightRole} — ${right.minus[0]}. Проверять эту связь полезно по последовательности: что было показано или задумано сначала и каким действием ситуация завершилась.`,
    ],
  };
}

/** Полная каноническая статья пары: общий смысл и оба порядка во всех ролях характера. */
export function buildCombinationArticle(a: number, b: number): CombinationArticleReading {
  if (a === b) throw new Error(`[combination] для повтора ${a}-${b} нет отдельной статьи пары`);
  const content = pair(a, b);
  const left = arcanum(content.a);
  const right = arcanum(content.b);

  return {
    slug: content.key,
    title: content.title,
    short: content.short,
    meaning: content.meaning,
    contexts: CONTEXTS.map((context) => ({
      key: context.key,
      title: context.title,
      question: context.question,
      variants: [
        buildCombinationContext(content.a, content.b, context.key),
        buildCombinationContext(content.b, content.a, context.key),
      ],
    })),
    practice: [
      `Сначала определите позиции пары в своей карте: смысл сочетания меняется в зависимости от того, какой аркан отвечает за внешний образ, какой — за внутреннюю задачу и какой — за поступок. Для ${content.a} ${left.title} и ${content.b} ${right.title} важно не менять арканы местами автоматически, а выбрать вариант с точным порядком ролей.`,
      `Затем сравните один реальный эпизод с двумя сторонами пары. Отметьте, где человек ${left.plus[0]} и где ${right.plus[0]}; отдельно проверьте моменты, когда он ${left.minus[0]} или ${right.minus[0]}. Такое наблюдение показывает, какое качество стоит включать первым, а каким завершать действие.`,
    ],
  };
}
