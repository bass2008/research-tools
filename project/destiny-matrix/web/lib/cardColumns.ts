import type { CSSProperties } from "react";

/** Сколько карт в ряд при не больше `max` колонок: ряды ровные, восемь карт — 4+4, а не 5+3. */
export function balancedColumns(n: number, max: number): number {
  return n <= max ? Math.max(n, 1) : Math.ceil(n / Math.ceil(n / max));
}

/** Число колонок для каждой ширины экрана: CSS выбирает свою (--c2…--c6) и центрует неполный ряд. */
export function cardColumns(n: number): CSSProperties {
  const vars: Record<string, number> = { "--n": n };
  for (const max of [2, 3, 4, 5, 6]) vars[`--c${max}`] = balancedColumns(n, max);
  return vars as CSSProperties;
}
