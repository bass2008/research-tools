// npx tsx (из project/destiny-matrix/web): все даты с 01.01.1900 по сегодня через движок сайта.
import { calculate, fold } from "../../../../project/destiny-matrix/web/lib/matrix";

const NAMES = ["", "Маг", "Жрица", "Императрица", "Император", "Иерофант", "Влюблённые", "Колесница",
  "Справедливость", "Отшельник", "Колесо Фортуны", "Сила", "Повешенный", "Смерть", "Умеренность", "Дьявол",
  "Башня", "Звезда", "Луна", "Солнце", "Суд", "Мир", "Шут"];

type Row = { iso: string; year: number; A: number; O: number; J: number; E: number; key: string;
  talent: string; mk: string; tailOut: string; fgh: string; alt: string; jElsewhere: boolean };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const ru = (s: string) => s.split("-").reverse().join(".");
const pct = (x: number, n: number, digits = 2) => `${(100 * x / n).toFixed(digits).replace(".", ",")}%`;
const t = (xs: readonly number[]) => xs.join("-");

const altFold = (n: number) => { while (n > 22) n -= 22; return n; };
const digitSum = (n: number) => String(n).split("").reduce((s, c) => s + Number(c), 0);

function altTriple(y: number, mo: number, d: number): string {
  const A = altFold(d), B = mo, C = altFold(digitSum(y));
  const D = altFold(A + B + C), E = altFold(A + B + C + D);
  const J = altFold(A + E), O = altFold(A + J);
  return t([A, O, J]);
}

const rows: Row[] = [];
const today = new Date();
const end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
for (let d = new Date(Date.UTC(1900, 0, 1)); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
  const m = calculate(iso(d), "f");
  const A = m.day, J = m.comfort_west, O = fold(A + J);
  const ajna = m.chakras.find((r) => r.key === "ajna")!;
  const sah = m.chakras.find((r) => r.key === "sahasrara")!;
  const vis = m.chakras.find((r) => r.key === "vishuddha")!;
  if (ajna.physics !== O || sah.physics !== A || vis.physics !== J) throw new Error(`chakra mismatch ${iso(d)}`);
  const lines = [...m.talent, ...m.money, ...m.love];
  rows.push({
    iso: iso(d), year: d.getUTCFullYear(), A, O, J, E: m.center, key: t([A, O, J]),
    talent: t(m.talent), mk: t(m.material_karma),
    tailOut: t([...m.karmic_tail].reverse()),
    fgh: t([m.father_line, m.mother_line, m.descendants]),
    alt: altTriple(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()),
    jElsewhere: lines.includes(J),
  });
}

const N = rows.length;
const out: string[] = [];
const p = (s = "") => out.push(s);

const count = new Map<string, number>();
const dates = new Map<string, string[]>();
for (const r of rows) {
  count.set(r.key, (count.get(r.key) ?? 0) + 1);
  if (!dates.has(r.key)) dates.set(r.key, []);
  dates.get(r.key)!.push(r.iso);
}
const triples = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
const values = (k: "A" | "O" | "J") => [...new Set(rows.map((r) => r[k]))].sort((a, b) => a - b);

p("# Детско-родительская линия A–O–J: статистика по движку сайта");
p();
p(`Даты: ${ru(rows[0].iso)} — ${ru(rows[N - 1].iso)}, всего ${N}. Движок: \`web/lib/matrix.ts\`, A = day, ` +
  "J = comfort_west, O = fold(A + J). Проверка: на каждой дате A, O, J совпадают с физикой Сахасрары, Аджны и Вишудхи.");
p();
p("## Сколько троек и какие числа бывают");
p();
p(`- Разных упорядоченных троек A–O–J: **${count.size}**.`);
for (const k of ["A", "O", "J"] as const) {
  const v = values(k);
  const missing = Array.from({ length: 22 }, (_, i) => i + 1).filter((x) => !v.includes(x));
  p(`- ${k}: ${v.length} значений (${v[0]}–${v[v.length - 1]}), не бывает: ${missing.join(", ") || "—"}.`);
}
p(`- Сочетаний «роль × аркан»: ${values("A").length + values("O").length + values("J").length}.`);
const counts = triples.map(([, c]) => c).sort((a, b) => a - b);
const median = counts[Math.floor(counts.length / 2)];
p(`- Медиана: ${median} дат на тройку; меньше 50 дат — ${counts.filter((c) => c < 50).length} троек, ` +
  `меньше 10 — ${counts.filter((c) => c < 10).length}.`);
