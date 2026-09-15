/** Постоянные переезды адресов энциклопедии.
 *
 *  Правило проекта (docs/article-requirements.md, E2): редирект допустим только на однозначного
 *  successor той же сущности. Редирект на хаб, на главную или на семантически другую страницу
 *  запрещён — ошибочная сущность уходит в 404, а не в чужую статью.
 *
 *  Здесь один переезд: «N аркан под сердцем» считался точкой M, а это точка R1. Сущность та же —
 *  тот же вопрос, тот же заголовок, тот же головной запрос, — сменился только ключ точки в адресе.
 */
export interface Redirect {
  source: string;
  destination: string;
}

/** Числа, под которыми «под сердцем» стояло на входе линии отношений M. */
const HEART_MOVED = [5, 6, 7, 8, 9, 10, 11, 16, 18, 19, 20, 21, 22];

export const REDIRECTS: Redirect[] = HEART_MOVED.map((n) => ({
  source: `/encyclopedia/position/comfort_south/${n}`,
  destination: `/encyclopedia/position/love_middle/${n}`,
}));
