// Полное покрытие статического корпуса: все допустимые даты, без случайной выборки.
import { calculate, fold, toIso } from "../matrix";

export function reachablePairChakraKeys(through?: string): Set<string> {
  const now = new Date();
  // calculate() проверяет дату по местному календарю, поэтому граница перебора такая же.
  const lastBirth = through ?? toIso({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });
  const profiles = new Map<string, number[]>();
  let names: string[] = [];
  for (let at = Date.UTC(1900, 0, 1); at <= Date.parse(`${lastBirth}T00:00:00Z`); at += 86_400_000) {
    const matrix = calculate(new Date(at).toISOString().slice(0, 10));
    names = matrix.chakras.map((r) => r.key);
    const values = matrix.chakras.flatMap((r) => [r.physics, r.energy, r.emotions]);
    profiles.set(values.join(","), values);
  }
  const people = [...profiles.values()];
  const keys = Array.from({ length: 8 }, () => new Set<number>());
  // Клетки <=22, сумма колонки <=154. Таблица ускоряет перебор полных связанных профилей.
  const reduced = Array.from({ length: 155 }, (_, n) => n ? fold(n) : 0);
  const field = (sum: number) => sum === 100 ? 10 : reduced[sum];
  for (let i = 0; i < people.length; i++) for (let j = i; j < people.length; j++) {
    const a = people[i], b = people[j];
    let sp = 0, se = 0, sm = 0;
    for (let row = 0; row < 7; row++) {
      const k = row * 3;
      const p = reduced[a[k] + b[k]], e = reduced[a[k + 1] + b[k + 1]], m = reduced[a[k + 2] + b[k + 2]];
      keys[row].add(p * 529 + e * 23 + m);
      sp += p; se += e; sm += m;
    }
    keys[7].add(field(sp) * 529 + field(se) * 23 + field(sm));
  }
  const out = new Set<string>();
  [...names, "energy_field"].forEach((name, i) => {
    for (const value of keys[i]) out.add(`chakra:${name}:${Math.floor(value / 529)}-${Math.floor(value / 23) % 23}-${value % 23}`);
  });
  return out;
}
