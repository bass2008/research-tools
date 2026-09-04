import { execFileSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CONTENT_MODIFIED } from "./schema";

// `CONTENT_MODIFIED` управляет двумя вещами сразу: `lastmod` в карте сайта и условным ответом
// `304` по дате. Пока константа отстаёт от корпуса, поиск, который спрашивает датой (Яндекс),
// получает «не менялось» и держит старые копии — правку он не увидит вовсе, молча.
//
// Этим и кончился релиз c1ca119: корпус пополнился четырьмя шапками, дата осталась на 01.09,
// и прод отвечал `304` на страницы, изменившиеся в тот же час. Отпечаток спас Google, датой
// спрашивающего — нет. Сторож ловит именно это: корпус не может быть новее своей даты.
const REPO = path.join(__dirname, "..", "..", "..", "..");
const CORPUS = ["project/destiny-matrix/web/content", "tools/seo/content"];

const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: REPO, encoding: "utf8" }).trim();

describe("дата корпуса", () => {
  it("записана как календарная дата", () => {
    expect(CONTENT_MODIFIED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(`${CONTENT_MODIFIED}T00:00:00Z`))).toBe(false);
  });

  it("не отстаёт от последней правки корпуса", () => {
    const committed = git("log", "-1", "--format=%cs", "--", ...CORPUS);
    expect(committed).not.toBe("");
    expect(CONTENT_MODIFIED >= committed).toBe(true);
  });

  // Незакоммиченная правка корпуса — это правка сегодняшняя: дата обязана её догнать до релиза,
  // иначе шлюз пропустит коммит, у которого `lastmod` уже неверен.
  it("догоняет незакоммиченную правку корпуса", () => {
    if (!git("status", "--porcelain", "--", ...CORPUS)) return;
    const today = new Date().toISOString().slice(0, 10);
    expect(CONTENT_MODIFIED).toBe(today);
  });
});
