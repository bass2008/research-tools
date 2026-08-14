import { describe, expect, it } from "vitest";

import { ARCANA, arcanum, roman } from "./arcana";
import {
  CHAKRA_PAGES,
  ENCYCLOPEDIA_PAGE_COUNT,
  POSITIONS,
  POSITION_KEYS,
  allCombinationSlugs,
  arcanumEntry,
  combination,
  combinationHref,
  encyclopediaIndex,
  parseCombinationSlug,
  positionByKey,
} from "./encyclopedia";
import { calculate } from "./matrix";
import { SECTION_KEYS, build } from "./sections";

describe("состав энциклопедии", () => {
  it("22 аркана с уникальными слагами и номерами", () => {
    expect(ARCANA).toHaveLength(22);
    expect(new Set(ARCANA.map((a) => a.slug)).size).toBe(22);
    expect(ARCANA.map((a) => a.n)).toEqual(Array.from({ length: 22 }, (_, i) => i + 1));
  });

  it("37 позиций: 20 разделов и 17 точек матрицы", () => {
    expect(POSITIONS).toHaveLength(37);
    expect(POSITIONS.filter((p) => p.kind === "section")).toHaveLength(20);
    expect(POSITIONS.filter((p) => p.kind === "point")).toHaveLength(17);
    expect(new Set(POSITION_KEYS).size).toBe(37);
    for (const key of SECTION_KEYS) expect(positionByKey(key)).toBeDefined();
  });

  it("17 точек — ровно те, что есть в матрице", () => {
    const m = calculate("1987-06-14", "f") as unknown as Record<string, unknown>;
    for (const p of POSITIONS.filter((x) => x.kind === "point")) {
      expect(typeof m[p.key], p.key).toBe("number");
    }
  });

  it("231 сочетание, a < b", () => {
    const slugs = allCombinationSlugs();
    expect(slugs).toHaveLength(231);
    expect(new Set(slugs).size).toBe(231);
    for (const s of slugs) {
      const pair = parseCombinationSlug(s);
      expect(pair, s).not.toBeNull();
      expect(pair![0]).toBeLessThan(pair![1]);
    }
  });

  it("порядок в ссылке на сочетание нормализуется", () => {
    expect(combinationHref(14, 3)).toBe("/encyclopedia/combination/3-14");
    expect(combinationHref(3, 14)).toBe("/encyclopedia/combination/3-14");
  });

  it("мусорные слаги сочетаний отклонены", () => {
    for (const bad of ["0-5", "5-5", "7-3", "1-23", "abc", "1-", "1-2-3", "01-2x"]) {
      expect(parseCombinationSlug(bad), bad).toBeNull();
    }
  });

  it("7 чакр", () => {
    expect(CHAKRA_PAGES).toHaveLength(7);
    expect(CHAKRA_PAGES.map((c) => c.index)).toEqual([7, 6, 5, 4, 3, 2, 1]);
  });

  it("итого 298 статических страниц", () => {
    expect(ENCYCLOPEDIA_PAGE_COUNT).toBe(298);
  });
});

describe("ArcanumEntry по контракту", () => {
  it("каждый аркан отдаёт полную запись", () => {
    for (let n = 1; n <= 22; n++) {
      const e = arcanumEntry(n);
      expect(e.n).toBe(n);
      expect(e.matrix_number).toBe(n);
      expect(e.roman).toBe(roman(n));
      expect(e.slug).toBe(arcanum(n).slug);
      expect(e.short.length).toBeGreaterThan(10);
      expect(e.keywords.length).toBeGreaterThanOrEqual(4);
      expect(e.meaning.split("\n\n").length).toBeGreaterThanOrEqual(3);
      expect(e.meaning.length).toBeGreaterThan(500);
      expect(e.plus.length).toBeGreaterThanOrEqual(3);
      expect(e.minus.length).toBeGreaterThanOrEqual(3);
      expect(e.combinations).toHaveLength(21);
      expect(Object.keys(e.in_positions).length).toBeGreaterThanOrEqual(5);
      expect(e.seo.title).toContain(String(n));
      expect(e.seo.description.length).toBeGreaterThan(60);
    }
  });

  it("сочетания аркана ведут на существующие страницы", () => {
    const known = new Set(allCombinationSlugs().map((s) => `/encyclopedia/combination/${s}`));
    for (let n = 1; n <= 22; n++) {
      for (const c of arcanumEntry(n).combinations) {
        expect(known.has(c.href), c.href).toBe(true);
        expect(c.with).not.toBe(n);
      }
    }
  });

  it("страница сочетания текстово различается для разных пар", () => {
    const texts = allCombinationSlugs().map((s) => {
      const [a, b] = parseCombinationSlug(s)!;
      return combination(a, b).paragraphs.join(" ");
    });
    expect(new Set(texts).size).toBe(231);
    for (const t of texts) expect(t.length).toBeGreaterThan(600);
  });
});

describe("перелинковка без тупиков", () => {
  it("индекс ведёт на все арканы, позиции и чакры", () => {
    const idx = encyclopediaIndex();
    expect(idx.arcana).toHaveLength(22);
    expect(idx.positions).toHaveLength(37);
    expect(idx.chakras).toHaveLength(7);
    expect(idx.combinations_count).toBe(231);
    for (const a of idx.arcana) expect(a.href).toBe(`/encyclopedia/arcanum/${a.n}`);
    for (const p of idx.positions) expect(p.href).toBe(`/encyclopedia/position/${p.key}`);
    for (const c of idx.chakras) expect(c.href).toBe(`/encyclopedia/chakra/${c.key}`);
  });

  it("каждая позиция отчёта ведёт на существующий аркан", () => {
    const m = calculate("1987-06-14", "m");
    for (const s of build(m, true)) {
      for (const p of s.positions) {
        expect(p.arcanum).toBeGreaterThanOrEqual(1);
        expect(p.arcanum).toBeLessThanOrEqual(22);
        expect(p.href).toBe(`/encyclopedia/arcanum/${p.arcanum}`);
      }
    }
  });
});

describe("формулировки", () => {
  const corpus = [
    ...ARCANA.flatMap((a) => [
      a.short, a.essence, a.gift, a.shadow, a.advice,
      ...a.meaning, ...a.plus, ...a.minus, ...Object.values(a.inPositions),
    ]),
    ...POSITIONS.flatMap((p) => [p.title, p.lead, ...p.paragraphs]),
    ...CHAKRA_PAGES.flatMap((c) => [c.title, c.lead, ...c.paragraphs]),
  ]
    .join(" ")
    .toLowerCase();

  it("нет медицинских формулировок", () => {
    for (const bad of [
      "лечен", "лечит", "диагноз", "заболеван", "исцел", "целитель", "болезн",
      "симптом", "терапи", "препарат", "набор веса", "алкогол",
    ]) {
      expect(corpus, bad).not.toContain(bad);
    }
  });

  it("нет обещаний гарантий", () => {
    for (const bad of ["гарантиру", "гарантия", "обязательно исполн", "точно сбудется", "100% результат"]) {
      expect(corpus, bad).not.toContain(bad);
    }
  });

  it("нет латиницы в названиях арканов", () => {
    for (const a of ARCANA) expect(a.title, a.title).not.toMatch(/[A-Za-z]/);
  });
});
