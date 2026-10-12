import fs from "node:fs";
import { reachableKeys } from "../lib/pair/reachable";

const out = process.argv[2] ?? "pair-keys.json";
const started = Date.now();
const keys = reachableKeys(new Date().getUTCFullYear());
const rows = [...keys].sort((a, b) => b[1] - a[1]).map(([key, weight]) => ({ key, family: key.split(":")[0], weight }));
fs.writeFileSync(out, JSON.stringify({ count: rows.length, items: rows }, null, 1));
const families: Record<string, number> = {};
for (const r of rows) families[r.family] = (families[r.family] ?? 0) + 1;
console.log(rows.length, "keys in", Date.now() - started, "ms", families);
