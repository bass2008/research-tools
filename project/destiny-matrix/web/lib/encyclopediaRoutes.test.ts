import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PERSONAL_SECTION_KEYS } from "./sectionReadingShared";

const APP = path.join(__dirname, "..", "app", "encyclopedia");
// У этих двух разделов свои статические маршруты с конечным реестром троек.
const OWN_ROUTES: Record<string, string> = { comfort: "comfort/[triple]", profession: "profession/[triple]" };

describe("маршруты персональных разборов", () => {
  it("даёт каждому разделу собственный путь вместо общего перехватчика", () => {
    const missing = PERSONAL_SECTION_KEYS.filter(
      (key) => !existsSync(path.join(APP, OWN_ROUTES[key] ?? `${key}/[slug]`, "page.tsx")),
    );
    expect(missing).toEqual([]);
  });

  // Заголовок `X-Robots-Tag` дублирует мету для обходчиков, которые не исполняют скрипты:
  // у динамических маршрутов Next отдаёт метаданные стримом, то есть уже в <body>.
  it("закрывает заголовком от индексации каждый персональный маршрут", () => {
    const config = readFileSync(path.join(__dirname, "..", "next.config.ts"), "utf8");
    const listed = config.slice(config.indexOf("const personal = ["), config.indexOf("];", config.indexOf("const personal = [")));
    const missing = [...PERSONAL_SECTION_KEYS, "character"].filter((key) => !listed.includes(`"${key}"`));
    expect(missing).toEqual([]);
  });

  // Общий `[section]/[slug]` перехватывал `/encyclopedia/arcanum/99`, `/chakra/nope` и чужой хвост:
  // маршрут совпадал, `notFound()` срабатывал уже на рендере, и 404 уезжал стримом — в HTML
  // оставалась пустая оболочка `__next_error__` с заголовком главной. Замер на dev-сервере:
  // без этого каталога те же три адреса отдают «Страница не найдена» с телом.
  it("не возвращает общий перехватчик под /encyclopedia", () => {
    expect(existsSync(path.join(APP, "[section]"))).toBe(false);
  });
});
