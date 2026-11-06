import { fold } from "./matrix";

const digits = (n: number) => String(Math.abs(n)).split("").reduce((a, c) => a + Number(c), 0);

/** The year matrix of a birth date (Lisovskaya, "Prognostics"): its centre and the three four-month periods. */
export function yearMatrix(birth: { y: number; m: number; d: number }, year: number) {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const a = fold(fold(digits(leap ? 366 : 365)) + birth.d), b = fold(digits(year) + 12 + birth.m), c = fold(digits(birth.y + year));
  const d = fold(a + b + c), centre = fold(a + b + c + d);
  const first = fold(fold(b + d) + fold(a + c));
  const second = fold(fold(fold(a + b) + fold(c + d)) + fold(fold(b + c) + fold(d + a)));
  return { centre, periods: [first, second, fold(first + second)] as [number, number, number] };
}
