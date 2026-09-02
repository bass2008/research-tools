import {
  arcanumContent,
  combinationContent,
  matrixItem,
  matrixSlugs,
  type ArcanumContent,
  type CombinationContent,
} from "./content";
import type { Matrix } from "./matrix";
import { positionRoleTemplate } from "./roleContent";
import { cubeClause } from "./text";

export type CombinationContextKey =
  | "A-B"
  | "B-C"
  | "A-C"
  | "E-M"
  | "E-K"
  | "M-K"
  | "B-P"
  | "P-K"
  | "B-K";
export type CombinationContextGroupKey = "character" | "comfort" | "profession";

interface ContextDefinition {
  key: CombinationContextKey;
  title: string;
  question: string;
  leftRole: "A" | "B" | "C" | "E" | "M" | "K" | "P";
  rightRole: "A" | "B" | "C" | "E" | "M" | "K" | "P";
  leftLabel: string;
  rightLabel: string;
  leftPosition: string;
  rightPosition: string;
  group: CombinationContextGroupKey;
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

export interface CombinationContextGroup {
  key: CombinationContextGroupKey;
  title: string;
  lead: string;
  href: string;
  linkLabel: string;
  contexts: CombinationContextSection[];
}

export interface CombinationArticleReading {
  slug: string;
  title: string;
  short: string;
  meaning: string[];
  groups: CombinationContextGroup[];
  /** Плоский список сохранён для проверок полноты корпуса. */
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
    leftPosition: "day",
    rightPosition: "month",
    group: "character",
  },
  {
    key: "B-C",
    title: "От внутреннего качества к поступку",
    question: "Как внутренняя задача превращается в практическое действие",
    leftRole: "B",
    rightRole: "C",
    leftLabel: "духовная задача",
    rightLabel: "материальная задача",
    leftPosition: "month",
    rightPosition: "year",
    group: "character",
  },
  {
    key: "A-C",
    title: "Первое впечатление и реальное поведение",
    question: "Совпадает ли ожидание от внешнего образа с тем, как человек действует на деле",
    leftRole: "A",
    rightRole: "C",
    leftLabel: "портрет личности",
    rightLabel: "материальная задача",
    leftPosition: "day",
    rightPosition: "year",
    group: "character",
  },
  {
    key: "E-M",
    title: "Внутренняя опора и автоматическая реакция",
    question: "Что происходит с базовым состоянием, когда человек реагирует без подготовки",
    leftRole: "E",
    rightRole: "M",
    leftLabel: "внутренний центр",
    rightLabel: "автоматическая реакция",
    leftPosition: "center",
    rightPosition: "comfort_south",
    group: "comfort",
  },
  {
    key: "E-K",
    title: "Внутренний центр и форма таланта",
    question: "Как врождённый талант помогает вернуться в устойчивое состояние",
    leftRole: "E",
    rightRole: "K",
    leftLabel: "внутренний центр",
    rightLabel: "талант, возвращающий управление",
    leftPosition: "center",
    rightPosition: "comfort_north",
    group: "comfort",
  },
  {
    key: "M-K",
    title: "От реакции к возвращению в центр",
    question: "Как перевести первую реакцию в действие, которое возвращает человеку управление",
    leftRole: "M",
    rightRole: "K",
    leftLabel: "автоматическая реакция",
    rightLabel: "талант, возвращающий управление",
    leftPosition: "comfort_south",
    rightPosition: "comfort_north",
    group: "comfort",
  },
  {
    key: "B-P",
    title: "Исходный дар и форма работы",
    question: "Как врождённый дар превращается в конкретный тип профессиональных задач",
    leftRole: "B",
    rightRole: "P",
    leftLabel: "исходный дар",
    rightLabel: "форма профессиональной реализации",
    leftPosition: "month",
    rightPosition: "profession",
    group: "profession",
  },
  {
    key: "P-K",
    title: "Форма работы и внутренний результат",
    question: "Как выбранный способ работать влияет на ощущение реализованности",
    leftRole: "P",
    rightRole: "K",
    leftLabel: "форма профессиональной реализации",
    rightLabel: "внутренний результат",
    leftPosition: "profession",
    rightPosition: "comfort_north",
    group: "profession",
  },
  {
    key: "B-K",
    title: "Дар и результат его реализации",
    question: "Совпадает ли итог работы с тем качеством, которое было дано изначально",
    leftRole: "B",
    rightRole: "K",
    leftLabel: "исходный дар",
    rightLabel: "внутренний результат",
    leftPosition: "month",
    rightPosition: "comfort_north",
    group: "profession",
  },
];

