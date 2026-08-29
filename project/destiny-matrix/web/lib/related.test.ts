import { describe, expect, it } from "vitest";

import { backlinks, relatedBoth, resolveRef, resolveRefs } from "./related";
import { KARMIC_TAIL_HUB, YEAR_HUB, yearHref } from "./encyclopedia";

// Автор ставит связи указателем и в одну сторону: «arcanum/7», «position/center», «na-god/8».
// Адрес и заголовок собирает код, обратную ссылку — тоже он.
describe("указатель → ссылка", () => {
  it("аркан", () => {
    expect(resolveRef("arcanum/7")).toEqual({
      href: "/encyclopedia/arcanum/7",
      title: "7 в матрице судьбы: Колесница",
    });
  });

  it("позиция", () => {
    expect(resolveRef("position/center")?.href).toBe("/encyclopedia/position/center");
  });

  it("шапки категорий", () => {
    expect(resolveRef("karmic-tail")?.href).toBe(KARMIC_TAIL_HUB);
    expect(resolveRef("na-god")?.href).toBe(YEAR_HUB);
  });

  it("аркан года — и полной формой, и через na-god/N", () => {
    expect(resolveRef("na-god/7")?.href).toBe(yearHref("7"));
  });

  it("тройка хвоста — обе формы", () => {
    expect(resolveRef("tail/18-9-9")?.href).toBe("/encyclopedia/karmic-tail/18-9-9");
    expect(resolveRef("18-9-9")?.href).toBe("/encyclopedia/karmic-tail/18-9-9");
  });

  it.each([
    ["arcanum/23", "аркана вне 1…22"],
    ["arcanum/0", "нулевого аркана"],
    ["position/net-takoy", "несуществующей позиции"],
    ["tail/1-2-3", "ненаписанной тройки"],
    ["9-9-99", "мусорной тройки"],
    ["neizvestno", "неизвестного слага"],
    ["", "пустой строки"],
  ])("не выдумывает ссылку для %s (%s)", (ref) => {
    expect(resolveRef(ref)).toBeNull();
  });

  it("не повторяет одну цель дважды", () => {
    expect(resolveRefs(["arcanum/7", "arcanum/7"])).toHaveLength(1);
  });
});

describe("обратная сторона связи", () => {
  it("шапка «на год» ссылается на арканы года — значит на них видна ссылка назад", () => {
    const back = backlinks(yearHref("7"));
    expect(back.some((l) => l.href === YEAR_HUB)).toBe(true);
  });

  it("связи страницы собираются в обе стороны и без самой страницы", () => {
    const links = relatedBoth(yearHref("7"), ["arcanum/7", "na-god"]);
    const hrefs = links.map((l) => l.href);
    expect(hrefs).toContain("/encyclopedia/arcanum/7");
    expect(hrefs).toContain(YEAR_HUB);
    expect(hrefs).not.toContain(yearHref("7"));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
