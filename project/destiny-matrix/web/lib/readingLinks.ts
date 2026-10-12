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

/** «Купить» со страницы продукта: разовая покупка этого продукта или подписка. Без продукта —
 *  все предложения сайта. Номер записи доезжает до формы и ставит её в поля. */
export function buyHref(product?: BuyFor | null, reading?: number | null): string {
  if (!product) return "/pay";
  const id = reading ? `&${product === "pair" ? "r" : "m"}=${reading}` : "";
  return `/pay?for=${product}${id}`;
}
