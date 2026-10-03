import { describe, expect, it } from "vitest";
import { forLocale as localizedContent } from "./content";
import { karmicTailNumberIndex } from "./karmicTailIndex";

describe.each(["ru", "en"] as const)("указатель хвостов %s", (locale) => {
  const { indexedKarmicTailKeys } = localizedContent(locale);
  const keys = indexedKarmicTailKeys();
  const index = karmicTailNumberIndex(keys);

  it("ведёт только на опубликованные тройки и сохраняет все места каждого числа", () => {
    expect(keys).toHaveLength(26);
    expect(index.map((row) => row.arcanum)).toEqual(Array.from({ length: 20 }, (_, i) => i + 3));
    const actual = index.flatMap(({ arcanum, tails }) => tails.flatMap(({ key, places }) =>
      places.map((place) => `${key}/${place}/${arcanum}`),
    )).sort();
    const expected = keys.flatMap((key) => key.split("-").map((n, i) => `${key}/${["M", "N", "D"][i]}/${n}`)).sort();
    expect(actual).toEqual(expected);
    for (const row of index) {
      expect(new Set(row.tails.map((tail) => tail.key)).size).toBe(row.tails.length);
    }
  });

  it("различает порядки и не дублирует ссылку при повторении аркана", () => {
    const nine = index.find((row) => row.arcanum === 9)!;
    expect(nine.tails.find((tail) => tail.key === "18-9-9")?.places).toEqual(["N", "D"]);
    expect(nine.tails.find((tail) => tail.key === "9-18-9")?.places).toEqual(["M", "D"]);
    expect(nine.tails.find((tail) => tail.key === "9-9-18")?.places).toEqual(["M", "N"]);
    const six = index.find((row) => row.arcanum === 6)!;
    expect(six.tails.find((tail) => tail.key === "18-6-6")?.places).toEqual(["N", "D"]);
  });

  it("распределяет тройку по началу, середине и концу", () => {
    const three = index.find((row) => row.arcanum === 3)!;
    for (const [place, expected] of [
      ["M", ["3-13-10", "3-22-19", "3-7-22"]],
      ["N", ["18-3-12", "9-3-21"]],
      ["D", ["9-12-3"]],
    ] as const) {
      expect(three.tails.filter((tail) => tail.places.some((p) => p === place)).map((tail) => tail.key).sort())
        .toEqual([...expected].sort());
    }
  });
});
