import { D, L } from "./i18n";
import { describe, expect, it } from "vitest";

import { buildFree, sectionEntityLink } from "@/lib/publicSpec";

import { arcanumInPosition } from "./content";
import { calculate } from "./matrix";
import { SPEC, build, freePositionTexts } from "./sections";

const m = calculate("1990-05-17", "f");

function section(key: string) {
  const s = build(m, true).find((x) => x.key === key);
  if (!s) throw new Error(`нет раздела ${key}`);
  return s;
}

// Позиция ищется по номеру в разделе, а не по подписи: подписи приходят из словаря языка,
// и сверка с русской строкой проверяла бы язык сборки, а не привязку толкования.
function textAt(key: string, index: number) {
  const p = section(key).positions[index];
  if (!p) throw new Error(`в разделе ${key} нет позиции №${index}`);
  return p.text ?? "";
}

describe("разделы разбора", () => {
  it("толкование ключуется позицией, а не разделом", () => {
    // пул раздела «комфорт» написан про центр карты: под внутренней точкой он утверждал
    // «такой центр гасят», хотя речь про другую точку
    // Порядок позиций раздела задан спецификацией: центр, вход линии отношений, точка таланта.
    expect(textAt("comfort", 0)).toBe(arcanumInPosition(m.center, "center"));
    expect(textAt("comfort", 1)).toBe(arcanumInPosition(m.comfort_south, "comfort_south"));
    expect(textAt("comfort", 2)).toBe(arcanumInPosition(m.comfort_north, "comfort_north"));
  });

  it("позиции одного раздела не пересказывают друг друга", () => {
    for (const s of build(m, true)) {
      const texts = s.positions.map((p) => p.text ?? "");
      expect(new Set(texts).size).toBe(texts.length);
    }
  });

  it("у каждой позиции открытого раздела есть текст", () => {
    for (const s of build(m, true)) {
      for (const p of s.positions) expect((p.text ?? "").length).toBeGreaterThan(20);
    }
  });

  it("толкования карты энергий совпадают со страницей позиции в справочнике", () => {
    for (const position of section("chakras").positions) {
      // Повтор аркана намеренно ссылается на первую строку вместо второго одинакового абзаца.
      // Повтор аркана намеренно ссылается на первую строку вместо второго одинакового абзаца;
      // формулировка ссылки живёт в словаре языка.
      if (position.text?.startsWith(D.report.sameArcanum[L]("").slice(0, 12))) continue;
      expect(position.text).toBe(arcanumInPosition(position.arcanum, "chakras"));
    }
  });

  it("каждая строка получает ключ трактовки прямо из канонической спецификации", () => {
    for (const spec of SPEC) {
      for (const [label, arcanum, positionKey] of spec.positions(m)) {
        expect(label.length).toBeGreaterThan(2);
        expect(positionKey.length).toBeGreaterThan(2);
        expect(arcanumInPosition(arcanum, positionKey).length).toBeGreaterThan(20);
      }
    }
  });

  it("закрытый разбор не отдаёт платные позиции", () => {
    for (const s of build(m, false)) {
      if (s.access === "paid") expect(s.positions).toEqual([]);
    }
  });

  it("раздел характера ведёт на полный персональный разбор этой тройки", () => {
    const character = section("character");
    expect(character.personalHref).toBe(
      `/encyclopedia/character/${m.day}-${m.month}-${m.year}`,
    );
    expect(character.longform).toMatchObject({
      slug: `${m.day}-${m.month}-${m.year}`,
      roles: [
        { key: "A", arcanum: m.day },
        { key: "B", arcanum: m.month },
        { key: "C", arcanum: m.year },
      ],
    });
    expect(sectionEntityLink(character)).toMatchObject({
      href: `/encyclopedia/character/${m.day}-${m.month}-${m.year}`,
      entityType: "character",
      entityKey: `${m.day}-${m.month}-${m.year}`,
      positionKey: "character",
    });
  });

  it("бесплатный отчёт получает те же четыре ролевых кубика и итог, что PDF", () => {
    const full = section("character");
    const free = buildFree(m, freePositionTexts()).find((item) => item.key === "character")!;
    expect(free.positions.map((position) => position.role)).toEqual(full.longform!.roles);
    expect(free.conclusion).toEqual({
      summary: full.longform!.summary,
      strength: full.longform!.strength,
      tension: full.longform!.tension,
      practice: full.longform!.practice,
    });
  });

  it("только M–N–D ведёт на точный ordered-хвост", () => {
    const tail = section("past_lives");
    const key = m.karmic_tail.join("-");
    expect(sectionEntityLink(tail)).toMatchObject({
      href: `/encyclopedia/karmic-tail/${key}`,
      entityType: "karmic_tail",
      entityKey: key,
      positionKey: "past_lives",
    });
  });

  it("центр ведёт на персональную статью, а не на ошибочный кармический хвост", () => {
    const comfort = section("comfort");
    expect(comfort.positions).toHaveLength(3);
    expect(sectionEntityLink(comfort)).toMatchObject({
      href: `/encyclopedia/comfort/${m.center}-${m.comfort_south}-${m.comfort_north}`,
      entityType: "comfort",
      entityKey: `${m.center}-${m.comfort_south}-${m.comfort_north}`,
      positionKey: "comfort",
    });
  });

  it("бесплатный центр получает те же кубики и итог, что серверный PDF", () => {
    const full = section("comfort");
    const free = buildFree(m, freePositionTexts()).find((item) => item.key === "comfort")!;
    expect(free.personalHref).toBe(full.personalHref);
    expect(free.positions.map((position) => position.role)).toEqual(full.longform!.roles);
    expect(free.conclusion).toEqual({
      summary: full.longform!.summary,
      strength: full.longform!.strength,
      tension: full.longform!.tension,
      practice: full.longform!.practice,
    });
  });

  it("оплаченный раздел профессии получает линию B–P–K и персональную статью", () => {
    const profession = section("profession");
    const slug = m.talent.join("-");
    expect(profession.personalHref).toBe(`/encyclopedia/profession/${slug}`);
    expect(profession.longform?.roles.map((role) => [role.key, role.arcanum])).toEqual([
      ["B", m.talent[0]],
      ["P", m.talent[1]],
      ["K", m.talent[2]],
    ]);
    expect(sectionEntityLink(profession)).toMatchObject({
      href: `/encyclopedia/profession/${slug}`,
      entityType: "profession",
      entityKey: slug,
    });
    expect(build(m, false).find((item) => item.key === "profession")?.longform).toBeUndefined();
  });

  it("каждый формульный раздел получает персональную статью и тот же PDF-источник", () => {
    const excluded = new Set(["character", "past_lives"]);
    for (const item of build(m, true)) {
      if (excluded.has(item.key)) continue;
      expect(item.personalHref, item.key).toMatch(/^\/encyclopedia\//);
      expect(item.longform?.roles.length, item.key).toBe(item.positions.length);
      expect(item.longform?.summary.length, item.key).toBeGreaterThan(100);
      expect(sectionEntityLink(item).href, item.key).toBe(item.personalHref);
    }
  });

  it("кармический хвост берёт полный ordered-текст готовой статьи", () => {
    const tail = section("past_lives");
    expect(tail.personalHref).toBe(`/encyclopedia/karmic-tail/${m.karmic_tail.join("-")}`);
    expect(tail.fullArticle?.short.length).toBeGreaterThan(60);
    expect(tail.fullArticle?.sections.length).toBeGreaterThan(3);
    expect(tail.fullArticle?.faq.length).toBeGreaterThan(2);
    expect(tail.longform).toBeUndefined();
  });
});
