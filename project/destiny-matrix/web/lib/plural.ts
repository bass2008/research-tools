/** Согласование существительного с числом: 1 платёж, 2 платежа, 5 платежей. */
export function plural(n: number, one: string, few: string, many: string): string {
  const tail = Math.abs(n) % 10;
  const hundred = Math.abs(n) % 100;
  if (hundred >= 11 && hundred <= 14) return many;
  if (tail === 1) return one;
  if (tail >= 2 && tail <= 4) return few;
  return many;
}

/** «250 ₽ за 1 платёж» — число вместе с согласованным словом. */
export function counted(n: number, one: string, few: string, many: string): string {
  return `${n} ${plural(n, one, few, many)}`;
}
