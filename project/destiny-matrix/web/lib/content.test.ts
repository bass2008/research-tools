import { readFileSync } from "node:fs";
import path from "node:path";

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
import { SPEC } from "./sections";
import { isBlockedText } from "./textPolicy";
// Канонический корпус обязателен: недописанный JSON должен ронять сборку, а не включать
// незаметно вторую версию текста из TypeScript.
describe("загрузчик сгенерированного контента", () => {
  it("у всех 20 разделов отчёта есть полноценная SEO-статья", () => {
    const templateOpening = /^(Смысл|Формула|Порядок|Связи|Пример|Практика|Границы|Соседние темы) (для )?[«"]/;
    for (const position of POSITIONS.filter((item) => item.kind === "section")) {
      const article = positionContent(position.key)!;
      // Правило 7 задаёт восемь глав как минимум: у части разделов к ним добавилась
      // отдельная глава с разобранным примером. Валидатор корпуса тоже проверяет `>= 8`.
      expect(article.sections.length, position.key).toBeGreaterThanOrEqual(8);
      expect(article.faq.length, position.key).toBe(5);
      expect(new Set(article.sections.map((section) => section.h2)).size, position.key)
        .toBe(article.sections.length);
      expect(new Set(article.faq.map((item) => item.q)).size, position.key).toBe(5);

      const paragraphs = article.sections.flatMap((section) => section.paragraphs);
      const words = paragraphs.join(" ").match(/[А-Яа-яЁёA-Za-z0-9–-]+/g) ?? [];
      expect(words.length, `${position.key}: статья слишком короткая`).toBeGreaterThanOrEqual(320);
      for (const paragraph of paragraphs) {
        expect(paragraph.length, position.key).toBeGreaterThanOrEqual(180);
        expect(templateOpening.test(paragraph), `${position.key}: шаблонный абзац`).toBe(false);
      }
    }
  });

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

  it("раздел характера опубликован как полноценная статья, а не короткая справка", () => {
    const character = positionContent("character")!;
    expect(character.sections).toHaveLength(8);
    expect(character.faq).toHaveLength(5);
    expect(character.sections.some((section) => section.h2.includes("Точка A"))).toBe(true);
    expect(character.sections.some((section) => section.h2.includes("4–3–22"))).toBe(true);
  });

  it("разделы центра и профессии опубликованы как полные непротиворечивые статьи", () => {
    for (const key of ["comfort", "profession"]) {
      const content = positionContent(key)!;
      expect(content.sections).toHaveLength(8);
      expect(content.faq).toHaveLength(5);
    }
    const profession = positionContent("profession")!;
    const text = [
      ...profession.meaning,
      ...profession.sections.flatMap((section) => section.paragraphs),
      ...profession.faq.map((item) => item.a),
    ].join(" ");
    expect(text).not.toContain("деньги приходят как естественное следствие");
    expect(text).not.toContain("дело не в человеке и не в усилиях");
    expect(text).toContain("доход зависит от навыков, спроса, качества результата и условий работы");
  });

  // Оферта называла бесплатным раздел «Что даёт вам внутренний комфорт», а он ещё в прошлой
  // итерации стал «Центром и внутренними точками»: публичный документ обещал то, чего на сайте нет.
  it("оферта называет бесплатные разделы их нынешними именами", () => {
    const page = readFileSync(path.join(__dirname, "..", "app", "oferta", "page.tsx"), "utf8");
    const free = SPEC.filter((section) => section.access === "free");
    expect(free).toHaveLength(2);
    for (const section of free) {
      expect(page, `в оферте нет раздела «${section.title}»`).toContain(section.title);
    }
  });

  it("страница визитки закрывает значение, расположение и расчёт точки A", () => {
    const day = positionContent("day")!;
    expect(day.sections.length).toBeGreaterThanOrEqual(8);
    expect(day.faq).toHaveLength(5);
    expect(day.sections.some((section) => section.h2.includes("Где находится визитка"))).toBe(true);
    expect(day.sections.some((section) => section.h2.includes("Как рассчитать"))).toBe(true);
    expect(day.sections.some((section) => section.h2.includes("полного характера"))).toBe(true);
  });

  it("каждый аркан имеет полный корпус 37 позиционных трактовок", () => {
    const expected = new Set(POSITIONS.map((position) => position.key));
    for (let n = 1; n <= 22; n++) {
      const content = arcanumContent(n)!;
      expect(new Set(Object.keys(content.inPositions))).toEqual(expected);
      for (const key of expected) expect(arcanumInPosition(n, key)).toBe(content.inPositions[key]);
    }
  });

  it("позиционные кубики не обещают события, деньги и медицинский результат", () => {
    const predictive = /деньги приходят|денежный канал|канал (?:открывается|закрывается|перекрывается)|этому человеку положено|почти наверняка|партн[её]ру прид[её]тся|долгие отношения держатся|реб[её]нок получает|обязательно произойд/i;
    const medical = /витамин|биодобавк|добавк[аи]|кофеин|диагноз|заболеван|лечени[ея]|назначени[ея] врача|спит по \d|сон по \d/i;
    for (let number = 1; number <= 22; number++) {
      const content = arcanumContent(number)!;
      for (const [position, text] of Object.entries(content.inPositions)) {
        expect(predictive.test(text), `${number}:${position}: буквальный прогноз`).toBe(false);
        if (position === "body_resource" || position === "years") {
          expect(medical.test(text), `${number}:${position}: медицинское обещание`).toBe(false);
        }
      }
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
      parts.push(
        ...c.meaning,
        c.reading,
        ...c.sections.flatMap((section) => [section.h2, ...section.paragraphs]),
        ...c.faq.flatMap((item) => [item.q, item.a]),
        c.seo.title,
        c.seo.description,
      );
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
