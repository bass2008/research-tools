import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Octagram from "./Octagram";
import { calculate } from "@/lib/matrix";
import { MAP_POINTS, mapPoint, mapXY } from "@/lib/matrixMap";

// Дата с непустыми линиями: она же разобрана во внешнем источнике метода (линия любви 15–5–8).
const M = calculate({ year: 1990, month: 7, day: 15 }, "f");
const html = renderToStaticMarkup(<Octagram m={M} />);

/** Кружки точек. Кольца рисуются классом `ring` и без заливки — по ней точки и отличаются. */
function dots(markup: string) {
  return [...markup.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)" fill="[^"]*">/g)].map(
    (m) => ({ x: Number(m[1]), y: Number(m[2]), r: Number(m[3]) }),
  );
}

describe("октаграмма", () => {
  it("рисует все точки метода, а не только тринадцать", () => {
    expect(dots(html).length).toBe(MAP_POINTS.length);
  });

  // Ради этого правка и делалась: человек читает «10 под сердцем», а на карте такого места нет.
  it("ставит точки второго порядка туда же, где их показывает энциклопедия", () => {
    const placed = dots(html);
    for (const key of [
      "karmic_tail_middle", "money_love_crossing", "love_middle", "money_middle",
      "ajna_physics", "ajna_energy", "anahata_physics", "anahata_energy",
    ]) {
      const [x, y] = mapXY(mapPoint(key)!);
      expect(
        placed.some((d) => Math.abs(d.x - x) < 0.2 && Math.abs(d.y - y) < 0.2),
        `нет точки ${key} в (${x.toFixed(1)}, ${y.toFixed(1)})`,
      ).toBe(true);
    }
  });

  it("берёт значения из линий движка, а не пересчитывает по-своему", () => {
    const shown = (label: string) =>
      Number(new RegExp(`<title>${label}[^<]*: аркан (\\d+)`).exec(html)?.[1]);
    expect(shown("Под сердцем · R1")).toBe(M.love[1]);
    expect(shown("Скрещение линий · R")).toBe(M.love[2]);
    expect(shown("Середина денежной линии · R2")).toBe(M.money[1]);
    expect(shown("Середина кармического хвоста · N")).toBe(M.karmic_tail[1]);
    expect(shown("Аджна, энергия · P")).toBe(M.talent[1]);
    const anahata = M.chakras.find((c) => c.key === "anahata")!;
    expect(shown("Анахата, физика · S")).toBe(anahata.physics);
    expect(shown("Анахата, энергия · T")).toBe(anahata.energy);
    expect(shown("Аджна, физика · O")).toBe(M.chakras.find((c) => c.key === "ajna")!.physics);
  });

  // Восемь новых кружков втиснуты между уже стоявшими: R1 отходит от R всего на 55 единиц
  // viewBox, N от M — на 53. Наложение здесь не падение, а нечитаемая карта.
  it("не даёт кружкам наезжать друг на друга", () => {
    const placed = dots(html);
    const touching: string[] = [];
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i]!, b = placed[j]!;
        const gap = Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
        if (gap < 4) touching.push(`(${a.x},${a.y}) и (${b.x},${b.y}): зазор ${gap.toFixed(1)}`);
      }
    }
    expect(touching).toEqual([]);
  });

  // Подписи «небо» стояли на радиусе 195 — ровно там, где теперь сидят P и N.
  it("держит подписи осей в стороне от кружков", () => {
    const labels = [...html.matchAll(/<text class="lbl" x="([\d.]+)" y="([\d.]+)">/g)].map((m) => ({
      x: Number(m[1]),
      y: Number(m[2]),
    }));
    expect(labels.length).toBe(4);
    for (const label of labels) {
      for (const dot of dots(html)) {
        // подпись занимает примерно 34 × 9 единиц viewBox; проверяем её габарит, а не точку
        const dx = Math.max(0, Math.abs(label.x - dot.x) - 17);
        const dy = Math.max(0, Math.abs(label.y - dot.y) - 5);
        expect(
          Math.hypot(dx, dy),
          `подпись (${label.x}, ${label.y}) задевает кружок (${dot.x}, ${dot.y})`,
        ).toBeGreaterThan(dot.r);
      }
    }
  });

  it("делает каждую точку ссылкой на свой аркан", () => {
    const links = [...html.matchAll(/<a href="\/encyclopedia\/arcanum\/(\d+)"/g)];
    expect(links.length).toBe(MAP_POINTS.length);
    for (const link of links) {
      expect(Number(link[1])).toBeGreaterThanOrEqual(1);
      expect(Number(link[1])).toBeLessThanOrEqual(22);
    }
  });

  it("на странице карты обходится без ссылок", () => {
    const plain = renderToStaticMarkup(<Octagram m={M} linked={false} />);
    expect(plain).not.toContain("<a href");
    expect(dots(plain).length).toBe(MAP_POINTS.length);
  });
});
