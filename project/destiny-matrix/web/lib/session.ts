/** Что делать, когда сессия в этой вкладке разошлась с ответом сервера. */

/** Хозяин вкладки сменился: был один человек, стал другой или гость. */
export function ownerChanged(before: string | null, after: string | null): boolean {
  return before !== null && before !== after;
}

/**
 * Нужна ли перезагрузка страницы. Только смена хозяина: на экране могли остаться его данные, и
 * убрать их надёжнее всего перерисовкой с нуля.
 *
 * Появление сессии — отдельный случай: оно требует перерисовки только после состояния `guest`,
 * но не при первичном `loading`. Эту границу проверяет `sessionAppeared` ниже.
 */
export function needsReload(before: string | null, after: string | null): boolean {
  return ownerChanged(before, after);
}

/**
 * Сессия появилась после уже завершённой проверки гостя. Начальный `loading` сюда не относится:
 * на F5 он бывает у каждого вошедшего человека, и трактовать ответ `/auth/me` как новый вход —
 * значит запускать повторную перезагрузку страницы.
 */
export function sessionAppeared(status: string, before: string | null, after: string | null): boolean {
  return status === "guest" && before === null && after !== null;
}

/**
 * Показывать ли человека в шапке. Пока сессия перепроверяется, почта уже известна — заменять её
 * служебной надписью незачем: на странице оплаты сверка идёт по расписанию, и шапка мигала.
 */
export function personVisible(status: string, email: string | null): boolean {
  // guest — единственное состояние, где человека точно нет; в остальных почта уже известна, и
  // терять её из-за перепроверки или отказа сети незачем
  return Boolean(email) && status !== "guest";
}