const pairsAE = new Set(rows.map((r) => `${r.A}|${r.E}`));
p(`- Тройку задают только A и центр E: разных пар (A, E) ${pairsAE.size}, они дают ${count.size} троек.`);
p(`- Центр E бывает: ${[...new Set(rows.map((r) => r.E))].sort((a, b) => a - b).join(", ")}.`);
p();

p("## Контрольные даты");
p();
p("| Дата | A | B | C | D | E | J = A + E | O = A + J | A–O–J | F–G–H | Таланты B–P–K | Мат. карма C–Q–L | Дат с той же тройкой |");
p("|---|---:|---:|---:|---:|---:|---:|---:|---|---|---|---|---:|");
for (const s of ["2016-04-12", "1990-09-05", "1995-05-06"]) {
  const m = calculate(s, "f");
  const A = m.day, E = m.center, J = m.comfort_west, O = fold(A + J);
  const key = t([A, O, J]);
  p(`| ${ru(s)} | ${A} | ${m.month} | ${m.year} | ${m.mission} | ${E} | ${A}+${E}=${A + E} → ${J} | ` +
    `${A}+${J}=${A + J} → ${O} | ${key} | ${t([m.father_line, m.mother_line, m.descendants])} | ${t(m.talent)} | ` +
    `${t(m.material_karma)} | ${count.get(key)} (${pct(count.get(key)!, N)}) |`);
}
p();
for (const key of ["12-11-17", "5-22-17"]) {
  const ds = dates.get(key) ?? [];
  const years = [...new Set(ds.map((x) => x.slice(0, 4)))];
  p(`- ${key}: ${ds.length} дат, ${pct(ds.length, N)}, примерно каждая ${Math.round(N / ds.length)}-я; ` +
    `лет: ${years.length}; первые даты: ${ds.slice(0, 6).map(ru).join(", ")}; ` +
    `последние: ${ds.slice(-4).map(ru).join(", ")}.`);
  const days = new Map<number, number>();
  for (const x of ds) days.set(Number(x.slice(8)), (days.get(Number(x.slice(8))) ?? 0) + 1);
  p(`  - дни месяца: ${[...days.entries()].sort((a, b) => a[0] - b[0]).map(([d, c]) => `${d} (${c})`).join(", ")}.`);
}
p();

p("## Частота аркана в каждой роли, доля всех дат");
p();
p("| Аркан | A | O | J | хотя бы в одной точке |");
p("|---|---:|---:|---:|---:|");
for (let a = 1; a <= 22; a++) {
  const inA = rows.filter((r) => r.A === a).length;
  const inO = rows.filter((r) => r.O === a).length;
  const inJ = rows.filter((r) => r.J === a).length;
  const any = rows.filter((r) => r.A === a || r.O === a || r.J === a).length;
  const cell = (x: number) => (x ? pct(x, N, 1) : "не бывает");
  p(`| ${a} · ${NAMES[a]} | ${cell(inA)} | ${cell(inO)} | ${cell(inJ)} | ${pct(any, N, 1)} |`);
}
p();

p("## Самые частые и самые редкие тройки");
p();
p("| Место | Тройка | Арканы | Дат | Доля | Пример даты |");
p("|---:|---|---|---:|---:|---|");
triples.slice(0, 12).forEach(([k, c], i) =>
  p(`| ${i + 1} | ${k} | ${k.split("-").map((x) => NAMES[+x]).join(", ")} | ${c} | ${pct(c, N)} | ${ru(dates.get(k)![0])} |`));
