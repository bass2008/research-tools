import { describe, expect, it } from "vitest";

import { allCombinationSlugs } from "./encyclopedia";
import { isBlockedText } from "./textPolicy";
import { buildCombinationArticle, buildCombinationContext } from "./combinationReading";

describe("полные статьи сочетаний", () => {
  it("раскрывает пару 3–4 в обоих порядках и трёх связях характера", () => {
    const article = buildCombinationArticle(3, 4);
    expect(article.slug).toBe("3-4");
    expect(article.contexts.map((context) => context.key)).toEqual(["A-B", "B-C", "A-C"]);
    for (const context of article.contexts) {
      expect(context.variants).toHaveLength(2);
      expect(context.variants.map((variant) => variant.order)).toEqual(["3-4", "4-3"]);
      for (const variant of context.variants) expect(variant.paragraphs).toHaveLength(3);
    }
    expect(buildCombinationContext(4, 3, "A-B").heading).toContain("4 Император в A");
  });

  it("покрывает все 231 сочетание полноценным безопасным корпусом", () => {
    const slugs = allCombinationSlugs();
    expect(slugs).toHaveLength(231);
    for (const slug of slugs) {
      const [a, b] = slug.split("-").map(Number);
      const article = buildCombinationArticle(a, b);
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
      expect(corpus.length).toBeGreaterThan(5000);
      expect(isBlockedText(corpus)).toBe(false);
    }
  });
});
