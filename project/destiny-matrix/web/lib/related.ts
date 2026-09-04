import { arcanumTitle } from "./arcana";
import {
  KARMIC_TAIL_HUB,
  ROOT_HUBS,
  YEAR_HUB,
  ARCANUM_HUB,
  CHAKRA_HUB,
  COMBINATION_HUB,
  POSITION_HUB,
  arcanumHref,
  chakraByKey,
  chakraHref,
  combinationHref,
  karmicTailHref,
  positionByKey,
  positionHref,
  yearHref,
} from "./encyclopedia";
import { categoryHub, hub, karmicTail, karmicTails, yearArcanum, yearKeys } from "./content";
import { positionArcanumHref, positionArcanumLabel, registryItem } from "./positionArcanum";

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

const SECTION_HUBS: Record<string, string> = {
  arcanum: ARCANUM_HUB,
  chakra: CHAKRA_HUB,
  combination: COMBINATION_HUB,
  position: POSITION_HUB,
};

/** Указатель → ссылка. null, если цели нет: ссылаться в никуда хуже, чем не ссылаться. */
export function resolveRef(ref: string): RelatedLink | null {
  const value = ref.trim();
  if (!value) return null;

  const [kind, rest] = value.includes("/") ? value.split("/", 2) : [value, ""];

  // Указатель без второй половины — шапка раздела: `arcanum` против `arcanum/7`. Заголовок берём
  // из её же материала, чтобы имя ссылки не расходилось с h1 страницы.
  if (!rest) {
    const hub = SECTION_HUBS[kind];
    if (hub) {
      const item = categoryHub(kind);
      if (!item) throw new Error(`нет канонического материала хаба ${kind}`);
      return { href: hub, title: item.title };
    }
  }

  // Пересечение «аркан N в позиции X»: указатель `position/center/6`. Разбирается раньше
  // `position`, иначе `rest` «center/6» не нашёлся бы как ключ позиции.
  if (kind === "position" && rest.includes("/")) {
    const [key, number] = rest.split("/", 2);
    const arcanum = Number(number);
    const item = Number.isInteger(arcanum) ? registryItem(key ?? "", arcanum) : null;
    return item
      ? { href: positionArcanumHref(item.position, item.arcanum), title: positionArcanumLabel(item) }
      : null;
  }

  if (kind === "combination") {
    const pair = rest.split("-").map(Number);
    if (pair.length !== 2 || pair.some((n) => !Number.isInteger(n) || n < 1 || n > 22)) return null;
    const [a, b] = pair as [number, number];
    return {
      href: combinationHref(a, b),
      title: `${a} и ${b}: ${arcanumTitle(a)} и ${arcanumTitle(b)}`,
    };
  }

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
      const item = categoryHub("na-god");
      if (!item) throw new Error("нет канонического материала хаба na-god");
      return { href: YEAR_HUB, title: item.title };
    }
    return yearLink(rest);
  }
  if (kind === "karmic-tail") {
    const item = categoryHub("karmic-tail");
    if (!item) throw new Error("нет канонического материала хаба karmic-tail");
    return {
      href: KARMIC_TAIL_HUB,
      title: item.title,
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