const GROUPS: Array<Omit<CombinationContextGroup, "contexts">> = [
  {
    key: "character",
    title: "Как пара работает в характере",
    lead: "Допустимые порядки пары для трёх связей раздела «Характер и личные качества».",
    href: "/encyclopedia/position/character",
    linkLabel: "Как читается раздел «Характер и личные качества» →",
  },
  {
    key: "comfort",
    title: "Как пара работает в центре и внутренних точках",
    lead: "Допустимые порядки пары для связей внутреннего центра E, реакции M и возвращающего таланта K.",
    href: "/encyclopedia/position/comfort",
    linkLabel: "Как читается раздел «Центр и внутренние точки» →",
  },
  {
    key: "profession",
    title: "Как пара работает в линии таланта",
    lead: "Допустимые порядки пары для перехода от исходного дара B через форму работы P к результату K.",
    href: "/encyclopedia/position/profession",
    linkLabel: "Как читается раздел «Профессия и дело по душе» →",
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

function roleValue(matrix: Matrix, role: ContextDefinition["leftRole"]): number {
  const values = {
    A: matrix.day,
    B: matrix.month,
    C: matrix.year,
    E: matrix.center,
    M: matrix.comfort_south,
    K: matrix.comfort_north,
    P: matrix.talent[1],
  } satisfies Record<ContextDefinition["leftRole"], number>;
  return values[role];
}

let REACHABLE_CONTEXT_ORDERS: Map<CombinationContextKey, Set<string>> | null = null;

function reachableContextOrders(): Map<CombinationContextKey, Set<string>> {
  if (REACHABLE_CONTEXT_ORDERS) return REACHABLE_CONTEXT_ORDERS;
  const result = new Map(
    CONTEXTS.map((context) => [context.key, new Set<string>()] as const),
  );
  for (const slug of matrixSlugs()) {
    const matrix = matrixItem(slug)!.matrix;
    for (const context of CONTEXTS) {
      const left = roleValue(matrix, context.leftRole);
      const right = roleValue(matrix, context.rightRole);
      result.get(context.key)!.add(`${left}-${right}`);
    }
  }
  REACHABLE_CONTEXT_ORDERS = result;
  return result;
}

/** Полный набор реально достижимых порядков нужен приёмочным тестам корпуса сочетаний. */
export function combinationContextOrders(key: CombinationContextKey): string[] {
  return [...reachableContextOrders().get(key)!];
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
  const leftRole = positionRoleTemplate(leftNumber, context.leftPosition);
  const rightRole = positionRoleTemplate(rightNumber, context.rightPosition);

  return {
    key,
    title: context.title,
    question: context.question,
    order: `${leftNumber}-${rightNumber}`,
    heading: `${leftNumber} ${left.title} в ${context.leftRole}, ${rightNumber} ${right.title} в ${context.rightRole}`,
    paragraphs: [
      `${context.question}. В этом порядке ${left.title} занимает позицию ${context.leftRole} — ${context.leftLabel}: ${leftRole.essence} ${right.title} занимает позицию ${context.rightRole} — ${context.rightLabel}: ${rightRole.essence}`,
      `В сильном проявлении в позиции ${context.leftRole} ${cubeClause(leftRole.strength)}, а в позиции ${context.rightRole} — ${cubeClause(rightRole.strength)}. Пара работает согласованно, когда первое качество задаёт свой этап, а второе не спорит с ним, а продолжает его в собственной роли.`,
      `Напряжение появляется, когда в позиции ${context.leftRole} ${cubeClause(leftRole.risk)}, а в позиции ${context.rightRole} — ${cubeClause(rightRole.risk)}. Проверять эту связь полезно по последовательности: что было показано или задумано сначала и каким действием ситуация завершилась.`,
    ],
  };
}

/** Полная каноническая статья пары: только те порядки ролей, которые даёт расчёт матрицы. */
export function buildCombinationArticle(a: number, b: number): CombinationArticleReading {
  if (a === b) throw new Error(`[combination] для повтора ${a}-${b} нет отдельной статьи пары`);
  const content = pair(a, b);
  const left = arcanum(content.a);
  const right = arcanum(content.b);

  const reachable = reachableContextOrders();
  const contexts = CONTEXTS.map((context) => ({
    key: context.key,
    title: context.title,
    question: context.question,
    variants: [
      buildCombinationContext(content.a, content.b, context.key),
      buildCombinationContext(content.b, content.a, context.key),
    ].filter((variant) => reachable.get(context.key)!.has(variant.order)),
  })).filter((context) => context.variants.length > 0);

  return {
    slug: content.key,
    title: content.title,
    short: content.short,
    meaning: content.meaning,
    contexts,
    groups: GROUPS.map((group) => ({
      ...group,
      contexts: contexts.filter((context) => definition(context.key).group === group.key),
    })).filter((group) => group.contexts.length > 0),
    practice: [
      `Сначала определите позиции пары в своей карте: смысл сочетания меняется в зависимости от того, читается ли оно в характере, во внутренних точках или в линии таланта. Для ${content.a} ${left.title} и ${content.b} ${right.title} важно не менять арканы местами автоматически, а выбрать вариант с точным порядком ролей.`,
      `Затем сравните один реальный эпизод с двумя сторонами пары. Отметьте, где человек ${left.plus[0]} и где ${right.plus[0]}; отдельно проверьте моменты, когда он ${left.minus[0]} или ${right.minus[0]}. Такое наблюдение показывает, какое качество стоит включать первым, а каким завершать действие.`,
    ],
  };
}
