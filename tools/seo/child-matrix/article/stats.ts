// npx tsx (из project/destiny-matrix/web): учебная дата статьи и допустимые значения точек по всем датам.
import { calculate, fold } from "../../../../project/destiny-matrix/web/lib/matrix";
import { computePair } from "../../../../project/destiny-matrix/web/lib/pair/engine";

const NAMES = ["", "Маг", "Жрица", "Императрица", "Император", "Иерофант", "Влюблённые", "Колесница",
  "Справедливость", "Отшельник", "Колесо Фортуны", "Сила", "Повешенный", "Смерть", "Умеренность", "Дьявол",
  "Башня", "Звезда", "Луна", "Солнце", "Суд", "Мир", "Шут"];
const n = (x: number) => `${x} · ${NAMES[x]}`;
const pct = (x: number, total: number, digits = 1) => `${(100 * x / total).toFixed(digits).replace(".", ",")}%`;
const iso = (d: Date) => d.toISOString().slice(0, 10);

const out: string[] = [];
const p = (s = "") => out.push(s);

const CHILD = "2016-04-12";
const PARENT = "1990-09-05";
const m = calculate(CHILD, "f");
const J = m.comfort_west, O = fold(m.day + J);

p("# Детская матрица: учебная дата и допустимые значения");
p();
p("Движок: `web/lib/matrix.ts` (личная матрица) и `web/lib/pair/engine.ts` (матрица пары).");
p();
p("## Учебная дата 12.04.2016");
p();
p("| Точка | Как считается | Число |");
p("|---|---|---|");
p(`| A · портрет | день 12 | ${n(m.day)} |`);
p(`| B · духовная задача | месяц 4 | ${n(m.month)} |`);
p(`| C · материальная задача | 2 + 0 + 1 + 6 | ${n(m.year)} |`);
p(`| D · кармическая задача | ${m.day} + ${m.month} + ${m.year} = ${m.day + m.month + m.year} | ${n(m.mission)} |`);
p(`| E · центр | ${m.day} + ${m.month} + ${m.year} + ${m.mission} = ${m.day + m.month + m.year + m.mission} | ${n(m.center)} |`);
p(`| K · внутренняя точка таланта | B + E = ${m.month + m.center} | ${n(m.comfort_north)} |`);
p(`| P · середина линии талантов | B + K = ${m.month + m.comfort_north} | ${n(m.talent[1])} |`);
p(`| Линия талантов B–P–K | | ${m.talent.join("-")} |`);
p(`| Детско-родительская линия A–O–J | J = A + E, O = A + J | ${m.day}-${O}-${J} |`);
p(`| F–G–H (раздел «Родители и дети») | | ${m.father_line}-${m.mother_line}-${m.descendants} |`);
p(`| Кармический хвост M–N–D | | ${m.karmic_tail.join("-")} |`);
p();

p("## Какие числа бывают в точках, с которых начинают чтение (все даты 1900 — сегодня)");
p();
const seen = { A: new Set<number>(), B: new Set<number>(), E: new Set<number>(), K: new Set<number>(), P: new Set<number>() };
const centerCount = new Map<number, number>();
let total = 0, sameAE = 0;
const today = new Date();
const end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
for (let d = new Date(Date.UTC(1900, 0, 1)); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
  const x = calculate(iso(d), "f");
  total++;
  seen.A.add(x.day); seen.B.add(x.month); seen.E.add(x.center);
  seen.K.add(x.comfort_north); seen.P.add(x.talent[1]);
  centerCount.set(x.center, (centerCount.get(x.center) ?? 0) + 1);
  if (x.day === m.day && x.center === m.center) sameAE++;
}
const list = (s: Set<number>) => [...s].sort((a, b) => a - b).join(", ");
const missing = (s: Set<number>) => Array.from({ length: 22 }, (_, i) => i + 1).filter((v) => !s.has(v)).join(", ") || "—";
for (const [k, s] of Object.entries(seen))
  p(`- ${k}: ${list(s)}; не бывает: ${missing(s)}.`);
p(`- Даты: ${total}. Центр 5 · Иерофант — у ${pct(centerCount.get(5)!, total)} дат.`);
p(`- Тот же портрет 12 и тот же центр 5, что у 12.04.2016: ${sameAE} дат.`);
p();

p("## Две даты: родитель 05.09.1990 и ребёнок 12.04.2016");
p();
const pm = calculate(PARENT, "f");
const pair = computePair(PARENT, CHILD);
p(`- Личные центры: родитель ${n(pm.center)}, ребёнок ${n(m.center)}.`);
p(`- Центр матрицы пары: ${pm.center} + ${m.center} = ${pm.center + m.center} → ${n(pair.p.E)}.`);
p(`- Портрет пары A: ${pm.day} + ${m.day} = ${pm.day + m.day} → ${n(pair.p.A)}.`);
p(`- Точки пары «Пара как родители» J и O (у Лисовской Б1 и Б2) — о двух партнёрах в роли родителей, ` +
  `а не об отношениях родителя с ребёнком: J ${pair.p.J}, O ${pair.p.O}.`);

console.log(out.join("\n"));
