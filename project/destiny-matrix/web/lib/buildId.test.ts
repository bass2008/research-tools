import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildId } from "./buildId";

// Идентификатор сборки вшит в разметку каждой страницы: что попало в его основу, то сбрасывает
// встроенный `ETag` всего корпуса. Под ним лежат только манифесты маршрутов, поэтому основа —
// состав маршрутов и матчер middleware, и ничего сверх.
const WEB = path.join(__dirname, "..");

describe("идентификатор сборки", () => {
  it("устойчив: два вызова подряд дают одно значение", () => {
    expect(buildId(WEB)).toBe(buildId(WEB));
  });

  it("выглядит как хеш и годится для пути", () => {
    expect(buildId(WEB)).toMatch(/^[0-9a-f]{32}$/);
  });

  // Тот же исходник на другой машине обязан дать то же значение: иначе сборка образа и сборка
  // приёмки разойдутся, и `ETag` сбросится без единой правки. Внешних входов у расчёта нет —
  // ни окружения, ни git, ни локали, — и это здесь и проверяется.
  it("не зависит от локали и окружения", () => {
    const before = buildId(WEB);
    const saved = { ...process.env };
    process.env.LC_ALL = "C";
    process.env.LANG = "C";
    process.env.TZ = "Pacific/Kiritimati";
    try {
      expect(buildId(WEB)).toBe(before);
    } finally {
      process.env = saved;
    }
  });

  it("падает внятно, если каталога маршрутов нет", () => {
    expect(() => buildId(path.join(WEB, "nesushchestvuet"))).toThrow();
  });
});
