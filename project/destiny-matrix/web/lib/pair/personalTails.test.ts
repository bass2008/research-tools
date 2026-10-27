import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LANGS } from "../i18n/lang";
import { PERSONAL_TAILS } from "./personalTails";
import { D } from "../i18n";
import type { Section } from "../contentReader";

const read = (L: string, file: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", L, file), "utf8"));

describe("личные хвосты в разборе пары", () => {
  for (const L of LANGS) {
    it(`${L}: список совпадает со статьями хвостов`, () => {
      const keys = (read(L, "karmic-tails.json").items as Array<{ key: string }>).map((x) => x.key).sort();
      expect([...PERSONAL_TAILS].sort()).toEqual(keys);
    });

    it(`${L}: у каждого хвоста короткая подводка к статье о хвосте пары`, () => {
      const articles = read(L, "karmic-tails.json").items as Array<{ key: string; sections: Section[] }>;
      const readings = articles.map((article) => {
        const sections = article.sections.filter((section) => section.h2 === D.encTail.inCompatibilityTitle[L]);
        expect(sections, article.key).toHaveLength(1);
        expect(sections[0].paragraphs, article.key).toHaveLength(1);
        expect(String(sections[0].paragraphs[0]).split(/[.!?](?:\s|$)/).filter(Boolean).length, article.key).toBeLessThanOrEqual(2);
        return JSON.stringify(sections[0].paragraphs);
      });
      expect(new Set(readings).size).toBe(articles.length);
    });
  }

  it("каждый личный хвост бывает и хвостом пары", () => {
    const pair = new Set((read("ru", "pair-units.json").items as Array<{ unit: string }>)
      .filter((u) => u.unit.startsWith("tasks:")).map((u) => u.unit.slice("tasks:".length)));
    expect([...PERSONAL_TAILS].filter((key) => !pair.has(key))).toEqual([]);
  });
});
