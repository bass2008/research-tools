import { describe, expect, it } from "vitest";

import { articleLd, breadcrumbLd, faqLd, itemListLd } from "./schema";
import { parseTail, tailByFormula, tailShape } from "./encyclopedia";

// Article без author/datePublished/publisher Google отбраковывает целиком: разметка была,
// а толку от неё не было.
describe("Article", () => {
  const ld = articleLd({ headline: "Заголовок", description: "Описание", path: "/x" });

  it.each(["author", "publisher", "datePublished", "dateModified"])("несёт %s", (field) => {
    expect(ld).toHaveProperty(field);
  });

  it("ставит абсолютный адрес страницы", () => {
    expect((ld.mainEntityOfPage as { "@id": string })["@id"]).toMatch(/^https?:\/\/.+\/x$/);
  });

  it("не выдумывает keywords и image, когда их не передали", () => {
    expect(ld).not.toHaveProperty("keywords");
    expect(ld).not.toHaveProperty("image");
  });
});

describe("BreadcrumbList", () => {
  const ld = breadcrumbLd([
    { name: "Главная", path: "/" },
    { name: "Энциклопедия", path: "/encyclopedia" },
    { name: "7 в матрице судьбы" },
  ]);

  it("нумерует крошки с единицы", () => {
    expect(ld.itemListElement.map((x) => x.position)).toEqual([1, 2, 3]);
  });

  it("у последней крошки нет item: она и есть текущая страница", () => {
    expect(ld.itemListElement[2]).not.toHaveProperty("item");
    expect(ld.itemListElement[0]).toHaveProperty("item");
  });
});

describe("FAQPage и ItemList", () => {
  it("превращает вопросы в Question с ответом", () => {
    const ld = faqLd([{ q: "Вопрос?", a: "Ответ." }]);
    expect(ld.mainEntity[0].name).toBe("Вопрос?");
    expect(ld.mainEntity[0].acceptedAnswer.text).toBe("Ответ.");
  });

  it("считает элементы списка", () => {
    const ld = itemListLd({ name: "Хвосты", items: [{ name: "18-9-9", path: "/a" }] });
    expect(ld.numberOfItems).toBe(1);
  });
});

// Половина троек, которые ищут, формулой движка не получается — обещать «калькулятор покажет
// ваш хвост» можно только там, где раскладка есть.
describe("тройка кармического хвоста", () => {
  it("18-9-9 складывается по формуле: 9 + 9 = 18", () => {
    expect(tailByFormula([9, 9, 18])).toEqual({ year: 9, inheritance: 9 });
  });

  it("6-6-18 формулой не получается", () => {
    expect(tailByFormula([6, 6, 18])).toBeNull();
  });

  it("все перестановки тройки дают одну форму", () => {
    expect(tailShape([18, 9, 9])).toBe(tailShape([9, 18, 9]));
    expect(tailShape([9, 9, 18])).toBe("9-9-18");
  });

  it.each(["18-9", "0-9-9", "23-1-1", "abc", "9-9-9-9"])("%s тройкой не считается", (raw) => {
    expect(parseTail(raw)).toBeNull();
  });

  it("разбирает валидную тройку", () => {
    expect(parseTail("18-9-9")).toEqual([18, 9, 9]);
  });
});
