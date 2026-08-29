import { arcanumTitle } from "./arcana";
import {
  KARMIC_TAIL_HUB,
  ROOT_HUBS,
  YEAR_HUB,
  arcanumHref,
  chakraByKey,
  chakraHref,
  karmicTailHref,
  positionByKey,
  positionHref,
  yearHref,
} from "./encyclopedia";
import { categoryHub, hub, karmicTail, karmicTails, yearArcanum, yearKeys } from "./content";

/**
 * Связи между статьями автор ставит односторонне и указателем, а не адресом: `arcanum/7`,
 * `position/center`, `na-god/8`, `tail/18-9-9`, `9-6-9` или слаг хаба. Здесь указатель
 * превращается в ссылку, а обратное направление строится само — требование «перелинковка в обе
 * стороны» иначе заставляло бы править уже сданные статьи каждый раз, когда появляется новая.
 */
export interface RelatedLink {
  href: string;
  title: string;
}

const TRIPLE = /^\d{1,2}-\d{1,2}-\d{1,2}$/;

function tailLink(key: string): RelatedLink | null {
  const item = karmicTail(key);
  return item ? { href: karmicTailHref(key), title: item.title } : null;
}

function yearLink(key: string): RelatedLink | null {
  const item = yearArcanum(key);
  if (!item) return null;
  return { href: yearHref(key), title: item.title };
}

/** Указатель → ссылка. null, если цели нет: ссылаться в никуда хуже, чем не ссылаться. */
export function resolveRef(ref: string): RelatedLink | null {
  const value = ref.trim();
  if (!value) return null;

  const [kind, rest] = value.includes("/") ? value.split("/", 2) : [value, ""];

  if (kind === "arcanum") {
    const n = Number(rest);
    if (!Number.isInteger(n) || n < 1 || n > 22) return null;
    return { href: arcanumHref(n), title: `${n} в матрице судьбы: ${arcanumTitle(n)}` };
  }
  if (kind === "position") {
    const p = positionByKey(rest);
    return p ? { href: positionHref(p.key), title: p.title } : null;
  }
  if (kind === "chakra") {
    const c = chakraByKey(rest);
    return c ? { href: chakraHref(c.key), title: c.title } : null;
  }
  if (kind === "tail") return tailLink(rest);
  if (kind === "na-god") {
    if (!rest) {
      return { href: YEAR_HUB, title: categoryHub("na-god")?.title ?? "Матрица судьбы на год" };
    }
    return yearLink(rest);
  }
  if (kind === "karmic-tail") {
    return {
      href: KARMIC_TAIL_HUB,
      title: categoryHub("karmic-tail")?.title ?? "Кармический хвост в матрице судьбы",
    };
  }
  if (TRIPLE.test(value)) return tailLink(value);
  if (ROOT_HUBS.includes(value)) {
    const item = hub(value);
    return item ? { href: `/${value}`, title: item.title } : null;
  }
  return null;
}

export function resolveRefs(refs: string[]): RelatedLink[] {
  const out: RelatedLink[] = [];
  for (const ref of refs) {
    const link = resolveRef(ref);
    if (link && !out.some((x) => x.href === link.href)) out.push(link);
  }
  return out;
}

interface Source {
  path: string;
  title: string;
  related: string[];
}

// Все статьи, у которых есть связи: по ним строится обратный индекс. Обогащение существующих
// категорий (арканы, позиции) сюда не входит — у него нет поля related.
function sources(): Source[] {
  const out: Source[] = [];
  for (const t of karmicTails()) {
    out.push({ path: karmicTailHref(t.key), title: t.title, related: t.related });
  }
  for (const key of yearKeys()) {
    const item = yearArcanum(key);
    if (item) out.push({ path: yearHref(key), title: item.title, related: item.related });
  }
  for (const key of ROOT_HUBS) {
    const item = hub(key);
    if (item) out.push({ path: `/${key}`, title: item.title, related: item.related });
  }
  for (const [key, path] of [
    ["karmic-tail", KARMIC_TAIL_HUB],
    ["na-god", YEAR_HUB],
  ] as const) {
    const item = categoryHub(key);
    if (item) out.push({ path, title: item.title, related: item.related });
  }
  return out;
}

let BACK: Map<string, RelatedLink[]> | null = null;

function backIndex(): Map<string, RelatedLink[]> {
  if (BACK) return BACK;
  const index = new Map<string, RelatedLink[]>();
  for (const source of sources()) {
    for (const link of resolveRefs(source.related)) {
      const list = index.get(link.href) ?? [];
      if (!list.some((x) => x.href === source.path)) {
        list.push({ href: source.path, title: source.title });
      }
      index.set(link.href, list);
    }
  }
  BACK = index;
  return index;
}

/** Кто ссылается на эту страницу. Обратную сторону связи держит рендер, а не автор. */
export function backlinks(path: string): RelatedLink[] {
  return backIndex().get(path) ?? [];
}

/** Связи страницы в обе стороны, без самой страницы и без повторов. */
export function relatedBoth(path: string, refs: string[]): RelatedLink[] {
  const out: RelatedLink[] = [];
  for (const link of [...resolveRefs(refs), ...backlinks(path)]) {
    if (link.href !== path && !out.some((x) => x.href === link.href)) out.push(link);
  }
  return out;
}
