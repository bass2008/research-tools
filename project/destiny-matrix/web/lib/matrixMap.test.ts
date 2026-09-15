import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  MAP_CENTER,
  MAP_POINTS,
  MAP_SIZE,
  mapPoint,
  mapPointsBySymbol,
  mapPointsFor,
  mapPointsForSection,
  mapXY,
  sectionLineKeys,
} from "./matrixMap";

// Схема карты обязана совпадать с методом, а не с собой: единственный источник правды здесь —
// `spec/method.json`. Поэтому тест сверяет состав точек и положение производных со спекой, а не
// с числами, переписанными из самого модуля.
const METHOD = JSON.parse(
  readFileSync(path.join(__dirname, "..", "..", "spec", "method.json"), "utf8"),
) as {
  points: Array<{ symbol: string; key: string; title: string; depends_on: string[] }>;
  ordered_results: Record<string, { symbols: string[]; keys?: string[] }>;
  chakras: Array<{ key: string; physics: string; energy: string }>;
};

const BY_SYMBOL = new Map(MAP_POINTS.map((p) => [p.symbol, p]));

describe("схема карты: состав точек", () => {
  it("покрывает все точки метода, ключ в ключ", () => {
    expect(MAP_POINTS.map((p) => p.symbol).sort()).toEqual(
      METHOD.points.map((p) => p.symbol).sort(),
    );
    for (const point of METHOD.points) {
      expect(BY_SYMBOL.get(point.symbol)?.key).toBe(point.key);
    }
  });

  it("не повторяет ни ключ, ни символ", () => {
    expect(new Set(MAP_POINTS.map((p) => p.key)).size).toBe(MAP_POINTS.length);
    expect(new Set(MAP_POINTS.map((p) => p.symbol)).size).toBe(MAP_POINTS.length);
  });

  it("держит каждую точку внутри картинки", () => {
    for (const point of MAP_POINTS) {
      const [x, y] = mapXY(point);
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(MAP_SIZE);
      expect(y).toBeLessThanOrEqual(MAP_SIZE);
    }
  });

  it("ставит центр в центр", () => {
    expect(mapXY(mapPoint("center")!)).toEqual([MAP_CENTER, MAP_CENTER]);
  });
});

// Правило геометрии одно: производная точка стоит между теми, из которых считается. На одном луче
// это середина отрезка (N, O, P, S, T), в нижнем правом секторе — середина дуги (R, R1, R2), где
// радиус у родителей общий, а делится угол. Поэтому проверяется вилка, а не точное равенство.
describe("схема карты: положение производных", () => {
  const derived = METHOD.points.filter((p) => p.depends_on.length === 2 && BY_SYMBOL.has(p.symbol));

  it("берёт всех, у кого ровно два родителя", () => {
    expect(derived.map((p) => p.symbol)).toEqual([
      "F", "G", "H", "I", "J", "K", "L", "M", "O", "P", "S", "T", "N", "R", "R1", "R2",
    ]);
  });

  for (const point of derived) {
    const parents = point.depends_on.map((s) => BY_SYMBOL.get(s)!);
    // F–I считаются из двух внешних точек разных лучей: метод складывает их значения, но места
    // «между» у них нет — они сами углы родового квадрата. Геометрия к ним не применяется.
    if (["F", "G", "H", "I", "J", "K", "L", "M"].includes(point.symbol)) continue;

    it(`ставит ${point.symbol} между ${point.depends_on.join(" и ")}`, () => {
      const self = BY_SYMBOL.get(point.symbol)!;
      const radii = parents.map((p) => p.radius);
      const angles = parents.map((p) => (p.radius === 0 ? self.angle : p.angle));
      expect(self.radius).toBeGreaterThanOrEqual(Math.min(...radii));
      expect(self.radius).toBeLessThanOrEqual(Math.max(...radii));
      expect(self.angle).toBeGreaterThanOrEqual(Math.min(...angles));
      expect(self.angle).toBeLessThanOrEqual(Math.max(...angles));
      // ровно посередине: либо по радиусу на общем луче, либо по углу на общей окружности
      const mid = angles[0] === angles[1]
        ? self.radius === (radii[0]! + radii[1]!) / 2
        : self.angle === (angles[0]! + angles[1]!) / 2 && self.radius === radii[0];
      expect(mid).toBe(true);
    });
  }

  // R1 на линии любви, R2 на денежной — порядок из источника метода. Перепутанные местами, они
  // дают внешне правдоподобную картинку: обе точки в том же секторе, обе между L/M и R.
  it("разводит R1 и R2 по своим линиям", () => {
    expect(BY_SYMBOL.get("R1")!.angle).toBeGreaterThan(BY_SYMBOL.get("R")!.angle);
    expect(BY_SYMBOL.get("R2")!.angle).toBeLessThan(BY_SYMBOL.get("R")!.angle);
    expect(BY_SYMBOL.get("R1")!.key).toBe("love_middle");
    expect(BY_SYMBOL.get("R2")!.key).toBe("money_middle");
  });
});

describe("подсветка", () => {
  it("возвращает точки в порядке запроса и без повторов", () => {
    const got = mapPointsFor(["mission", "center", "mission"]);
    expect(got.map((p) => p.symbol)).toEqual(["D", "E"]);
  });

  it("молча пропускает ключ, которого на карте нет", () => {
    expect(mapPointsFor(["нет такого"])).toEqual([]);
    expect(mapPoint("нет такого")).toBeNull();
  });

  // Раздел читается линией целиком: на странице хвоста подсвечены M, N и D, а не один вход M.
  it("подсвечивает линии ровно тем составом, что в методе", () => {
    const lines: Array<[string, string]> = [
      ["past_lives", "karmic_tail"],
      ["money", "money"],
      ["relations", "love"],
      ["profession", "talent"],
    ];
    for (const [section, inMethod] of lines) {
      const expected = METHOD.ordered_results[inMethod]!.keys!;
      expect(sectionLineKeys(section, ["center"])).toEqual(expected);
      expect(mapPointsForSection(section, ["center"]).map((p) => p.key)).toEqual(expected);
    }
  });

  it("разделу без линии оставляет его собственные точки", () => {
    expect(sectionLineKeys("purpose", ["day", "month"])).toEqual(["day", "month"]);
  });

  it("находит обе точки каждой чакры", () => {
    for (const chakra of METHOD.chakras) {
      const got = mapPointsBySymbol([chakra.physics, chakra.energy]);
      // у манипуры физика и энергия — один и тот же центр E, поэтому точка одна
      expect(got.length).toBe(chakra.physics === chakra.energy ? 1 : 2);
      expect(got.map((p) => p.symbol)).toEqual([...new Set([chakra.physics, chakra.energy])]);
    }
  });
});
