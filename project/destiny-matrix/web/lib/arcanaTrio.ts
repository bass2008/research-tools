import { calculate } from "./matrix";
import { computePair } from "./pair/engine";
import { yearMatrix } from "./yearMatrix";

export type Trio = [number, number, number];

// Three cards of a reading, the centre in the middle: mask · centre · main talent for a date,
// the two centres around the couple's one for a pair, the first and last periods around the year centre.
export function personalTrio(birth: string): Trio | null {
  try {
    const m = calculate(birth, "f");
    return [m.day, m.center, m.month];
  } catch {
    return null;
  }
}

export function pairTrio(a: string, b: string): Trio | null {
  try {
    const p = computePair(a, b);
    return [p.a.E, p.p.E, p.b.E];
  } catch {
    return null;
  }
}

export function yearTrio(birth: string, year: number): Trio | null {
  const [y, m, d] = birth.split("-").map(Number);
  if (!y || !m || !d || !year) return null;
  const { centre, periods } = yearMatrix({ y, m, d }, year);
  return [periods[0], centre, periods[2]];
}

const birthOf = (v: unknown) => (v as { birth?: string } | undefined)?.birth;

export function readingTrio(inputs: Record<string, unknown>, year?: number | null): Trio | null {
  const a = birthOf(inputs.a), b = birthOf(inputs.b), own = birthOf(inputs);
  if (a && b) return pairTrio(a, b);
  if (!own) return null;
  return year ? yearTrio(own, year) : personalTrio(own);
}
