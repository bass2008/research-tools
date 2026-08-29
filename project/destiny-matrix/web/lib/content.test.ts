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
import { builtInPositionText } from "./positionTexts";

// Контент пишет генератор в web/content. Его может не быть вовсе, он может
// оказаться недописанным — сборка обязана выживать в любом случае.
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
      if (!c?.meaning) continue;
      expect(c.meaning.length).toBeGreaterThanOrEqual(3);
      for (const p of c.meaning) expect(p.length).toBeGreaterThan(20);
    }
  });

  it("seo подхватывается только целиком", () => {
    for (const a of ARCANA) {
      const seo = arcanumContent(a.n)?.seo;
      if (!seo) continue;
      expect(seo.title.length).toBeGreaterThanOrEqual(10);
      expect(seo.description.length).toBeGreaterThanOrEqual(60);
    }
  });

  it("статистика показывает, сколько записей нашлось", () => {
    const s = contentStats();
    for (const v of Object.values(s)) expect(v).toBeGreaterThanOrEqual(0);
    expect(s.arcana).toBeLessThanOrEqual(22);
    expect(s.chakras).toBeLessThanOrEqual(7);
  });

  it("карта энергий в справочнике использует те же позиционные тексты, что отчёт", () => {
    for (let n = 1; n <= 22; n++) {
      expect(arcanumInPosition(n, "chakras")).toBe(builtInPositionText(n, "chakras"));
    }
  });
});

describe("гигиена сгенерированного контента", () => {
  // Корень, а не подстрока: «влечение» и «развлечения» — не медицинская лексика, и проверка
  // по подстроке заставляла выбрасывать нормальные тексты (тот же список в lib/content.ts).
  const BANNED = ["лечени", "лечить", "лечит", "диагноз", "заболеван", "исцел", "целител",
    "болезн", "симптом", "терапи", "препарат", "набор веса", "алкогол", "гарантиру",
    "выздоравл", "недуг", "иммунит", "хроническ", "врач", "клиник"]
    .map((root) => new RegExp(`(^|[^а-яёa-z0-9])${root}`, "i"));

  function corpus(): string {
    const parts: string[] = [];
    for (const a of ARCANA) {
      const c = arcanumContent(a.n);
      if (!c) continue;
      parts.push(c.short ?? "", ...(c.keywords ?? []), ...(c.meaning ?? []),
        ...Object.values(c.inPositions ?? {}), ...(c.plus ?? []), ...(c.minus ?? []),
        c.seo?.title ?? "", c.seo?.description ?? "");
    }
    for (const p of POSITIONS) {
      const c = positionContent(p.key);
      if (!c) continue;
      parts.push(...(c.meaning ?? []), c.reading ?? "", c.seo?.title ?? "", c.seo?.description ?? "");
    }
    for (const ch of CHAKRA_PAGES) {
      const c = chakraContent(ch.key);
      if (!c) continue;
      parts.push(...(c.level ?? []), ...(c.columns ?? []).flatMap((x) => [x.title, x.text]),
        c.seo?.title ?? "", c.seo?.description ?? "");
    }
    return parts.join(" ").toLowerCase();
  }

  it("ни одно подхваченное поле не несёт медицинской лексики", () => {
    const text = corpus();
    for (const re of BANNED) expect(re.test(text), re.source).toBe(false);
  });

  it("отброшенные поля посчитаны", () => {
    corpus();
    expect(contentStats().rejected).toBeGreaterThanOrEqual(0);
  });
});
