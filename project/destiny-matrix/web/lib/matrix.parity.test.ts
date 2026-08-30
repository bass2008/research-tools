import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import parity from "./__fixtures__/parity-digests.json";
import { calculate, type Sex } from "./matrix";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function stable(value: Json): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
    .join(",")}}`;
}

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

function nextDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

describe("полный паритет TypeScript с Python", () => {
  it(
    "совпадает для каждой валидной даты с 1900 года и обоих полов",
    () => {
      expect(parity.through).toBe(localToday());
      const overall = createHash("sha256");
      let total = 0;

      for (const [year, expected] of Object.entries(parity.years)) {
        const end = year === parity.through.slice(0, 4) ? parity.through : `${year}-12-31`;
        const digest = createHash("sha256");
        let count = 0;
        for (let birth = `${year}-01-01`; birth <= end; birth = nextDay(birth)) {
          for (const sex of parity.sex_order as Sex[]) {
            const row = `${stable(calculate(birth, sex) as unknown as Json)}\n`;
            digest.update(row, "utf8");
            overall.update(row, "utf8");
            count += 1;
            total += 1;
          }
        }
        expect(count, `число случаев в ${year}`).toBe(expected.cases);
        expect(digest.digest("hex"), `расхождение Python/TypeScript в ${year}`).toBe(
          expected.sha256,
        );
      }

      expect(total).toBe(parity.cases);
      expect(overall.digest("hex")).toBe(parity.sha256);
    },
    60_000,
  );
});
