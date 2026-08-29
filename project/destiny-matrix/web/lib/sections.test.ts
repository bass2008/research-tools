import { describe, expect, it } from "vitest";

import { POINT_KEY, POINT_LABELS } from "@/lib/publicSpec";

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
    // пул раздела «комфорт» написан про центр карты: под «Комфортом в деле» он утверждал
    // «такой центр гасят», хотя речь про другую точку
    expect(text("comfort", "Комфорт в деле")).toBe(
      arcanumInPosition(m.comfort_south, "comfort_south"),
    );
    expect(text("comfort", "Комфорт в отношениях")).toBe(
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

  it("подпись, которая называет точку карты, обязана иметь свой ключ толкования", () => {
    // POINT_KEY ставится руками, и промах в нём не ломает сборку: раздел молча печатает
    // пул раздела, из-за чего под «Комфортом в деле» стоял текст про центр карты
    const points = new Set(Object.values(POINT_LABELS).map((l) => l.split(" — ")[0]));
    const orphans: string[] = [];
    for (const spec of SPEC) {
      for (const [label] of spec.positions(m)) {
        if (points.has(label) && !POINT_KEY[label]) orphans.push(`${spec.key}: ${label}`);
      }
    }
    expect(orphans).toEqual([]);
  });

  it("закрытый разбор не отдаёт платные позиции", () => {
    for (const s of build(m, false)) {
      if (s.access === "paid") expect(s.positions).toEqual([]);
    }
  });
});
