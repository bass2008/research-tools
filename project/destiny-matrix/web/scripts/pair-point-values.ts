// В каких точках матрицы пары бывает каждая энергия и как часто — справка для писателей.
import fs from "node:fs";
import { fold } from "../lib/matrix";
import { combine, personalPoints, type PointKey, type Points } from "../lib/pair/engine";

const POINTS: Array<[PointKey, string]> = [
  ["E", "«Атмосфера внутри пары», центр (А)"],
  ["A", "«Какой пару видят другие» — «Каким вас видят»; в «Ради чего встретились» — «Образ пары» (Б)"],
  ["B", "«Ради чего встретились» — «Что создать вместе» (В)"],
  ["C", "«Отношение к материальному» — «Быт и вещи» (Г)"],
  ["D", "«Кармический хвост пары» — «Главная задача» (Д)"],
  ["F", "«Что наполняет союз» (Е)"],
  ["G", "«Что может испортить» — «Где искрит» (Ё)"],
  ["J", "«Пара как родители» — «Родители вместе» (Б1)"],
  ["O", "«Пара как родители» — «Чему учите» (Б2)"],
  ["L", "«Деньги пары» — «Вход в деньги» (Г1)"],
  ["R2", "«Деньги пары» — «Путь к достатку» (Л)"],
  ["R", "«Деньги пары» — «Где утекает»; в отношениях — «Успехи и союз» (К)"],
  ["R1", "«Отношения и общий язык» — «Что соединяет», под сердцем (И)"],
  ["M", "«Отношения и общий язык» — «Общий язык»; в хвосте — «Вход в задачу» (Д1)"],
  ["N", "«Кармический хвост пары» — «Середина задачи» (Д2)"],
];
// Ценности пары — духовное предназначение пары, пересчитанное из её сумм, а не сумма двух личных.
const SPIRITUAL = "«Ценности пары» — духовное предназначение пары";
const people: Points[] = [];
for (let at = Date.UTC(1900, 0, 1); at <= Date.UTC(2026, 11, 31); at += 86_400_000) {
  try { people.push(personalPoints(new Date(at).toISOString().slice(0, 10), "ru")); } catch { /* */ }
}
const out: Record<string, Record<string, number>> = {};
for (const [k, label] of POINTS) {
  const counts = new Map<number, number>();
  for (const x of people) counts.set(x[k], (counts.get(x[k]) ?? 0) + 1);
  const values = [...counts];
  const total = people.length * people.length;
  const freq = new Map<number, number>();
  for (const [v1, c1] of values) for (const [v2, c2] of values) {
    const n = fold(v1 + v2);
    freq.set(n, (freq.get(n) ?? 0) + c1 * c2);
  }
  for (const [n, c] of freq) (out[n] ??= {})[label] = Math.round((c / total) * 10000) / 100;
}
const shapes = new Map<string, [Points, number]>();
for (const x of people) {
  const key = `${x.sky}-${x.ground}-${x.male}-${x.female}`;
  const seen = shapes.get(key);
  if (seen) seen[1] += 1; else shapes.set(key, [x, 1]);
}
const spiritual = new Map<number, number>();
for (const [a, ca] of shapes.values()) for (const [b, cb] of shapes.values()) {
  const n = combine(a, b).spiritual;
  spiritual.set(n, (spiritual.get(n) ?? 0) + ca * cb);
}
for (const [n, c] of spiritual) (out[n] ??= {})[SPIRITUAL] = Math.round((c / (people.length * people.length)) * 10000) / 100;
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log(Object.keys(out).length, "energies");
