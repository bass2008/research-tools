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
const CONTENT = path.join(__dirname, "..", "content");
const SOURCES: Record<string, string> = {
  "arcana.json": "n",
  "positions.json": "key",
  "chakras.json": "key",
  "combinations.json": "slug",
  "karmic-tails.json": "key",
  "year-arcana.json": "n",
  "category-hubs.json": "key",
  "hubs.json": "key",
};

interface Row {
  who: string;
  queries: string[];
  indexed: boolean;
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
    const byQuery = new Map<string, string[]>();
    for (const row of indexed) {
      for (const query of new Set(row.queries)) {
        byQuery.set(query, [...(byQuery.get(query) ?? []), row.who]);
      }
    }
    const clashes = [...byQuery.entries()]
      .filter(([, who]) => who.length > 1)
      .map(([query, who]) => `«${query}» → ${who.sort().join(", ")}`);
    expect(clashes).toEqual([]);
  });

  it("у каждого индексируемого адреса есть главный запрос", () => {
    expect(indexed.filter((row) => !row.queries[0])).toEqual([]);
  });
});
