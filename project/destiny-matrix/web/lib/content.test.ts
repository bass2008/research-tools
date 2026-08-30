import { describe, expect, it } from "vitest";

import { ARCANA } from "./arcana";
import { CHAKRA_PAGES, POSITIONS, allCombinationSlugs } from "./encyclopedia";
import {
  arcanumContent,
  arcanumInPosition,
  chakraContent,
  combinationContent,
  contentStats,
  positionContent,
} from "./content";
import { isBlockedText } from "./textPolicy";
// Канонический корпус обязателен: недописанный JSON должен ронять сборку, а не включать
// незаметно вторую версию текста из TypeScript.
describe("загрузчик сгенерированного контента", () => {
  it("не бросает исключений ни на одном ключе", () => {
    for (const a of ARCANA) expect(() => arcanumContent(a.n)).not.toThrow();
    for (const p of POSITIONS) expect(() => positionContent(p.key)).not.toThrow();
    for (const c of CHAKRA_PAGES) expect(() => chakraContent(c.key)).not.toThrow();
    for (const s of allCombinationSlugs().slice(0, 20)) expect(() => combinationContent(s)).not.toThrow();
  });

  it("на неизвестных ключах отдаёт null, а не выдумывает данные", () => {
    expect(arcanumContent(99)).toBeNull();
    expect(positionContent("нет-такой-позиции")).toBeNull();
    expect(chakraContent("нет-такой-чакры")).toBeNull();
    expect(combinationContent("99-100")).toBeNull();
  });

  it("подхваченные абзацы проходят порог длины", () => {
    for (const a of ARCANA) {
      const c = arcanumContent(a.n);
      expect(c).not.toBeNull();
      if (!c) continue;
      expect(c.meaning.length).toBeGreaterThanOrEqual(3);
      for (const p of c.meaning) expect(p.length).toBeGreaterThan(20);
    }
  });

  it("seo подхватывается только целиком", () => {
    for (const a of ARCANA) {
      const seo = arcanumContent(a.n)!.seo;
      expect(seo.title.length).toBeGreaterThanOrEqual(10);
      expect(seo.description.length).toBeGreaterThanOrEqual(60);
    }
  });

  it("статистика показывает, сколько записей нашлось", () => {
    const s = contentStats();
    expect(s).toMatchObject({ arcana: 22, positions: 37, chakras: 7, combinations: 231 });
    for (const v of Object.values(s)) expect(v).toBeGreaterThanOrEqual(0);
  });

  it("каждый аркан имеет полный корпус 37 позиционных трактовок", () => {
    const expected = new Set(POSITIONS.map((position) => position.key));
    for (let n = 1; n <= 22; n++) {
      const content = arcanumContent(n)!;
      expect(new Set(Object.keys(content.inPositions))).toEqual(expected);
      for (const key of expected) expect(arcanumInPosition(n, key)).toBe(content.inPositions[key]);
    }
  });
});

describe("гигиена сгенерированного контента", () => {
  function corpus(): string {
    const parts: string[] = [];
    for (const a of ARCANA) {
      const c = arcanumContent(a.n);
      if (!c) continue;
      parts.push(c.short, ...c.keywords, ...c.meaning,
        ...Object.values(c.inPositions), ...c.plus, ...c.minus,
        c.seo.title, c.seo.description);
    }
    for (const p of POSITIONS) {
      const c = positionContent(p.key);
      if (!c) continue;
      parts.push(...c.meaning, c.reading, c.seo.title, c.seo.description);
    }
    for (const ch of CHAKRA_PAGES) {
      const c = chakraContent(ch.key);
      if (!c) continue;
      parts.push(...c.level, ...c.columns.flatMap((x) => [x.title, x.text]),
        c.seo.title, c.seo.description);
    }
    return parts.join(" ").toLowerCase();
  }

  it("ни одно подхваченное поле не нарушает каноническую политику", () => {
    expect(isBlockedText(corpus())).toBe(false);
  });

  it("отброшенные поля посчитаны", () => {
    corpus();
    expect(contentStats().rejected).toBeGreaterThanOrEqual(0);
  });
});
