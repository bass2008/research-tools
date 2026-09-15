import { describe, expect, it } from "vitest";

import { calculate } from "./matrix";
import { exampleDay } from "./today";
import { buildYear, calendarYear, decadeExample } from "./yearExample";

// Эталон взят из внешнего источника метода дословно: «2027 → 2+0+2+7 = 11»
// (`spec/sources/gadalkindom-metodika-raschyota.html`). Своей формулой такое не проверяют.
describe("аркан календарного года", () => {
  it("совпадает с разобранным примером источника", () => {
    expect(calendarYear(2027)).toEqual({ year: 2027, digits: "2+0+2+7", sum: 11, arcanum: 11 });
  });

  it("сворачивает сумму больше 22", () => {
    // 1999 → 28 → 10; один шаг свёртки здесь обязателен, два дали бы 1
    expect(calendarYear(1999)).toEqual({ year: 1999, digits: "1+9+9+9", sum: 28, arcanum: 10 });
  });

  it("не сворачивает то, что уже в пределах 22", () => {
    expect(calendarYear(2026).sum).toBe(10);
    expect(calendarYear(2026).arcanum).toBe(10);
  });

  it("даёт аркан из 1..22 на любом годе корпуса", () => {
    for (let year = 1900; year <= 2100; year++) {
      const math = calendarYear(year);
      expect(math.arcanum).toBeGreaterThanOrEqual(1);
      expect(math.arcanum).toBeLessThanOrEqual(22);
      expect(math.digits.split("+").map(Number).reduce((a, b) => a + b, 0)).toBe(math.sum);
    }
  });

  it("берёт год сборки, а не дату-пример корпуса", () => {
    expect(buildYear()).toBe(new Date().getUTCFullYear());
  });
});

// Пример подбирается под аркан страницы, иначе у двадцати трёх страниц один и тот же абзац.
// Проверяется не текст, а само утверждение примера: человек с этой датой рождения сейчас правда
// проживает десятилетие под этим арканом.
describe("пример десятилетия", () => {
  const all = Array.from({ length: 22 }, (_, i) => decadeExample(i + 1));

  it("находится для каждого из 22 арканов", () => {
    expect(all.filter((x) => x === null)).toEqual([]);
  });

  it("сходится с движком: возраст попадает в свой сектор внешнего круга", () => {
    all.forEach((example, index) => {
      const arcanum = index + 1;
      const [day, month, year] = example!.birth.split(".").map(Number);
      const matrix = calculate({ year: year!, month: month!, day: day! }, "f");
      const slot = matrix.age_scale.find((s) => example!.age >= s.from && example!.age < s.to);
      expect(slot).toBeDefined();
      expect(slot!.arcanum).toBe(arcanum);
      expect([example!.from, example!.to]).toEqual([slot!.from, slot!.to]);
    });
  });

  it("считает возраст на дату-пример, а не на сегодня", () => {
    const today = exampleDay();
    for (const example of all) {
      const [day, month, year] = example!.birth.split(".").map(Number);
      const had = month! < today.month || (month === today.month && day! <= today.day);
      expect(had).toBe(true);
      expect(today.year - year! - (had ? 0 : 1)).toBe(example!.age);
    }
  });

  it("держит возраст в пределах живого человека", () => {
    for (const example of all) {
      expect(example!.age).toBeGreaterThanOrEqual(20);
      expect(example!.age).toBeLessThan(80);
    }
  });

  // Ради этого перебор и крутит сначала сектора, потом возраст, потом день года: одинаковые
  // примеры на соседних страницах — то же самое дублирование, из-за которого блок расчёта уехал
  // со страниц «на год» на хаб.
  it("даёт разным арканам разные примеры", () => {
    expect(new Set(all.map((x) => x!.birth)).size).toBe(22);
    expect(new Set(all.map((x) => x!.age)).size).toBeGreaterThan(10);
  });

  it("называет точку внешнего круга словами", () => {
    for (const example of all) {
      expect(example!.label).not.toBe("точка внешнего круга");
      expect(example!.label.length).toBeGreaterThan(5);
    }
  });

  it("повторяется от запуска к запуску", () => {
    expect(decadeExample(7)).toEqual(decadeExample(7));
  });
});
