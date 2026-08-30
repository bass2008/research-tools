import { describe, expect, it } from "vitest";

import { sectionEntityLink } from "@/lib/publicSpec";

import { arcanumInPosition } from "./content";
import { calculate } from "./matrix";
import { SPEC, build } from "./sections";

const m = calculate("1990-05-17", "f");

function section(key: string) {
  const s = build(m, true).find((x) => x.key === key);
  if (!s) throw new Error(`нет раздела ${key}`);
  return s;
}

function text(key: string, label: string) {
  const p = section(key).positions.find((x) => x.label === label);
  if (!p) throw new Error(`нет позиции «${label}» в разделе ${key}`);
  return p.text ?? "";
}

describe("разделы разбора", () => {
  it("толкование ключуется позицией, а не разделом", () => {
    // пул раздела «комфорт» написан про центр карты: под внутренней точкой он утверждал
    // «такой центр гасят», хотя речь про другую точку
    expect(text("comfort", "Вход линии отношений и хвоста")).toBe(
      arcanumInPosition(m.comfort_south, "comfort_south"),
    );
    expect(text("comfort", "Внутренняя точка таланта")).toBe(
      arcanumInPosition(m.comfort_north, "comfort_north"),
    );
    expect(text("comfort", "Центр карты")).toBe(arcanumInPosition(m.center, "center"));
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
      if (position.text?.startsWith("Тот же аркан")) continue;
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

  it("тройка в комфорте остаётся occurrence позиции, а не хвостом", () => {
    const comfort = section("comfort");
    expect(comfort.positions).toHaveLength(3);
    expect(sectionEntityLink(comfort)).toMatchObject({
      href: "/encyclopedia/position/comfort",
      entityType: "position",
      entityKey: "comfort",
      positionKey: "comfort",
    });
  });
});
