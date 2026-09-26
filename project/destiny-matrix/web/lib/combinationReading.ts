import {
  forLocale as localizedContent,
  type ArcanumContent,
  type CombinationContent
} from "./content";
import { D } from "./i18n";
import type { Phrase } from "./i18n/dict";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "./i18n/lang";
import { localized } from "./i18n/localized";
import type { Matrix } from "./matrix";
import { forLocale as localizedRoleContent } from "./roleContent";
import { forLocale as localizedText } from "./text";

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
  /** Подписи связи берутся из словаря: у каждого языка своя формулировка вопроса и ролей. */
  dict: { title: Phrase; question: Phrase; left: Phrase; right: Phrase };
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

/** A locale-bound view; safe to use alongside other languages. */
export const forLocale = localized((L: Locale) => {
  const { arcanumContent, combinationContent, matrixItem, matrixSlugs } = localizedContent(L);
  const { positionRoleTemplate } = localizedRoleContent(L);
  const { cubeClause } = localizedText(L);

  const CONTEXTS: ContextDefinition[] = ([
    {
      key: "A-B", dict: D.combination.ab, leftRole: "A", rightRole: "B",
      leftPosition: "day", rightPosition: "month", group: "character"
    },
    {
      key: "B-C", dict: D.combination.bc, leftRole: "B", rightRole: "C",
      leftPosition: "month", rightPosition: "year", group: "character"
    },
    {
      key: "A-C", dict: D.combination.ac, leftRole: "A", rightRole: "C",
      leftPosition: "day", rightPosition: "year", group: "character"
    },
    {
      key: "E-M", dict: D.combination.em, leftRole: "E", rightRole: "M",
      leftPosition: "center", rightPosition: "comfort_south", group: "comfort"
    },
    {
      key: "E-K", dict: D.combination.ek, leftRole: "E", rightRole: "K",
      leftPosition: "center", rightPosition: "comfort_north", group: "comfort"
    },
    {
      key: "M-K", dict: D.combination.mk, leftRole: "M", rightRole: "K",
      leftPosition: "comfort_south", rightPosition: "comfort_north", group: "comfort"
    },
    {
      key: "B-P", dict: D.combination.bp, leftRole: "B", rightRole: "P",
      leftPosition: "month", rightPosition: "profession", group: "profession"
    },
    {
      key: "P-K", dict: D.combination.pk, leftRole: "P", rightRole: "K",
      leftPosition: "profession", rightPosition: "comfort_north", group: "profession"
    },
    {
      key: "B-K", dict: D.combination.bk, leftRole: "B", rightRole: "K",
      leftPosition: "month", rightPosition: "comfort_north", group: "profession"
    },
  ] as const).map((item) => ({
    ...item,
    title: item.dict.title[L],
    question: item.dict.question[L],
    leftLabel: item.dict.left[L],
    rightLabel: item.dict.right[L],
  }));

  const GROUPS: Array<Omit<CombinationContextGroup, "contexts">> = [
    {
      key: "character",
      title: D.combination.groups.character.title[L],
      lead: D.combination.groups.character.lead[L],
      href: "/encyclopedia/position/character",
      linkLabel: D.combination.groups.character.link[L],
    },
    {
      key: "comfort",
      title: D.combination.groups.comfort.title[L],
      lead: D.combination.groups.comfort.lead[L],
      href: "/encyclopedia/position/comfort",
      linkLabel: D.combination.groups.comfort.link[L],
    },
    {
      key: "profession",
      title: D.combination.groups.profession.title[L],
      lead: D.combination.groups.profession.lead[L],
      href: "/encyclopedia/position/profession",
      linkLabel: D.combination.groups.profession.link[L],
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
  function combinationContextOrders(key: CombinationContextKey): string[] {
    return [...reachableContextOrders().get(key)!];
  }

  /**
   * Один позиционный вариант пары. Его используют и каноническая статья сочетания, и
   * персональная статья характера — второго набора текстов для одного смысла нет.
   */
  function buildCombinationContext(
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
      heading: D.combination.heading[L](
        leftNumber, left.title, context.leftRole, rightNumber, right.title, context.rightRole,
      ),
      paragraphs: [
        D.combination.intro[L](
          context.question, left.title, context.leftRole, context.leftLabel, leftRole.essence,
          right.title, context.rightRole, context.rightLabel, rightRole.essence,
        ),
        D.combination.strong[L](
          context.leftRole, cubeClause(leftRole.strength),
          context.rightRole, cubeClause(rightRole.strength),
        ),
        D.combination.tension[L](
          context.leftRole, cubeClause(leftRole.risk),
          context.rightRole, cubeClause(rightRole.risk),
        ),
      ],
    };
  }

  /** Полная каноническая статья пары: только те порядки ролей, которые даёт расчёт матрицы. */
  function buildCombinationArticle(a: number, b: number): CombinationArticleReading {
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
        D.combination.practiceFirst[L](content.a, left.title, content.b, right.title),
        D.combination.practiceSecond[L](left.plus[0], right.plus[0], left.minus[0], right.minus[0]),
      ],
    };
  }
  return { combinationContextOrders, buildCombinationContext, buildCombinationArticle };
});

// Compatibility for callers that explicitly use the deployment default.
export const { combinationContextOrders, buildCombinationContext, buildCombinationArticle } = forLocale(defaultLocale);
