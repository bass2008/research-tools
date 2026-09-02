import { describe, expect, it } from "vitest";

import { allCombinationSlugs } from "./encyclopedia";
import { isBlockedText } from "./textPolicy";
import {
  buildCombinationArticle,
  buildCombinationContext,
  combinationContextOrders,
  type CombinationContextKey,
} from "./combinationReading";
import { positionRoleTemplate } from "./roleContent";
import { cubeClause } from "./text";

const CONTEXTS: CombinationContextKey[] = [
  "A-B", "B-C", "A-C", "E-M", "E-K", "M-K", "B-P", "P-K", "B-K",
];

describe("полные статьи сочетаний", () => {
  it("раскрывает для пары 3–4 только достижимые порядки и разделы", () => {
    const article = buildCombinationArticle(3, 4);
    expect(article.slug).toBe("3-4");
    expect(article.groups.map((group) => group.key)).toEqual(["character", "comfort"]);
    expect(article.contexts.map((context) => context.key)).toEqual([
      "A-B", "B-C", "A-C", "E-K",
    ]);
    expect(article.contexts.find((context) => context.key === "A-B")?.variants.map((x) => x.order))
      .toEqual(["3-4", "4-3"]);
    expect(article.contexts.find((context) => context.key === "E-K")?.variants.map((x) => x.order))
      .toEqual(["3-4"]);
    expect(buildCombinationContext(4, 3, "A-B").heading).toContain("4 Император в A");
    expect(buildCombinationContext(4, 3, "E-M").heading).toContain("4 Император в E");
    expect(buildCombinationContext(3, 10, "B-P").heading).toContain("10 Колесо в P");
  });

  it("использует в связях P те же специальные силу и риск, что персональный разбор", () => {
    const context = buildCombinationContext(3, 10, "B-P");
    const role = positionRoleTemplate(10, "profession");
    // Кубик написан целым предложением, и в перечислении он идёт со строчной буквы.
    expect(context.paragraphs[1]).toContain(cubeClause(role.strength));
    expect(context.paragraphs[2]).toContain(cubeClause(role.risk));
    expect(role.strength[0]).toBe(role.strength[0].toUpperCase());
  });

  it("покрывает все 231 сочетание без единого невозможного позиционного варианта", () => {
    const slugs = allCombinationSlugs();
    expect(slugs).toHaveLength(231);
    const generated = new Map(CONTEXTS.map((key) => [key, new Set<string>()]));
    for (const slug of slugs) {
      const [a, b] = slug.split("-").map(Number);
      const article = buildCombinationArticle(a, b);
      for (const context of article.contexts) {
        expect(context.variants.length).toBeGreaterThan(0);
        for (const variant of context.variants) {
          expect(combinationContextOrders(context.key)).toContain(variant.order);
          expect(variant.paragraphs).toHaveLength(3);
          generated.get(context.key)!.add(variant.order);
        }
      }
      const corpus = [
        article.title,
        article.short,
        ...article.meaning,
        ...article.contexts.flatMap((context) => [
          context.title,
          context.question,
          ...context.variants.flatMap((variant) => [variant.heading, ...variant.paragraphs]),
        ]),
        ...article.practice,
      ].join(" ");
      expect(isBlockedText(corpus)).toBe(false);
    }
    for (const key of CONTEXTS) {
      const expected = combinationContextOrders(key).filter((order) => {
        const [left, right] = order.split("-");
        return left !== right;
      });
      expect([...generated.get(key)!].sort()).toEqual(expected.sort());
    }
    expect(Object.fromEntries(CONTEXTS.map((key) => [
      key,
      combinationContextOrders(key).filter((order) => {
        const [left, right] = order.split("-");
        return left !== right;
      }).length,
    ]))).toEqual({
      "A-B": 252,
      "B-C": 241,
      "A-C": 441,
      "E-M": 25,
      "E-K": 167,
      "M-K": 120,
      "B-P": 151,
      "P-K": 158,
      "B-K": 158,
    });
    expect([...generated.values()].reduce((sum, orders) => sum + orders.size, 0)).toBe(1713);
  });
});
