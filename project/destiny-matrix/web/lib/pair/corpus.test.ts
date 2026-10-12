// Полнота корпуса пары: у каждой пары, которая вообще может выпасть, каждая сфера — с текстом, на
// всех языках. Раньше корпус покрывал 24 ключа из 1 299, и разбор показывал заглушку даже купленным.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LANGS } from "../i18n/lang";
import { computePair } from "./engine";
import { reachableKeys } from "./reachable";
import { MAIN, sphereOf, unitKeys, visible, type PairUnit } from "./spheres";
import { duplicates, unitProblems } from "./unitCheck";

const REACHABLE = reachableKeys(new Date().getUTCFullYear());

function corpus(L: string): Map<string, PairUnit & { numbers?: number[]; sphere?: string }> {
  const file = path.join(process.cwd(), "content", L, "pair-units.json");
  const items: PairUnit[] = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")).items : [];
  return new Map(items.map((u) => [u.unit, u]));
}

describe("корпус пары", () => {
  it("перебор ключей не теряет ни одной случайной пары", () => {
    const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
    const date = () => `${rnd(1900, 2025)}-${String(rnd(1, 12)).padStart(2, "0")}-${String(rnd(1, 28)).padStart(2, "0")}`;
    for (let i = 0; i < 3000; i++) {
      const { a, b, p } = computePair(date(), date(), "ru");
      for (const s of visible(a, b)) for (const k of unitKeys(s, a, b, p)) expect(REACHABLE.has(k), k).toBe(true);
    }
  });

  for (const L of LANGS) {
    it(`${L}: есть юнит на каждый достижимый ключ`, () => {
      const units = corpus(L);
      const missing = [...REACHABLE.keys()].filter((k) => !units.has(k));
      expect(missing.length, `нет ${missing.length} из ${REACHABLE.size}: ${missing.slice(0, 5).join(", ")}…`).toBe(0);
    });

    it(`${L}: у каждого юнита заполнены поля своего типа`, () => {
      const bad = [...corpus(L).values()].map((u) => [u.unit, unitProblems(u, L)] as const).filter(([, p]) => p.length);
      expect(bad.length, bad.slice(0, 5).map(([k, p]) => `${k}: ${p.join("; ")}`).join("\n")).toBe(0);
    });

    it(`${L}: заголовки и строки «Главное» не повторяются внутри семейства`, () => {
      const dup = duplicates(corpus(L).values());
      expect(dup, dup.slice(0, 5).join("\n")).toEqual([]);
    });
  }

  it("подписи главных карт берутся из юнитов своих сфер", () => {
    for (const m of MAIN) expect(sphereOf(m.sphere).cards?.some(([k]) => k === m.key)).toBe(true);
  });
});
