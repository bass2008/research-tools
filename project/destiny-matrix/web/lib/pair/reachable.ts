// Все ключи юнитов пары, которые вообще могут выпасть. Перебор, а не выборка: случайные пары
// пропускали редкие сочетания, и у такой пары сфера уходила в заглушку. Сумма пары симметрична,
// поэтому достаточно сочетаний значений личных точек, из которых складывается ключ.
import { fold, foldYear, fromPoints } from "../matrix";
import { BUSINESS_POINTS, businessPoints } from "./business";
import { personalPoints, type PointKey, type Points } from "./engine";
import { PERSONAL_READ, SPHERES } from "./spheres";

const FIRST_YEAR = 1900;

function allBirths(lastYear: number): string[] {
  const out: string[] = [];
  for (let at = Date.UTC(FIRST_YEAR, 0, 1); at <= Date.UTC(lastYear, 11, 31); at += 86_400_000) {
    out.push(new Date(at).toISOString().slice(0, 10));
  }
  return out;
}

function personals(lastYear: number): Points[] {
  const out: Points[] = [];
  for (const birth of allBirths(lastYear)) {
    try {
      out.push(personalPoints(birth, "ru"));
    } catch {
      // даты, которые калькулятор не принимает, в пару не попадают
    }
  }
  return out;
}

/** Ключ → сколько упорядоченных пар дат его дают (вес для очерёдности письма). */
export function reachableKeys(lastYear: number): Map<string, number> {
  const people = personals(lastYear);
  const keys = new Map<string, number>();
  const add = (key: string, weight: number) => keys.set(key, (keys.get(key) ?? 0) + weight);

  const pairs = (fields: PointKey[], emit: (sum: (k: PointKey) => number, weight: number) => void) => {
    const groups = new Map<string, { values: number[]; count: number }>();
    for (const person of people) {
      const values = fields.map((f) => person[f]);
      const id = values.join(",");
      const group = groups.get(id);
      if (group) group.count += 1;
      else groups.set(id, { values, count: 1 });
    }
    const list = [...groups.values()];
    for (let i = 0; i < list.length; i++) {
      for (let j = i; j < list.length; j++) {
        const a = list[i], b = list[j];
        const weight = i === j ? a.count * a.count : 2 * a.count * b.count;
        emit((k) => fold(a.values[fields.indexOf(k)] + b.values[fields.indexOf(k)]), weight);
      }
    }
  };

  for (const sphere of SPHERES) {
    if (sphere.kind !== "cards" || sphere.id === "values") continue;
    const fields = sphere.cards!.map(([k]) => k);
    pairs(fields, (sum, weight) => {
      const p = {} as Points;
      for (const f of fields) p[f] = sum(f);
      add(sphere.key!(p), weight);
    });
  }

  pairs(["sky", "ground", "male", "female"], (sum, weight) => {
    const spiritual = fold(fold(sum("sky") + sum("ground")) + fold(sum("male") + sum("female")));
    add(`values:${spiritual}`, weight);
  });

  for (const k of ["J", "O"] as const) pairs([k], (sum, weight) => add(`parents:${k}:${sum(k)}`, weight));

  // Совпадение характеров: энергия R (или M) одного стоит в любой из читаемых точек другого.
  const read = new Set(people.flatMap((x) => PERSONAL_READ.map((k) => x[k])));
  const tally = (k: "R" | "M", family: string) => {
    const counts = new Map<number, number>();
    for (const x of people) counts.set(x[k], (counts.get(x[k]) ?? 0) + 1);
    for (const [n, count] of counts) if (read.has(n)) add(`characters:${family}:${n}`, count);
  };
  tally("R", "dual");
  tally("M", "semidual");

  for (const [key, weight] of reachableBusinessKeys(lastYear)) add(key, weight);
  return keys;
}

/** Деловой раздел: матрица на «дату» из сумм дней, месяцев и годов. Пары дней и месяцев берутся
 *  только из настоящих дат (31 бывает не в каждом месяце), сумма годов — любая из диапазона. */
export function reachableBusinessKeys(lastYear: number): Map<string, number> {
  const days = (month: number) => new Date(Date.UTC(2000, month, 0)).getUTCDate();
  const dayMonth = new Map<string, number>();
  for (let m1 = 1; m1 <= 12; m1++) for (let d1 = 1; d1 <= days(m1); d1++) {
    for (let m2 = 1; m2 <= 12; m2++) for (let d2 = 1; d2 <= days(m2); d2++) {
      const id = `${fold(d1 + d2)},${fold(m1 + m2)}`;
      dayMonth.set(id, (dayMonth.get(id) ?? 0) + 1);
    }
  }
  const years = new Map<number, number>();
  for (let y1 = FIRST_YEAR; y1 <= lastYear; y1++) for (let y2 = FIRST_YEAR; y2 <= lastYear; y2++) {
    const y = foldYear(y1 + y2);
    years.set(y, (years.get(y) ?? 0) + 1);
  }
  const keys = new Map<string, number>();
  for (const [id, dmCount] of dayMonth) {
    const [day, month] = id.split(",").map(Number);
    for (const [year, yCount] of years) {
      const p = businessPoints(fromPoints(day, month, year, ""));
      for (const point of BUSINESS_POINTS) {
        const family = point === "hiddenA" || point === "hiddenB" ? "hidden" : point;
        const key = `business:${family}:${p[point]}`;
        keys.set(key, (keys.get(key) ?? 0) + dmCount * yCount);
      }
    }
  }
  return keys;
}
