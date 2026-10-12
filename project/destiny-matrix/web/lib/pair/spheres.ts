// Сферы разбора пары: какие точки читаются вместе, ключ текста и что открыто без покупки.
// Тексты лежат в корпусе по ключу юнита; один юнит показывается каждой паре с этими числами.
import type { Points, PointKey } from "./engine";

export type SphereId =
  | "meet" | "atmosphere" | "characters" | "image" | "fills" | "material"
  | "money" | "relations" | "parents" | "tasks" | "spoils" | "values";

export type RoleId =
  | "image" | "create" | "atmosphere" | "seen" | "fills" | "material" | "moneyIn" | "moneyPath"
  | "moneyLeak" | "success" | "connects" | "language" | "parents" | "teach" | "taskIn" | "taskMid"
  | "task" | "spoils" | "values" | "tasks" | "character" | "wishes";

export interface PairUnit {
  unit: string;
  title?: string | null;
  captions?: Record<string, string>;
  meaning?: string | null;
  text?: string[] | string | null;
}

export interface Sphere {
  id: SphereId;
  kind: "cards" | "blocks" | "characters";
  /** точки сферы и подпись над картой */
  cards?: Array<[PointKey, RoleId]>;
  key?: (p: Points) => string;
  /** числа сферы так, как их набирают: сочетание через плюс, линия через дефис */
  nums?: (p: Points) => string;
}

export const SPHERES: Sphere[] = [
  { id: "meet", kind: "cards", cards: [["A", "image"], ["B", "create"]],
    key: (p) => `meet:${p.A}+${p.B}`, nums: (p) => `${p.A} + ${p.B}` },
  { id: "atmosphere", kind: "cards", cards: [["E", "atmosphere"]],
    key: (p) => `atmosphere:${p.E}`, nums: (p) => `${p.E}` },
  { id: "characters", kind: "characters" },
  { id: "image", kind: "cards", cards: [["A", "seen"]], key: (p) => `image:${p.A}`, nums: (p) => `${p.A}` },
  { id: "fills", kind: "cards", cards: [["F", "fills"]], key: (p) => `fills:${p.F}`, nums: (p) => `${p.F}` },
  { id: "material", kind: "cards", cards: [["C", "material"]], key: (p) => `material:${p.C}`, nums: (p) => `${p.C}` },
  { id: "money", kind: "cards", cards: [["L", "moneyIn"], ["R2", "moneyPath"], ["R", "moneyLeak"]],
    key: (p) => `money:${p.L}-${p.R2}-${p.R}`, nums: (p) => `${p.L}-${p.R2}-${p.R}` },
  { id: "relations", kind: "cards", cards: [["R", "success"], ["R1", "connects"], ["M", "language"]],
    key: (p) => `relations:${p.R}-${p.R1}-${p.M}`, nums: (p) => `${p.R}-${p.R1}-${p.M}` },
  { id: "parents", kind: "blocks", cards: [["J", "parents"], ["O", "teach"]], nums: (p) => `${p.J} + ${p.O}` },
  { id: "tasks", kind: "cards", cards: [["M", "taskIn"], ["N", "taskMid"], ["D", "task"]],
    key: (p) => `tasks:${p.M}-${p.N}-${p.D}`, nums: (p) => `${p.M}-${p.N}-${p.D}` },
  { id: "spoils", kind: "cards", cards: [["G", "spoils"]], key: (p) => `spoils:${p.G}`, nums: (p) => `${p.G}` },
  { id: "values", kind: "cards", cards: [["spiritual", "values"]],
    key: (p) => `values:${p.spiritual}`, nums: (p) => `${p.spiritual}` },
];

/** Открыто без покупки: так согласовано в прототипе. */
export const FREE: SphereId[] = ["meet", "atmosphere"];

export const SUMMARY: SphereId[] = ["meet", "atmosphere", "characters", "tasks", "values"];

