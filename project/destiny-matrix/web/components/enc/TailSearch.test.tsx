import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import TailSearch, { filterTails, normalizeTail } from "./TailSearch";

const tail = (key: string) => ({ key, names: key, href: `/encyclopedia/compatibility/tails/${key}` });
const tails = [tail("9-21-12"), tail("3-9-12"), tail("9-12-21")];
const keys = (q: string) => filterTails(tails, q).map((t) => t.key);

describe("поиск хвоста по трём числам", () => {
  it("пробелы, тире и точки сводятся к дефису, порядок сохраняется", () => {
    expect(normalizeTail(" 9 21 12 ")).toBe("9-21-12");
    expect(normalizeTail("9–21—12")).toBe("9-21-12");
    expect(normalizeTail("9.12.21")).toBe("9-12-21");
  });

  it("полная тройка — только точный порядок, без перестановок", () => {
    expect(keys("9 21 12")).toEqual(["9-21-12"]);
    expect(keys("12 21 9")).toEqual([]);
  });

  it("неполная тройка ищет по началу, не путая 9 и 19", () => {
    expect(keys("9")).toEqual(["9-21-12", "9-12-21"]);
    expect(keys("9-2")).toEqual([]);
  });

  it("без запроса список не раскрыт: полный перечень хвостов стоит после статьи", () => {
    const html = renderToStaticMarkup(<TailSearch locale="ru" tails={tails} pair />);
    expect(html).toContain('data-testid="tail-search"');
    expect(html).not.toContain("href=");
  });
});