p();
p("Самые редкие:");
p();
for (const [k, c] of triples.slice(-12).reverse())
  p(`- ${k} (${k.split("-").map((x) => NAMES[+x]).join(", ")}): ${c} дат — ${dates.get(k)!.slice(0, 5).map(ru).join(", ")}`);
p();

p("## Повторы, перестановки, зеркала");
p();
const rep = (f: (k: number[]) => boolean) => triples.filter(([k]) => f(k.split("-").map(Number)));
const aeqo = rep(([a, o]) => a === o), oeqj = rep(([, o, j]) => o === j), aeqj = rep(([a, , j]) => a === j);
const all3 = rep(([a, o, j]) => a === o && o === j);
p(`- A = O: ${aeqo.length} троек (${aeqo.map(([k]) => k).join(", ")}).`);
p(`- O = J: ${oeqj.length} троек (${oeqj.map(([k]) => k).join(", ")}).`);
p(`- A = J: ${aeqj.length} троек (${aeqj.map(([k]) => k).join(", ")}).`);
p(`- три одинаковых: ${all3.length} (${all3.map(([k]) => k).join(", ") || "—"}).`);
const both = triples.filter(([k]) => { const [a, o, j] = k.split("-"); return a !== j && count.has(`${j}-${o}-${a}`); });
p(`- Перестановка краёв достижима в обе стороны у ${both.length / 2} пар троек ` +
  `(${both.length} троек из ${count.size}); пример: ${both.slice(0, 3).map(([k]) => k).join(", ")}.`);
const rev = "17-11-12";
p(`- Обратная к 12-11-17 тройка ${rev}: ${count.get(rev) ?? 0} дат; обратная к 5-22-17 (17-22-5): ${count.get("17-22-5") ?? 0} дат.`);
p();
const mirror = (f: (r: Row) => boolean, label: string) => {
  const c = rows.filter(f).length;
  p(`- ${label}: ${c} дат, ${pct(c, N)}.`);
};
mirror((r) => r.key === r.talent, "A–O–J совпадает с линией талантов B–P–K");
mirror((r) => r.key === r.mk, "A–O–J совпадает с материальной кармой C–Q–L");
mirror((r) => r.key === r.tailOut, "A–O–J совпадает с хвостом, прочитанным от угла к центру (D–N–M)");
mirror((r) => r.key === r.fgh, "A–O–J совпадает с F–G–H раздела «Родители и дети»");
mirror((r) => r.jElsewhere, "число J стоит ещё на линии талантов, денег или отношений");
const eqTalent = rows.filter((r) => r.key === r.talent);
p(`  - совпадение с талантами бывает, когда A = B (день равен месяцу после свёртки): ` +
  `${eqTalent.every((r) => r.A === Number(r.talent.split("-")[0]))}.`);
p();

p("## Другой калькулятор: вычитание 22 вместо сложения цифр");
p();
const diff = rows.filter((r) => r.alt !== r.key).length;
p(`- Если все суммы больше 22 сворачивать вычитанием 22, тройка A–O–J выходит другой у ${diff} дат ` +
  `(${pct(diff, N, 1)}).`);
const ex = rows.find((r) => r.iso === "1990-09-05")!;
p(`- 05.09.1990: у нас ${ex.key}, при вычитании 22 — ${ex.alt}. 12.04.2016: у нас ` +
  `${rows.find((r) => r.iso === "2016-04-12")!.key}, при вычитании — ${rows.find((r) => r.iso === "2016-04-12")!.alt}.`);
p();

p("## Пример Лисовской: родители 9, дети 12, внешнее проявление 3");
p();
const lis = dates.get("3-12-9") ?? [];
p(`- В нашей записи A–O–J это 3-12-9: ${lis.length} дат (${pct(lis.length, N)}), дни ` +
  `${[...new Set(lis.map((x) => Number(x.slice(8))))].join(" и ")}; например ${lis.slice(0, 2).map(ru).join(", ")}.`);
p();

p("## Запросы с тройками из семантики");
p();
for (const k of ["6-16-10", "10-16-6", "6-19-13", "13-19-6"])
  p(`- ${k} как A–O–J: ${count.get(k) ?? 0} дат.`);

console.log(out.join("\n"));
