/** Постоянные переезды адресов энциклопедии.
 *
 *  Правило проекта (docs/article-requirements.md, E2): редирект допустим только на однозначного
 *  successor той же сущности. Редирект на хаб, на главную или на семантически другую страницу
 *  запрещён — ошибочная сущность уходит в 404, а не в чужую статью.
 *
 *  Здесь два переезда. Первый: «N аркан под сердцем» считался точкой M, а это точка R1 —
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

export const REDIRECTS: Redirect[] = [
  ...HEART_MOVED.map((n) => ({
    source: `/encyclopedia/position/comfort_south/${n}`,
    destination: `/encyclopedia/position/love_middle/${n}`,
  })),
  ...TRANSLITERATED.map(([from, to]) => ({ source: `/${from}`, destination: `/${to}` })),
  // Страницы года: 22 аркана плюс страница календарного года — одно правило на весь путь.
  { source: "/na-god/:key", destination: "/year/:key" },
];
