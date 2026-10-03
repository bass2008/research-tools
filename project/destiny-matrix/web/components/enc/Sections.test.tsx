import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Faq from "@/components/ui/Faq";
import Sections from "./Sections";

describe("разделы статьи на странице", () => {
  const html = renderToStaticMarkup(
    <Sections items={[{
      h2: "Раздел",
      paragraphs: [
        "Абзац с **выделенной мыслью** внутри.",
        { h3: "Подзаголовок" },
        { ul: ["**Опись стен.** Выпишите всё"] },
        { ol: ["первый шаг"] },
        { table: { head: ["", "Узник"], rows: [["Цена", "**жизнь** по расписанию"]] } },
      ],
    }]} locale="ru" />,
  );

  it("выделение становится strong, звёздочек в разметке нет", () => {
    expect(html).toContain("<p>Абзац с <strong>выделенной мыслью</strong> внутри.</p>");
    expect(html).not.toContain("**");
  });

  it("рисует подзаголовок и оба вида списков", () => {
    expect(html).toContain("<h3>Подзаголовок</h3>");
    expect(html).toContain("<ul><li><strong>Опись стен.</strong> Выпишите всё</li></ul>");
    expect(html).toContain("<ol><li>первый шаг</li></ol>");
  });

  it("таблица повторяет существующую таблицу позиций и прокручивается сама", () => {
    expect(html).toContain('<div class="tabscroll"><table class="postab">');
    expect(html).toContain('<th scope="col">Узник</th>');
    expect(html).toContain("<td><strong>жизнь</strong> по расписанию</td>");
  });
});

describe("ответы FAQ", () => {
  const html = renderToStaticMarkup(
    <Faq items={[{ q: "Можно ли закрыть хвост?", a: "Числа не меняются, **меняется сценарий** вокруг них." }]} />,
  );

  it("выделяют мысль на странице, а в разметку для поиска уходят чистым текстом", () => {
    expect(html).toContain("<dd>Числа не меняются, <strong>меняется сценарий</strong> вокруг них.</dd>");
    expect(html).toContain('"text":"Числа не меняются, меняется сценарий вокруг них."');
  });
});
