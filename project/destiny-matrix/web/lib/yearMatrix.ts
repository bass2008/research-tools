import { fold } from "./matrix";

const digits = (n: number) => String(Math.abs(n)).split("").reduce((a, c) => a + Number(c), 0);

export type YearKey = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "P1" | "P2" | "P3";

/** All points of the year matrix (Lisovskaya, "Prognostics"): A–I on the chart, P1–P3 the thirds of the year. */
export function yearPoints(birth: { y: number; m: number; d: number }, year: number): Record<YearKey, number> {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const a = fold(fold(digits(leap ? 366 : 365)) + birth.d), b = fold(digits(year) + 12 + birth.m), c = fold(digits(birth.y + year));
  const d = fold(a + b + c), e = fold(a + b + c + d);
  const f = fold(a + b), g = fold(b + c), h = fold(c + d), i = fold(d + a);
  const p1 = fold(fold(b + d) + fold(a + c)), p2 = fold(fold(f + h) + fold(g + i));
  return { A: a, B: b, C: c, D: d, E: e, F: f, G: g, H: h, I: i, P1: p1, P2: p2, P3: fold(p1 + p2) };
}

/** The month matrix ("Prognostics", forecast for a month): the month's day is the year's digit sum plus the month, added whole. */
export function monthPoints(birth: { y: number; m: number; d: number }, year: number, month: number): Record<Exclude<YearKey, "P1" | "P2" | "P3">, number> {
  const a = fold(digits(year) + month + birth.d), b = fold(month + birth.m), c = fold(digits(birth.y + year));
  const d = fold(a + b + c), e = fold(a + b + c + d);
  return { A: a, B: b, C: c, D: d, E: e, F: fold(a + b), G: fold(b + c), H: fold(c + d), I: fold(d + a) };
}

/** The year matrix of a birth date: its centre and the three four-month periods. */
export function yearMatrix(birth: { y: number; m: number; d: number }, year: number) {
  const p = yearPoints(birth, year);
  return { centre: p.E, periods: [p.P1, p.P2, p.P3] as [number, number, number] };
}
