import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LANGS } from "../i18n/lang";
import { pairChakraKeys } from "./chakraReading";
import { reachablePairChakraKeys } from "./chakraReachable";
import { unit } from "./corpus";

it("перебор сохраняет связанные колонки и итоговое поле", () => {
  const brute = new Set<string>();
  const births = Array.from({ length: 10 }, (_, i) => `1900-01-${String(i + 1).padStart(2, "0")}`);
  for (const a of births) for (const b of births) for (const key of pairChakraKeys("ru", { a, b })) brute.add(key);
  expect(reachablePairChakraKeys("1900-01-10")).toEqual(brute);
});

const reachable = reachablePairChakraKeys();
for (const L of LANGS) describe(`статический корпус чакр пары (${L})`, () => {
  it("каждый достижимый ключ существует и содержит готовое толкование", () => {
    const missing = [...reachable].filter((key) => !unit(L, key));
    expect(missing.length, `Нет ${missing.length} из ${reachable.size}; примеры: ${missing.slice(0, 12).join(", ")}`).toBe(0);
  });
  it("файлы соответствуют ключам и содержат три абзаца с подписями", () => {
    const root = path.join(process.cwd(), "content", "pair-chakras", L);
    const invalid: string[] = [];
    for (const file of fs.readdirSync(root, { recursive: true }) as string[]) {
      if (!file.endsWith(".json")) continue;
      const [chakra, triple] = file.replaceAll(path.sep, "/").replace(/\.json$/, "").split("/");
      const key = `chakra:${chakra}:${triple}`;
      const body = JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
      const paragraphs = body.text;
      if (!reachable.has(key) || body.unit !== key || body.sphere !== "chakras"
        || JSON.stringify(body.numbers) !== JSON.stringify(triple.split("-").map(Number))
        || !body.title?.trim() || !body.meaning?.trim()
        || ["physics", "energy", "emotions"].some((c) => !body.captions?.[c]?.trim())
        || !Array.isArray(paragraphs) || paragraphs.length !== 3
        || paragraphs.some((p: unknown) => typeof p !== "string" || p.trim().length < 150)
        || (paragraphs[1].match(/\*\*[^*]+\*\*/g) ?? []).length !== 1) invalid.push(file);
    }
    expect(invalid.length, `Некорректные файлы: ${invalid.slice(0, 20).join(", ")}`).toBe(0);
  });
});
