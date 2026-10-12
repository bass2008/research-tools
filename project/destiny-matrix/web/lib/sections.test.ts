import { describe, expect, it } from "vitest";

import { buildFree, sectionEntityLink } from "@/lib/publicSpec";

import { arcanumInPosition, karmicTail } from "./content";
import { paragraphText } from "./contentReader";
import { calculate } from "./matrix";
import { wordCount } from "./lockedText";
import type { SectionOut } from "./publicSpec";
import { SPEC, build, freePositionTexts, withLockedPreview } from "./sections";

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
      if (s.longform?.layout === "chakras") continue; // Текст здесь относится к тройке, а не отдельной позиции.
      const texts = s.positions.map((p) => p.text ?? "");
      expect(new Set(texts).size).toBe(texts.length);
    }
  });

  it("у каждой позиции открытого раздела есть текст", () => {
    for (const s of build(m, true)) {
      if (s.longform?.layout === "chakras") continue;
      for (const p of s.positions) expect((p.text ?? "").length).toBeGreaterThan(20);
    }
  });

  it("карта энергий использует семь троек без старого текста отдельных позиций", () => {
    const chakraSection = section("chakras");
    expect(chakraSection.positions.every((position) => position.text === "")).toBe(true);
    const rows = chakraSection.longform!.chakraRows!;
    expect(rows).toHaveLength(7);
    expect(rows.map((row) => row.cells.map((cell) => cell.arcanum))).toEqual(
      [...m.chakras].reverse().map((row) => [row.physics, row.energy, row.emotions]),
    );
    for (const row of rows) {
      expect(row.paragraphs).toHaveLength(3);
      for (const cell of row.cells) {
        expect(row.paragraphs).not.toContain(arcanumInPosition(cell.arcanum, "chakras"));
      }
    }
    expect(build(m, false).find((item) => item.key === "chakras")?.longform).toBeUndefined();
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
    expect(tail.positions).toHaveLength(3);
    expect(tail.positions.every((position) => (position.text?.length ?? 0) > 20)).toBe(true);
    expect(tail.positions.flatMap((position) => position.article ? [position.article.href] : []))
      .not.toContainEqual(expect.stringMatching(/^\/encyclopedia\/position\/past_lives\//));
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
      if (item.key === "chakras") {
        // The report prints the whole chakra reading, so it links to the general guide instead.
        expect(item.personalHref).toBeUndefined();
        expect(sectionEntityLink(item).href).toBe("/encyclopedia/position/chakras");
      } else {
        expect(item.personalHref, item.key).toMatch(/^\/encyclopedia\//);
        expect(sectionEntityLink(item).href, item.key).toBe(item.personalHref);
      }
      if (item.longform?.layout === "chakras") {
        expect(item.longform.chakraRows).toHaveLength(7);
        expect(item.longform.roles).toEqual([]);
      } else {
        expect(item.longform?.roles.length, item.key).toBe(item.positions.length);
        expect(item.longform?.summary.length, item.key).toBeGreaterThan(100);
      }
    }
  });

  // The free article stays on the site for search traffic; the report holds only a short reading.
  it("кармический хвост в отчёте — короткая расшифровка со ссылкой на полную статью", () => {
    const tail = section("past_lives");
    const key = m.karmic_tail.join("-");
    expect(tail.personalHref).toBe(`/encyclopedia/karmic-tail/${key}`);
    const text = (tail.tailReading?.paragraphs ?? []).map(paragraphText).join(" ");
    const full = karmicTail(key)!.sections.flatMap((s) => s.paragraphs.map(paragraphText)).join(" ");
    expect(text.length).toBeGreaterThan(60);
    expect(text.length).toBeLessThan(full.length / 3);
    expect(tail.longform).toBeUndefined();
  });
});

// Всё, за что платят: толкования позиций, связный разбор раздела, хвост и тексты троек чакр.
// Вступление, примечание и темы чакр в закрытом разделе видны намеренно — их не собираем.
function paidStrings(sections: SectionOut[]): string[] {
  const shown = new Set(["lead", "chakraNote", "topic", "title", "label", "href", "slug", "testId"]);
  const out: string[] = [];
  const walk = (value: unknown, key: string) => {
    if (typeof value === "string") {
      if (value.length > 30 && !shown.has(key)) out.push(value);
    } else if (Array.isArray(value)) {
      for (const item of value) walk(item, key);
    } else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) walk(v, k);
    }
  };
  for (const s of sections) {
    if (s.access !== "paid") continue;
    for (const p of s.positions) walk(p.text, "text");
    walk(s.longform, "");
    walk(s.tailReading, "");
  }
  return out;
}

describe("закрытые разделы: что внутри, без толкований", () => {
  const preview = withLockedPreview(m, build(m, false));
  const full = build(m, true);

  it("каждый платный раздел помечен закрытым и несёт карты своих позиций", () => {
    for (const s of preview) {
      const open = full.find((x) => x.key === s.key)!;
      expect(Boolean(s.locked), s.key).toBe(s.access === "paid");
      if (!s.locked) continue;
      expect(s.positions.map((p) => [p.label, p.arcanum]), s.key)
        .toEqual(open.positions.map((p) => [p.label, p.arcanum]));
      for (const p of s.positions) expect(Object.keys(p).sort()).toEqual(["arcanum", "href", "label"]);
      expect(s.tailReading, s.key).toBeUndefined();
      expect(s.conclusion, s.key).toBeUndefined();
      if (s.key !== "chakras") expect(s.longform, s.key).toBeUndefined();
    }
  });

  it("чакры — та же раскладка, текст заменён заглушкой той же формы", () => {
    const locked = preview.find((s) => s.key === "chakras")!.longform!;
    const open = full.find((s) => s.key === "chakras")!.longform!;
    expect(locked.layout).toBe("chakras");
    expect(locked.lead).toBe(open.lead);
    expect(locked.chakraNote).toBe(open.chakraNote);
    const rows = [...locked.chakraRows!, locked.energyField!];
    const real = [...open.chakraRows!, open.energyField!];
    expect(rows).toHaveLength(8);
    rows.forEach((row, i) => {
      const source = real[i];
      expect(row.key).toBe(source.key);
      expect(row.topic).toBe(source.topic);
      expect(row.cells.map((c) => [c.title, c.arcanum])).toEqual(source.cells.map((c) => [c.title, c.arcanum]));
      expect(row.lockedWords).toBe(wordCount(source.paragraphs));
      expect(row.lockedWords).toBeGreaterThan(100);
      expect(row.paragraphs).toHaveLength(source.paragraphs.length);
      row.paragraphs.forEach((text, j) => {
        expect(text).not.toBe(source.paragraphs[j]);
        expect(Math.abs(text.length - source.paragraphs[j].length), `${row.key} ${j}`).toBeLessThan(25);
      });
    });
  });

  it("в закрытом разделе нет ни одного платного текста", () => {
    const sent = JSON.stringify(preview.filter((s) => s.locked));
    const paid = paidStrings(full);
    expect(paid.length).toBeGreaterThan(50);
    for (const text of paid) expect(sent.includes(text), text.slice(0, 60)).toBe(false);
  });

  it("открытый разбор проход не трогает", () => {
    expect(withLockedPreview(m, full)).toEqual(full);
  });
});
