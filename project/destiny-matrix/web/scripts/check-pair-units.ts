// Проверка файла писателя: npx tsx --tsconfig tsconfig.json scripts/check-pair-units.ts <файл.json> [ru|en]
import fs from "node:fs";
import path from "node:path";
import { reachableKeys } from "../lib/pair/reachable";
import type { PairUnit } from "../lib/pair/spheres";
import { duplicates, unitProblems } from "../lib/pair/unitCheck";

const file = process.argv[2];
const lang = (process.argv[3] ?? "ru") as "ru" | "en";
if (!file) throw new Error("укажите файл");
const items: PairUnit[] = JSON.parse(fs.readFileSync(file, "utf8")).items;
const reachable = reachableKeys(new Date().getUTCFullYear());
const corpusFile = path.join(process.cwd(), `content/${lang}/pair-units.json`);
const corpus: PairUnit[] = fs.existsSync(corpusFile) ? JSON.parse(fs.readFileSync(corpusFile, "utf8")).items : [];
let bad = 0;
for (const u of items) {
  const problems = unitProblems(u, lang);
  if (!reachable.has(u.unit)) problems.push("такого ключа не бывает");
  if (problems.length) {
    bad++;
    console.log(`${u.unit}: ${problems.join("; ")}`);
  }
}
// повторы — и внутри файла, и с уже готовыми юнитами корпуса
const own = new Set(items.map((u) => u.unit));
const dup = duplicates([...corpus.filter((u) => !own.has(u.unit)), ...items]);
for (const d of dup) console.log(`повтор: ${d}`);
console.log(`${items.length} юнитов, с ошибками ${bad}, повторов ${dup.length}`);
process.exit(bad || dup.length ? 1 : 0);
