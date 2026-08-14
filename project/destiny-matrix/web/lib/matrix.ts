// Порт engine/matrix.py. Расчёт идёт в браузере: дата рождения не уходит на сервер.
// Любая правка формул обязана повторять правку в engine/matrix.py — сверка эталоном
// в lib/matrix.test.ts (golden.json снят запуском Python-движка).

export const ARCANA_MAX = 22;

export type Sex = "m" | "f";

export const CHAKRAS: ReadonlyArray<readonly [string, string, string]> = [
  ["sahasrara", "Сахасрара", "связь с большим замыслом"],
  ["ajna", "Аджна", "видение и интуиция"],
  ["vishuddha", "Вишудха", "слово, честность, судьба"],
  ["anahata", "Анахата", "любовь и отношения"],
  ["manipura", "Манипура", "статус, воля, деньги"],
  ["svadhisthana", "Свадхистана", "радость, дети, творчество"],
  ["muladhara", "Муладхара", "тело, опора, материя"],
];

export const COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ["physics", "Физика"],
  ["energy", "Энергия"],
  ["emotions", "Эмоции"],
];

export interface ChakraRow {
  key: string;
  title: string;
  hint: string;
  physics: number;
  energy: number;
  emotions: number;
}

export interface ChakraTotals {
  physics: number;
  energy: number;
  emotions: number;
}

export interface AgeSector {
  from: number;
  to: number;
  arcanum: number;
}

export type Triad = [number, number, number];

export interface Matrix {
  birth: string;
  sex: Sex;

  day: number;
  month: number;
  year: number;
  mission: number;
  center: number;

  father_line: number;
  mother_line: number;
  descendants: number;
  inheritance: number;
  karmic_tail: number[];

  comfort_west: number;
  comfort_north: number;
  comfort_east: number;
  comfort_south: number;

  sky: Triad;
  ground: Triad;
  social_male: Triad;
  social_female: Triad;
  harmony: number;
  planetary: number;

  money: number[];
  love: number[];
  talent: number[];
  purpose_personal: number;
  purpose_social: number;

  chakras: ChakraRow[];
  chakra_totals: ChakraTotals;
  age_scale: AgeSector[];
}

export class MatrixError extends Error {}

/** Свести число к 1..22. Кратные 22 дают 22: нулевого аркана в матрице нет. */
export function fold(n: number): number {
  if (!Number.isInteger(n)) throw new MatrixError(`ожидалось целое число, получено ${n}`);
  if (n <= 0) throw new MatrixError(`ожидалось положительное число, получено ${n}`);
  const r = n % ARCANA_MAX;
  return r ? r : ARCANA_MAX;
}

export function digitSum(n: number): number {
  return String(Math.abs(n))
    .split("")
    .reduce((a, c) => a + Number(c), 0);
}

/** Год сворачивается по цифрам, пока не станет не больше 22: 1987 → 25 → 7. */
export function foldYear(year: number): number {
  let n = digitSum(year);
  while (n > ARCANA_MAX) n = digitSum(n);
  return n;
}

function triad(a: number, b: number): Triad {
  return [a, b, fold(a + b)];
}

