import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { createContent, paragraphText, type Paragraph } from "./contentReader";
import type { Lang } from "./i18n/hosts";
import { faqLd } from "./schema";

const real = JSON.parse(readFileSync("content/ru/karmic-tails.json", "utf8")) as { items: Record<string, unknown>[] };
const base = real.items.find((item) => item.key === "3-7-22")!;

function load(paragraphs: unknown[], faq?: unknown) {
  const item = {
    ...base,
    sections: [
      { h2: "Проверочный раздел", paragraphs },
      { h2: "Обычный раздел", paragraphs: ["Простой абзац длиннее двадцати знаков без всякой разметки."] },
    ],
    ...(faq ? { faq } : {}),
  };
  const source = {
    read: (file: string, locale: Lang, shared = false) => file === "karmic-tails.json"
      ? { ...real, items: real.items.map((other) => (other.key === "3-7-22" ? item : other)) }
      : JSON.parse(readFileSync(shared ? `content/${file}` : `content/${locale}/${file}`, "utf8")),
  };
  return createContent("ru", source).karmicTail("3-7-22")!;
}

const blocks: Paragraph[] = [
  "Абзац с **выделенной мыслью** посередине предложения.",
  { h3: "Подзаголовок" },
  { ul: ["**Первый.** пункт списка", "второй пункт"] },
  { ol: ["шаг один", "шаг два"] },
  { table: { head: ["", "Узник", "Беглец"], rows: [["Цена", "**жизнь** по расписанию", ""]] } },
];

describe("блоки в разделах статьи", () => {
  it("пропускает абзацы, подзаголовки, списки и таблицы в исходном порядке", () => {
    expect(load(blocks).sections[0].paragraphs).toEqual(blocks);
  });

  it.each([
    ["строки таблицы разной длины", { table: { head: ["a", "b"], rows: [["только одна"]] } }],
    ["неизвестный блок", { quote: "цитата" }],
    ["блок с двумя ключами", { h3: "a", ul: ["b"] }],
    ["пустой список", { ul: [] }],
    ["пустой пункт списка", { ul: ["пункт", " "] }],
    ["короткий абзац", "коротко"],
    ["толкования чакры нет в корпусе", { chakra_reading: { chakra: "manipura", triple: "1-1-2" } }],
    ["лишнее поле у толкования чакры", { chakra_reading: { chakra: "manipura", triple: "7-7-14", h3: "a" } }],
  ])("падает, а не выбрасывает раздел: %s", (_name, bad) => {
    expect(() => load([...blocks, bad])).toThrow("статья 3-7-22: раздел 1 «Проверочный раздел»");
  });

  it("толкование чакры приходит из корпуса платного отчёта", () => {
    const [item] = load([{ chakra_reading: { chakra: "manipura", triple: "7-7-14", note: "Около 11% дат." } }])
      .sections[0].paragraphs;
    expect(item).toMatchObject({ chakra_reading: {
      id: "combination-7-7-14", number: 3, note: "Около 11% дат.",
      row: { key: "manipura", title: "Манипура", heading: "Держать курс и сохранять меру" },
    } });
  });

  it("падает, а не выбрасывает вопрос FAQ с коротким ответом", () => {
    expect(() => load(blocks, [{ q: "Короткий ответ на вопрос?", a: "Нет." }])).toThrow("статья 3-7-22: вопрос FAQ 1");
  });

  it("лексика из политики не выбрасывает ни раздел, ни вопрос FAQ", () => {
    const article = load([...blocks, { ul: ["это не диагноз"] }],
      [{ q: "Значит ли хвост болезнь?", a: "Нет, хвост не говорит ничего о здоровье и не даёт гарантий." }]);
    expect(article.sections.map((section) => section.h2)).toEqual(["Проверочный раздел", "Обычный раздел"]);
    expect(article.faq).toHaveLength(1);
  });
});

describe("текст без разметки", () => {
  it("снимает выделение и разворачивает блоки в строку", () => {
    expect(blocks.map(paragraphText)).toEqual([
      "Абзац с выделенной мыслью посередине предложения.",
      "Подзаголовок",
      "Первый. пункт списка второй пункт",
      "шаг один шаг два",
      " Узник Беглец Цена жизнь по расписанию ",
    ]);
  });

  it("FAQPage получает ответ без звёздочек", () => {
    const ld = faqLd([{ q: "Вопрос **про хвост**?", a: "Ответ с **выделением** внутри." }]);
    expect(JSON.stringify(ld)).not.toContain("**");
    expect(ld.mainEntity[0].acceptedAnswer.text).toBe("Ответ с выделением внутри.");
  });
});
