import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { config, middleware } from "./middleware";
import robots from "./app/robots";
import sitemap from "./app/sitemap";
import { CONTENT_MODIFIED } from "@/lib/schema";
import { publicSettings } from "@/lib/settings/public";

// Дату не пересчитываем, а читаем из ответа: она приходит из сборки, и тест, знающий её
// «своими» вычислениями, проверял бы собственную копию формулы, а не поведение.
const EXACT = middleware(
  { method: "GET", headers: new Headers() } as unknown as Parameters<typeof middleware>[0],
).headers.get("Last-Modified") as string;
const MODIFIED = new Date(EXACT);
const shifted = (ms: number) => new Date(MODIFIED.getTime() + ms).toUTCString();

function call(headers: Record<string, string> = {}, method = "GET") {
  const request = { method, headers: new Headers(headers) } as unknown as Parameters<typeof middleware>[0];
  return middleware(request);
}

// Список, снятый с запроса, Next передаёт вниз этим заголовком.
const overridden = (response: ReturnType<typeof middleware>) =>
  response.headers.get("x-middleware-override-headers");

describe("дата корпуса", () => {
  it("читается без ошибки", () => {
    expect(Number.isNaN(MODIFIED.getTime())).toBe(false);
  });

  // Ручное движение даты забудут ровно тогда, когда это важно: релиз c1ca119 сменил каждую
  // страницу, а дата осталась прежней, и прод отвечал `304` на только что изменившееся.
  it("берётся из сборки, а не из константы корпуса", () => {
    const iso = publicSettings.get("buildIso");
    if (!iso) {
      // локальная сборка без скрипта релиза: отступаем к дате корпуса, поведение определено
      expect(EXACT).toBe(new Date(`${CONTENT_MODIFIED}T00:00:00Z`).toUTCString());
      return;
    }
    expect(MODIFIED.getTime()).toBe(Date.parse(iso));
  });

  // Метку передают все три скрипта сборки: пропущенная в одном тихо вернула бы ручную дату.
  it("передаётся каждым скриптом сборки", () => {
    const scripts = ["release-prod.sh", "release-test.sh", "run.sh"];
    const dir = path.join(__dirname, "..", "compose", "scripts");
    const missing = scripts.filter((name) => !readFileSync(path.join(dir, name), "utf8").includes("BUILD_ISO="));
    expect(missing).toEqual([]);
    const dockerfile = readFileSync(path.join(__dirname, "..", "compose", "web.Dockerfile"), "utf8");
    expect(dockerfile).toContain("ARG BUILD_ISO");
    expect(dockerfile).toContain("NEXT_PUBLIC_BUILD_ISO=${BUILD_ISO}");
  });

  // Опечатка в константе дала бы `Invalid Date`: 304 не наступил бы никогда, и потеря была бы
  // молчаливой — заголовок на месте, экономии нет.
  it("печатается форматом HTTP, а не датой из локали", () => {
    expect(call().headers.get("Last-Modified")).toMatch(
      /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/,
    );
  });

  // Две даты разведены намеренно: `lastmod` карты сайта и `dateModified` в разметке относятся к
  // содержанию и от прогона к прогону меняться не должны, а заголовок обязан двигаться на каждом
  // релизе. Сведи их обратно — и либо разметка врёт про правку текста, либо заголовок занижен.
  it("не привязана к дате карты сайта", () => {
    const iso = publicSettings.get("buildIso");
    if (!iso) return;
    expect(EXACT).not.toBe(new Date(`${CONTENT_MODIFIED}T00:00:00Z`).toUTCString());
  });

  // Дата из будущего недопустима: робот получит 304 на страницу, которой ещё не видел.
  it("не уходит в будущее", () => {
    expect(MODIFIED.getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe("ответ по дате", () => {
  it("отдаёт 304 без тела на ту же дату", () => {
    const response = call({ "if-modified-since": EXACT });
    expect(response.status).toBe(304);
    expect(response.body).toBeNull();
  });

  it("держит Last-Modified и в 304", () => {
    expect(call({ "if-modified-since": EXACT }).headers.get("Last-Modified")).toBe(EXACT);
  });

  it("отдаёт 304, когда у робота копия новее корпуса", () => {
    expect(call({ "if-modified-since": shifted(86_400_000) }).status).toBe(304);
  });

  it("отдаёт страницу на дату старее корпуса", () => {
    expect(call({ "if-modified-since": shifted(-86_400_000) }).status).not.toBe(304);
  });

  // Сравнение строгое: секунда до правки — уже устаревшая копия.
  it("не считает свежей копию на секунду старее", () => {
    expect(call({ "if-modified-since": shifted(-1000) }).status).not.toBe(304);
  });

  it("отдаёт 304 на копию ровно той же секунды", () => {
    expect(call({ "if-modified-since": shifted(0) }).status).toBe(304);
  });
});

describe("нечитаемая дата", () => {
  // Любой сбой разбора обязан вести к полному ответу: ложный 304 спрячет страницу, лишний
  // 200 стоит только трафика.
  it.each([
    ["мусор", "not-a-date"],
    ["пустая строка", ""],
    ["одни пробелы", "   "],
    ["число", "1756684800"],
    ["обрезанная", "Tue, 01 Sep"],
    ["несуществующий день", "Tue, 32 Sep 2026 00:00:00 GMT"],
  ])("на %s отдаёт страницу", (_name, value) => {
    expect(call({ "if-modified-since": value }).status).not.toBe(304);
  });
});

describe("приоритет отпечатка", () => {
  // RFC 9110 §13.2.2: при обоих заголовках побеждает `If-None-Match`, дата игнорируется.
  // Игнорировать приходится буквально — снятием с запроса: свежесть считает Next ниже по стеку
  // и по своим заголовкам ответа, где `Last-Modified` ещё нет, поэтому дата в запросе делала
  // страницу устаревшей даже при совпавшем отпечатке.
  it("не отвечает 304 по дате, когда пришёл отпечаток", () => {
    expect(call({ "if-none-match": '"any"', "if-modified-since": EXACT }).status).not.toBe(304);
  });

  it("снимает дату с запроса вниз", () => {
    const list = overridden(call({ "if-none-match": '"any"', "if-modified-since": EXACT }));
    expect(list).toBeTruthy();
    expect(list).not.toContain("if-modified-since");
    expect(list).toContain("if-none-match");
  });

  it.each(['"tag"', "*", 'W/"weak"', '"a", "b"'])("уступает отпечатку %s", (value) => {
    expect(call({ "if-none-match": value, "if-modified-since": EXACT }).status).not.toBe(304);
  });

  it("снимает дату и когда она старее корпуса — решает отпечаток", () => {
    const response = call({ "if-none-match": '"any"', "if-modified-since": shifted(-86_400_000) });
    expect(overridden(response)).not.toContain("if-modified-since");
  });

  it("ставит Last-Modified и на пути отпечатка", () => {
    expect(call({ "if-none-match": '"any"' }).headers.get("Last-Modified")).toBe(EXACT);
  });

  // Без даты в запросе трогать заголовки незачем: лишняя подмена — лишний риск.
  it("не подменяет заголовки запроса без нужды", () => {
    expect(overridden(call({ "if-none-match": '"any"' }) )).toBeNull();
    expect(overridden(call())).toBeNull();
  });
});

describe("методы", () => {
  it.each(["GET", "HEAD"])("%s получает дату корпуса", (method) => {
    expect(call({}, method).headers.get("Last-Modified")).toBe(EXACT);
  });

  it.each(["GET", "HEAD"])("%s отвечает 304 по дате", (method) => {
    expect(call({ "if-modified-since": EXACT }, method).status).toBe(304);
  });

  // Условный запрос определён только для GET и HEAD: 304 на POST оборвал бы отправку формы,
  // а дата корпуса на изменяющем ответе — ложь про его содержимое.
  it.each(["POST", "PUT", "PATCH", "DELETE", "OPTIONS"])("%s проходит нетронутым", (method) => {
    const response = call({ "if-modified-since": EXACT }, method);
    expect(response.status).not.toBe(304);
    expect(response.headers.get("Last-Modified")).toBeNull();
  });
});

describe("список адресов", () => {
  // Приближение к разбору Next: параметр — ровно один сегмент, совпадение по всему пути.
  const patterns = config.matcher.map(
    (pattern) => new RegExp(`^${pattern.replace(/:[a-zA-Z]+/g, "[^/]+")}$`),
  );
  const covers = (path: string) => patterns.some((re) => re.test(path));
  const paths = sitemap().map((entry) => new URL(entry.url).pathname.replace(/(.)\/$/, "$1"));

  it("покрывает каждый адрес карты сайта", () => {
    expect(paths.filter((path) => !covers(path))).toEqual([]);
  });

  // Обходимое, но не индексируемое: каталог матриц закрыт `noindex` и потому обязан скачиваться
  // — иначе робот мету не прочитает. Условный ответ экономит на нём 78 КБ за проход, поэтому в
  // списке он законен. Перечислен явно: любое другое расхождение с картой сайта — ошибка.
  const CRAWLED_UNINDEXED = ["/matrix"];

  it("не содержит адресов вне карты сайта, кроме объявленных", () => {
    const known = new Set([...paths, ...CRAWLED_UNINDEXED]);
    const extra = config.matcher.filter((pattern) => !pattern.includes(":") && !known.has(pattern));
    expect(extra).toEqual([]);
  });

  it("держит в списке обходимое, но не индексируемое", () => {
    for (const path of CRAWLED_UNINDEXED) expect(covers(path)).toBe(true);
  });

  // Главный сквозной инвариант: то, что закрыто от обхода, не может получать общую дату корпуса.
  // Иначе приватная или персональная страница отдаст из кэша браузера чужой разбор.
  it("не пересекается с запретами robots.txt", () => {
    const disallow = [[robots().rules].flat().find((rule) => rule.userAgent === "*")?.disallow]
      .flat()
      .filter((value): value is string => Boolean(value));
    const clash = config.matcher.filter((pattern) =>
      disallow.some((prefix) => pattern.startsWith(prefix)),
    );
    expect(clash).toEqual([]);
  });

  it.each([
    "/matrix/1-1-2",
    "/encyclopedia/comfort/4-6-13",
    "/encyclopedia/character/4-9-7",
    "/encyclopedia/money/1-2-3",
    "/encyclopedia/years/5",
    "/report",
    "/account",
    "/matrices/7",
    "/pay",
    "/pay/single",
    "/login",
    "/register",
    "/admin",
    "/print/report",
  ])("не захватывает %s", (path) => {
    expect(covers(path)).toBe(false);
  });

  // Служебные адреса: у карты сайта и robots своя частота правок, ассеты версионированы именем.
  it.each(["/robots.txt", "/sitemap.xml", "/_next/static/chunks/main.js", "/og.png", "/icon.svg", "/version/current.txt"])(
    "не захватывает служебный %s",
    (path) => {
      expect(covers(path)).toBe(false);
    },
  );

  // Параметр — один сегмент: иначе шаблон утянул бы вложенные адреса, которых у корпуса нет.
  it.each([
    "/encyclopedia/arcanum/4/extra",
    "/encyclopedia/position/comfort/8",
    "/na-god/13/plus",
    "/encyclopedia/karmic-tail/9-9-18/x",
  ])("не захватывает вложенный %s", (path) => {
    expect(covers(path)).toBe(false);
  });

  it("покрывает хабы и их страницы отдельными шаблонами", () => {
    for (const path of ["/encyclopedia/karmic-tail", "/encyclopedia/karmic-tail/9-9-18", "/na-god", "/na-god/13"]) {
      expect(covers(path)).toBe(true);
    }
  });
});
