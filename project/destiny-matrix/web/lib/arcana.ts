import catalog from "@/content/arcana-catalog.json";

/** Client-safe arcanum metadata generated from content/data/arcana.json. */
export interface ArcanumSource {
  n: number;
  slug: string;
  title: string;
  short: string;
}

export const ARCANA: ArcanumSource[] = catalog.items.map((item) => ({ ...item }));

const BY_N = new Map(ARCANA.map((arcanum) => [arcanum.n, arcanum]));

export function roman(n: number): string {
  if (!Number.isInteger(n) || n < 1) return String(n);
  const values: Array<[number, string]> = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let rest = n;
  let result = "";
  for (const [value, sign] of values) {
    while (rest >= value) {
      result += sign;
      rest -= value;
    }
  }
  return result;
}

export function arcanum(n: number): ArcanumSource {
  const value = BY_N.get(n);
  if (!value) throw new Error(`нет аркана ${n}`);
  return value;
}

export function arcanumTitle(n: number): string {
  return arcanum(n).title;
}

export function arcanumShort(n: number): string {
  return arcanum(n).short;
}
