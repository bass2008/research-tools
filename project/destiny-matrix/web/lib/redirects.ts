/** Постоянные переезды адресов энциклопедии.
 *
 *  Правило проекта (.agents/skills/arcana-product-skill/references/content-format.md, «Адрес и ключ страницы»): редирект допустим только на однозначного
 *  successor той же сущности. Редирект на хаб, на главную или на семантически другую страницу
 *  запрещён — ошибочная сущность уходит в 404, а не в чужую статью.
 *
 *  Здесь три переезда. Первый: «N аркан под сердцем» считался точкой M, а это точка R1 —
 *  сущность та же, сменился только ключ точки в адресе. Второй: транслитовые адреса статей
 *  переведены на английские слаги (`docs/runtime-localization.md`, «Словари, корпус и React Native»). Адрес у всех языков один и пишется
 *  по-английски, поэтому русские страницы переехали первыми — до того, как их обойдёт робот
 *  второго языка. Редирект живёт не меньше года: внешние ссылки не исправит никто.
 */
export interface Redirect {
  source: string;
  destination: string;
}

/** Числа, под которыми «под сердцем» стояло на входе линии отношений M. */
const HEART_MOVED = [5, 6, 7, 8, 9, 10, 11, 16, 18, 19, 20, 21, 22];

/** Транслитовые адреса статей: было → стало. Год раскрывается ещё и по ключам (`/na-god/8`). */
const TRANSLITERATED: Array<[string, string]> = [
  ["avtor", "author"],
  ["energii", "energies"],
  ["kak-chitat-matricu", "how-to-read"],
  ["karmicheskaya-matrica", "karmic-matrix"],
  ["o-metode", "method"],
  ["oferta", "terms"],
  ["polnaya-rasshifrovka", "full-reading"],
  ["programmy", "programs"],
  ["rasshifrovka", "decoding"],
  ["rasshifrovka-po-date", "by-birth-date"],
  ["rasshifrovka-znachenie", "meaning"],
  ["na-god", "year"],
];

/** Статьи-хабы и раздел года переехали из корня в энциклопедию 10.11.2026: все статьи живут в
 *  `/encyclopedia/` (AGENTS.md). */
const MOVED_TO_ENCYCLOPEDIA = [
  "author", "business-compatibility", "by-birth-date", "compatibility-center", "decoding", "energies",
  "full-reading", "how-to-read", "karmic-matrix", "meaning", "method", "programs", "year",
];

const encyclopediaPath = (key: string) => MOVED_TO_ENCYCLOPEDIA.includes(key) ? `/encyclopedia/${key}` : `/${key}`;

export const REDIRECTS: Redirect[] = [
  ...HEART_MOVED.map((n) => ({
    source: `/encyclopedia/position/comfort_south/${n}`,
    destination: `/encyclopedia/position/love_middle/${n}`,
  })),
  ...TRANSLITERATED.map(([from, to]) => ({ source: `/${from}`, destination: encyclopediaPath(to) })),
  // Страницы года: 22 аркана плюс страница календарного года — одно правило на весь путь.
  { source: "/na-god/:key", destination: "/encyclopedia/year/:key" },
  ...MOVED_TO_ENCYCLOPEDIA.map((key) => ({ source: `/${key}`, destination: `/encyclopedia/${key}` })),
  { source: "/year/:key", destination: "/encyclopedia/year/:key" },
  // Обзор хвоста пары стал шапкой раздела хвостов пары: та же статья, список 97 хвостов под ней.
  { source: "/karmic-compatibility", destination: "/encyclopedia/compatibility/tails" },
];

/** New address for a moved one. Sources carry no language prefix: middleware strips it and adds
 *  the site's language back, so the visitor reaches the final URL in one 301. */
export function redirectTarget(path: string): string | null {
  for (const { source, destination } of REDIRECTS) {
    if (!source.endsWith("/:key")) {
      if (path === source) return destination;
      continue;
    }
    const base = source.slice(0, -":key".length);
    const key = path.startsWith(base) ? path.slice(base.length) : "";
    if (key && !key.includes("/")) return destination.replace(":key", key);
  }
  return null;
}
