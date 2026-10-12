// Каждый язык закрывает те же ключи, что и русский: страница или толкование, которое есть только
// на одном языке, на другом уходит в 404 или в заглушку, а языковая ссылка ведёт в никуда.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LANGS } from "./i18n/lang";

const ROOT = path.join(process.cwd(), "content");
const read = (L: string, file: string) => JSON.parse(fs.readFileSync(path.join(ROOT, L, file), "utf8"));

// ключ записи в каждом корпусе; корпус пары проверяет свой тест (lib/pair/corpus.test.ts)
const KEYS: Record<string, (item: Record<string, unknown>) => string> = {
  "arcana-catalog.json": (x) => String(x.n),
  "arcana.json": (x) => String(x.n),
  "category-hubs.json": (x) => String(x.key),
  "chakras.json": (x) => String(x.key),
  "combinations.json": (x) => String(x.key),
  "hubs.json": (x) => String(x.key),
  "karmic-tails.json": (x) => String(x.key),
  "points-catalog.json": (x) => String(x.key),
  "position-arcanum.json": (x) => `${x.position}:${x.arcanum}`,
  "positions.json": (x) => String(x.key),
  "sections.json": (x) => String(x.key),
  "year-arcana.json": (x) => String(x.n),
  "compatibility-arcana.json": (x) => String(x.n),
};

const keysOf = (L: string, file: string) =>
  (read(L, file).items as Array<Record<string, unknown>>).map(KEYS[file]).sort();

describe("корпуса на всех языках", () => {
  it("у каждого корпуса из content/ru есть правило ключа", () => {
    const files = fs.readdirSync(path.join(ROOT, "ru")).filter((f) => !["text-policy.json", "pair-units.json", "chakra-personal.json"].includes(f));
    expect(files.filter((f) => !KEYS[f])).toEqual([]);
  });

  for (const L of LANGS.filter((x) => x !== "ru")) {
    for (const file of Object.keys(KEYS)) {
      it(`${L}: ${file} — те же ключи, что в ru`, () => {
        expect(fs.existsSync(path.join(ROOT, L, file)), `нет ${L}/${file}`).toBe(true);
        expect(keysOf(L, file)).toEqual(keysOf("ru", file));
      });
    }

    it(`${L}: чакры пары — те же файлы, что в ru`, () => {
      const files = (lang: string) => (fs.readdirSync(path.join(ROOT, "pair-chakras", lang), { recursive: true }) as string[])
        .filter((name) => name.endsWith(".json")).sort();
      expect(files(L)).toEqual(files("ru"));
    });

    it(`${L}: толкования чакр — те же тройки, что в ru`, () => {
      const ru = read("ru", "chakra-personal.json").chakras as Record<string, { readings: Record<string, unknown> }>;
      const other = read(L, "chakra-personal.json").chakras as Record<string, { readings: Record<string, unknown> }>;
      for (const [chakra, body] of Object.entries(ru)) {
        expect(Object.keys(other[chakra]?.readings ?? {}).sort(), chakra).toEqual(Object.keys(body.readings).sort());
      }
    });
  }
});