export interface BirthParts {
  year: number;
  month: number;
  day: number;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseBirth(birth: string | BirthParts): BirthParts {
  if (typeof birth !== "string") return birth;
  const m = ISO.exec(birth);
  if (!m) throw new MatrixError("дата должна быть в формате YYYY-MM-DD");
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isRealDate({ year, month, day }: BirthParts): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

export function toIso({ year, month, day }: BirthParts): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(year, 4)}-${p(month)}-${p(day)}`;
}

function todayParts(): BirthParts {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

function isAfter(a: BirthParts, b: BirthParts): boolean {
  if (a.year !== b.year) return a.year > b.year;
  if (a.month !== b.month) return a.month > b.month;
  return a.day > b.day;
}

/**
 * Возрастная шкала: октаграмма проходится по кругу, каждый сектор — 10 лет.
 * Внутри сектора аркан один: методика меняет энергию на границе, а не плавно.
 */
function ageScale(m: Matrix): AgeSector[] {
  const ring = [
    m.day,
    m.father_line,
    m.month,
    m.mother_line,
    m.year,
    m.descendants,
    m.mission,
    m.inheritance,
  ];
  return ring.map((arc, i) => ({ from: i * 10, to: i * 10 + 10, arcanum: arc }));
}

function chain(a: number, center: number): number[] {
  const b = fold(a + center);
  return [a, b, fold(a + b)];
}

function chakras(m: Matrix): { rows: ChakraRow[]; totals: ChakraTotals } {
  const rows: ChakraRow[] = CHAKRAS.map(([key, title, hint], idx) => {
    const i = idx + 1;
    const physics = fold(m.day + m.year + i);
    const energy = fold(m.month + m.mission + i);
    return { key, title, hint, physics, energy, emotions: fold(physics + energy) };
  });
  const sum = (pick: (r: ChakraRow) => number) => fold(rows.reduce((s, r) => s + pick(r), 0));
  return {
    rows,
    totals: {
      physics: sum((r) => r.physics),
      energy: sum((r) => r.energy),
      emotions: sum((r) => r.emotions),
    },
  };
}

/** Полный расчёт по дате рождения. sex влияет только на подписи родовых линий. */
export function calculate(birth: string | BirthParts, sex: Sex = "f"): Matrix {
  const parts = parseBirth(birth);
  if (sex !== "m" && sex !== "f") throw new MatrixError("sex должен быть 'm' или 'f'");
  if (!Number.isInteger(parts.year) || !Number.isInteger(parts.month) || !Number.isInteger(parts.day))
    throw new MatrixError("дата должна быть целыми числами");
  if (!isRealDate(parts)) throw new MatrixError("такой даты не существует");
  if (isAfter(parts, todayParts())) throw new MatrixError("дата рождения в будущем");
  if (parts.year < 1900) throw new MatrixError("поддерживаются даты рождения с 1900 года");

  const m = { birth: toIso(parts), sex } as Matrix;

  m.day = fold(parts.day);
  m.month = fold(parts.month);
  m.year = foldYear(parts.year);
  m.mission = fold(m.day + m.month + m.year);
  m.center = fold(m.day + m.month + m.year + m.mission);

  m.father_line = fold(m.day + m.month);
  m.mother_line = fold(m.month + m.year);
  m.descendants = fold(m.year + m.mission);
  m.inheritance = fold(m.mission + m.day);

  m.comfort_west = fold(m.day + m.center);
  m.comfort_north = fold(m.month + m.center);
  m.comfort_east = fold(m.year + m.center);
  m.comfort_south = fold(m.mission + m.center);

  m.sky = triad(m.comfort_north, m.comfort_south);
  m.ground = triad(m.comfort_west, m.comfort_east);
  m.social_male = triad(m.father_line, m.descendants);
  m.social_female = triad(m.mother_line, m.inheritance);
  m.harmony = fold(m.sky[2] + m.ground[2]);
  m.planetary = fold(m.social_male[2] + m.social_female[2]);

  m.purpose_personal = fold(m.day + m.year);
  m.purpose_social = fold(m.month + m.mission);

  m.money = chain(m.descendants, m.center);
  m.love = chain(m.mother_line, m.center);
  m.talent = chain(m.month, m.center);
  m.karmic_tail = [m.year, m.inheritance, fold(m.year + m.inheritance)];

  const ch = chakras(m);
  m.chakras = ch.rows;
  m.chakra_totals = ch.totals;
  m.age_scale = ageScale(m);
  return m;
}

/** Все арканы матрицы — для проверок и для сбора ссылок в энциклопедию. */
export function values(m: Matrix): number[] {
  const out = [
    m.day, m.month, m.year, m.mission, m.center,
    m.father_line, m.mother_line, m.descendants, m.inheritance,
    m.comfort_west, m.comfort_north, m.comfort_east, m.comfort_south,
    m.harmony, m.planetary, m.purpose_personal, m.purpose_social,
    ...m.sky, ...m.ground, ...m.social_male, ...m.social_female,
    ...m.karmic_tail, ...m.money, ...m.love, ...m.talent,
  ];
  for (const r of m.chakras) out.push(r.physics, r.energy, r.emotions);
  out.push(m.chakra_totals.physics, m.chakra_totals.energy, m.chakra_totals.emotions);
  for (const p of m.age_scale) out.push(p.arcanum);
  return out;
}
