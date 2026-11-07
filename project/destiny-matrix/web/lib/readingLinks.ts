// Куда ведёт разбор и его оплата. У личного разбора адреса прежние, у остальных продуктов —
// общая страница разбора и оплата по коду предложения.
export interface ReadingRef {
  id: number;
  product?: string | null;
}

export function readingHref(reading: ReadingRef | null | undefined): string {
  if (!reading) return "/report";
  return !reading.product || reading.product === "personal" ? `/report?m=${reading.id}` : `/readings/${reading.id}`;
}

/** Вернуться к оплате конкретного разбора: сразу форма его предложения. */
export function payHref(reading: ReadingRef | null | undefined, product?: string | null): string {
  const code = reading?.product ?? product ?? "personal";
  if (code === "personal") return reading ? `/pay/single?m=${reading.id}` : "/pay/single";
  return reading ? `/pay/${code}?r=${reading.id}` : `/pay/${code}`;
}

export type BuyFor = "personal" | "pair";

/** «Купить» ведёт на один экран со всеми предложениями. Номер сохранённой записи доезжает до формы
 *  своего предложения: иначе деньги откроют не ту дату, что человек читал. */
export function buyHref(product?: BuyFor | null, reading?: number | null): string {
  if (!product || !reading) return "/pay";
  return `/pay?${product === "pair" ? "r" : "m"}=${reading}`;
}
