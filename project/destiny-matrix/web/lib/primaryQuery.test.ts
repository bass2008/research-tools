import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Два индексируемых адреса не могут целиться в один головной запрос. Когда целятся, поиск
// выбирает между ними сам и обычно занижает оба — это каннибализация, и итерация 5 записала
// правило в чеклист приёмки, но в тестах его не было. Цена пропуска: хаб чакр, выложенный в
// релизе c1ca119, забрал «чакры в матрице судьбы» у страницы раздела отчёта, и заметно это
// стало только при ручном разборе.
//
// Главным считается `seo.queries[0]`: именно он стоит в title и определяет, за что страница
// борется. Остальные запросы делить можно и нужно — одну тему описывают десятки формулировок.
const CONTENT = path.join(__dirname, "..", "content", process.env.NEXT_PUBLIC_SITE_LANG ?? "ru");
const SOURCES: Record<string, string> = {
  "arcana.json": "n",
  "positions.json": "key",
  "chakras.json": "key",
  "combinations.json": "slug",
  "karmic-tails.json": "key",
  "year-arcana.json": "n",
  "compatibility-arcana.json": "n",
  "category-hubs.json": "key",
  "hubs.json": "key",
  "compatibility-karmic-tails.json": "key",
};

interface Row {
  who: string;
  queries: string[];
  indexed: boolean;
}

const ENDING = /(ами|ями|ого|ему|ому|ах|ях|ам|ям|ов|ей|ой|ом|ем|ые|ый|ых|ым|ий|ь|[аеиоуыэюя])$/;
const FILLER = new Set(["в", "во", "и"]);

// Один запрос с точностью до формы и порядка слов: «22 аркана матрица судьбы» и «22 аркан в матрице
// судьбы» Вордстат считает одной фразой. Порядок чисел значим: «18 9 9» и «9 9 18» — разные хвосты.
function queryKey(query: string): string {
  const words = query.toLowerCase().replace(/ё/g, "е").match(/[\p{L}\p{N}_]+/gu) ?? [];
  const numbers = words.filter((w) => /^\d+$/.test(w));
  const stems = [...new Set(words.filter((w) => !/^\d+$/.test(w) && !FILLER.has(w)).map((w) => w.replace(ENDING, "")))];
  return `${numbers.join(" ")}|${stems.sort().join(" ")}`;
}

function rows(): Row[] {
  const out: Row[] = [];
  for (const [file, keyField] of Object.entries(SOURCES)) {
    const raw = JSON.parse(readFileSync(path.join(CONTENT, file), "utf8"));
    const items: Record<string, unknown>[] = Array.isArray(raw) ? raw : (raw.items ?? []);
    for (const item of items) {
      const seo = (item.seo ?? {}) as { queries?: unknown };
      const queries = Array.isArray(seo.queries)
        ? seo.queries.filter((q): q is string => typeof q === "string" && q.trim() !== "")
        : [];
      const publication = (item.publication ?? {}) as { index?: unknown };
      out.push({
        who: `${file.replace(".json", "")}/${item[keyField] ?? item.key}`,
        queries: queries.map((q) => q.trim().toLowerCase()),
        indexed: typeof publication.index === "boolean" ? publication.index : true,
      });
    }
  }
  const crossings = JSON.parse(readFileSync(path.join(CONTENT, "position-arcanum.json"), "utf8"));
  for (const item of crossings.items ?? []) {
    const queries = [item.primary_query, ...(item.queries ?? [])].filter(
      (q): q is string => typeof q === "string" && q.trim() !== "",
    );
    out.push({
      who: `position-arcanum/${item.position}/${item.arcanum}`,
      queries: queries.map((q) => q.trim().toLowerCase()),
      indexed: item.publication?.index !== false,
    });
  }
  return out;
}

describe("целевые запросы", () => {
  const indexed = rows().filter((row) => row.indexed && row.queries.length > 0);

  it("собраны из всего корпуса", () => {
    expect(indexed.length).toBeGreaterThan(300);
  });

  // Правило выбрано по корпусу, а не на глаз: из 2 265 уникальных запросов больше одним адресом
  // заявлены были ровно два — и оба оказались дефектами. Значит полная уникальность держится, и
  // любое новое пересечение — ошибка, а не норма.
  it("не заявлены двумя индексируемыми адресами", () => {
    const byQuery = new Map<string, { text: string; who: string[] }>();
    for (const row of indexed) {
      for (const key of new Set(row.queries.map(queryKey))) {
        const text = row.queries.find((q) => queryKey(q) === key) ?? key;
        const seen = byQuery.get(key) ?? { text, who: [] };
        seen.who.push(row.who);
        byQuery.set(key, seen);
      }
    }
    const clashes = [...byQuery.values()]
      .filter(({ who }) => who.length > 1)
      .map(({ text, who }) => `«${text}» → ${who.sort().join(", ")}`);
    expect(clashes).toEqual([]);
  });

  it("у каждого индексируемого адреса есть главный запрос", () => {
    expect(indexed.filter((row) => !row.queries[0])).toEqual([]);
  });
});
