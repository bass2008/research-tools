import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PositionMap from "./PositionMap";
import { MAP_POINTS, mapPointsFor, mapPointsForSection } from "@/lib/matrixMap";

const draw = (keys: string[], caption = "подпись") =>
  renderToStaticMarkup(<PositionMap highlight={mapPointsFor(keys)} caption={caption} />);

describe("схема карты на странице", () => {
  const html = draw(["love_middle"]);

  it("рисует все точки метода, а не только подсвеченную", () => {
    expect(html.match(/<title>/g)?.length).toBe(MAP_POINTS.length);
    for (const point of MAP_POINTS) expect(html).toContain(`${point.label} · ${point.symbol}`);
  });

  // Сборка уже падала на этом: каркас искал точки по углам, которых в списке нет, и координата
  // приезжала undefined. Проверять на подстроку «undefined» бесполезно — React такой атрибут
  // просто не печатает, и фигура молча теряет размер. Поэтому требуется наличие каждого числа.
  it("задаёт каждой фигуре полный набор числовых координат", () => {
    const required: Record<string, string[]> = {
      circle: ["cx", "cy", "r"],
      line: ["x1", "y1", "x2", "y2"],
      text: ["x", "y", "font-size"],
      polygon: ["points"],
    };
    const tags = [...html.matchAll(/<(circle|line|text|polygon)\s([^>]*)>/g)];
    // два кольца, восьмиугольник и два ромба, четыре оси, на каждую точку кружок и подпись,
    // плюс ореол подсветки
    expect(tags.length).toBe(2 + 3 + 4 + MAP_POINTS.length * 2 + 1);
    for (const [, tag, attrs] of tags) {
      for (const name of required[tag!]!) {
        const value = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs!)?.[1];
        expect(value, `${tag}.${name} в «${attrs}»`).toBeDefined();
        const numbers = value!.split(/[\s,]+/).map(Number);
        expect(numbers.every((n) => Number.isFinite(n)), `${tag}.${name}="${value}"`).toBe(true);
      }
    }
  });

  it("помечает подсвеченную точку и только её", () => {
    expect(html.match(/class="spot on"/g)?.length).toBe(1);
    expect(html.match(/class="halo"/g)?.length).toBe(1);
    expect(html).toContain("Под сердцем · R1");
  });

  it("называет подсвеченное в подписи для чтеца экрана", () => {
    expect(html).toContain('aria-label="Схема матрицы судьбы, отмечено: Под сердцем · R1"');
    expect(html).toContain("<figcaption>подпись</figcaption>");
  });

  it("подсвечивает линию раздела целиком", () => {
    const line = renderToStaticMarkup(
      <PositionMap highlight={mapPointsForSection("past_lives", [])} caption="линия" />,
    );
    expect(line.match(/class="spot on"/g)?.length).toBe(3);
    expect(line).toMatch(/отмечено:[^"]*· M,[^"]*· N,[^"]*· D/);
  });

  // Шести позициям корпуса точки на октаграмме не положено — у них схемы быть не должно вовсе,
  // а не пустая рамка с подписью.
  it("ничего не рисует, когда подсвечивать нечего", () => {
    expect(renderToStaticMarkup(<PositionMap highlight={[]} caption="пусто" />)).toBe("");
  });
});
