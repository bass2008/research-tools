import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { LANGS } from "./i18n";

/**
 * Ключи — контракт, и они обязаны быть латиницей (`docs/locale-ref-plan.md`, пункт 1).
 *
 * Русское слово в роли ключа — `"задача М"` в ролях раздела, `plural(count, "хвост")` — привязывает
 * сущность к языку: английская страница уже не может сослаться на ту же запись, а на этом стоят
 * и `hreflang`, и переключатель языка. Проверка смотрит на ключи, а не на тексты: тексты как раз
 * обязаны быть на своём языке.
 */
const NON_ASCII = /[^\x20-\x7E]/;
const CORPUS = path.resolve(__dirname, "..", "content");

function jsonFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...jsonFiles(full));
    else if (entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

function badKeys(node: unknown, where: string, found: string[] = []): string[] {
  if (Array.isArray(node)) {
    node.forEach((item, i) => badKeys(item, `${where}[${i}]`, found));
  } else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (NON_ASCII.test(key)) found.push(`${where}.${key}`);
      badKeys(value, `${where}.${key}`, found);
    }
  }
  return found;
}

describe("ключи контента и словарей", () => {
  it.each(jsonFiles(CORPUS).filter((file) => !file.includes("matrices.json")))(
    "%s: только латиница в именах полей",
    (file) => {
      const data = JSON.parse(readFileSync(file, "utf8"));
      expect(badKeys(data, path.basename(file))).toEqual([]);
    },
  );

  it("языки развёртки названы кодами, а не словами", () => {
    for (const lang of LANGS) expect(lang).toMatch(/^[a-z]{2}$/);
  });

  it("селекторы ролей в разборе не собраны из русских слов", () => {
    const source = readFileSync(path.resolve(__dirname, "sectionReadingShared.ts"), "utf8");
    // ключи стоят внутри `synthesis:`/`pair:` строк — там, где раньше жили «задача М» и «задача Ж»
    const keys = [...source.matchAll(/(?:synthesis|pair):([^"'`\n]+)/g)].map((m) => m[1]);
    expect(keys.filter((key) => NON_ASCII.test(key))).toEqual([]);
  });
});
