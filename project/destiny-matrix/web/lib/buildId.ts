import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Идентификатор сборки для `generateBuildId`. По умолчанию Next выдаёт случайную строку и
// вшивает её в разметку каждой страницы — а раз тело другое, другим становится и встроенный
// `ETag`. Поэтому после каждого релиза поиск качал заново весь корпус, даже когда во фронте не
// менялось ничего (замер по логам прода за 11 дней: Googlebot получил 24 ответа `304` из 710
// повторных заходов).
//
// Значение обязано меняться ровно тогда, когда меняется то, что лежит под этим идентификатором.
// А лежат под ним три файла — `/_next/static/<id>/_buildManifest.js`, `_ssgManifest.js` и
// `_clientMiddlewareManifest.js`, — и в них только шаблоны маршрутов (`/encyclopedia/arcanum/[n]`)
// и матчер middleware. Ни текста статей, ни дат, ни кода страниц там нет.
//
// Отсюда основа: пути файлов маршрутов плюс содержимое `middleware.ts`. Правка статьи её не
// двигает, и это верно — новая статья не создаёт нового шаблона. Правка компонента тоже не
// двигает, и это тоже верно: от устаревшей разметки защищают не эти манифесты, а имена чанков.
// Имя чанка — хеш его содержимого и стоит прямо в теле страницы, поэтому изменившийся скрипт
// меняет разметку, а с ней `ETag`, сам по себе.
const ROUTE_FILES = /^(page|layout|route|default|not-found|error|loading|template)\.(tsx|ts|jsx|js)$/;

function routePaths(root: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(path.join(root, prefix), { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...routePaths(root, relative));
    else if (ROUTE_FILES.test(entry.name)) out.push(relative);
  }
  return out;
}

export function buildId(web: string): string {
  const routes = routePaths(path.join(web, "app")).sort();
  const middleware = readFileSync(path.join(web, "middleware.ts"), "utf8");
  return createHash("sha256").update(routes.join("\n")).update(middleware).digest("hex").slice(0, 32);
}