/** Подпись под главной картой — короткое толкование юнита своей сферы. */
export const MAIN: Array<{ role: RoleId; key: PointKey; sphere: SphereId }> = [
  { role: "atmosphere", key: "E", sphere: "atmosphere" },
  { role: "image", key: "A", sphere: "image" },
  { role: "create", key: "B", sphere: "meet" },
  { role: "tasks", key: "D", sphere: "tasks" },
  { role: "values", key: "spiritual", sphere: "values" },
];

// Точки личной матрицы, по которым энергия считается своей для совпадения характеров.
export const PERSONAL_READ: PointKey[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "L", "R2", "R", "R1", "M", "spiritual"];

export interface Block {
  unit: string;
  card: number;
  role: RoleId;
  /** чья карта совпала — подводка продукта, а не текст юнита */
  lead?: { kind: "both" | "one" | "wishes"; card: number };
}

export function sphereOf(id: SphereId): Sphere {
  return SPHERES.find((s) => s.id === id)!;
}

/** Совпадение характеров: основа характера (R) и желания (M) одного звучат в карте другого.
 *  Несовпадение не показывается — «не совпало» не новость. */
export function characters(a: Points, b: Points): Block[] {
  const has = (who: Points, n: number) => PERSONAL_READ.some((k) => who[k] === n);
  const out: Block[] = [];
  // Совпадения проверяются в обе стороны: у первого партнёра нет приоритета.
  // Стабильный порядок даёт одинаковые ключи при открытии сохранённой пары наоборот.
  for (const [point, family, role] of [["R", "dual", "character"], ["M", "semidual", "wishes"]] as const) {
    const matches = [has(b, a[point]) ? a[point] : null, has(a, b[point]) ? b[point] : null];
    const cards = [...new Set(matches.filter((n): n is number => n !== null))].sort((x, y) => x - y);
    for (const card of cards) {
      const kind = point === "M" ? "wishes" : a.R === b.R ? "both" : "one";
      out.push({ unit: `characters:${family}:${card}`, card, role, lead: { kind, card } });
    }
  }
  return out;
}

export function blocks(sphere: Sphere, a: Points, b: Points, p: Points): Block[] {
  if (sphere.kind === "characters") return characters(a, b);
  if (sphere.kind === "blocks") {
    return sphere.cards!.map(([key, role]) => ({ unit: `${sphere.id}:${key}:${p[key]}`, card: p[key], role }));
  }
  return [];
}

/** Ключи юнитов сферы: у сочетания и точки — один, у блоков — по блоку. */
export function unitKeys(sphere: Sphere, a: Points, b: Points, p: Points): string[] {
  if (sphere.kind === "cards") return [sphere.key!(p)];
  return blocks(sphere, a, b, p).map((x) => x.unit);
}

export function visible(a: Points, b: Points): Sphere[] {
  return SPHERES.filter((s) => s.kind !== "characters" || characters(a, b).length > 0);
}

/** Дополнительные точки H и I своего текста не имеют: совпадение с картой сферы усиливает её тему. */
export function amplified(sphere: Sphere, p: Points): number[] {
  if (!sphere.cards || sphere.kind !== "cards") return [];
  const own = new Set(sphere.cards.map(([k]) => p[k]));
  return [...new Set([p.H, p.I])].filter((n) => own.has(n));
}

/** Карты сферы без повторов: одна энергия в двух точках показывается одной картой. */
export function distinctCards(sphere: Sphere, p: Points): Array<[PointKey, RoleId]> {
  const seen = new Set<number>();
  return (sphere.cards ?? []).filter(([k]) => {
    if (seen.has(p[k])) return false;
    seen.add(p[k]);
    return true;
  });
}

/** Что нужно бесплатной части: тексты бесплатных сфер и подписи главных карт. По этим ключам
 *  дату не восстановить — в браузере остаются только числа. */
export function previewKeys(a: Points, b: Points, p: Points): { units: string[]; captions: string[] } {
  const units = FREE.flatMap((id) => unitKeys(sphereOf(id), a, b, p));
  const captions = MAIN.map((m) => sphereOf(m.sphere).key!(p));
  return { units, captions };
}
