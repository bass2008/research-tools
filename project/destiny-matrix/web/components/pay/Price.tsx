"use client";

import { ALL_FREE } from "@/lib/access";
import { D, L } from "@/lib/i18n";
import { byId, priceLabel } from "@/lib/tariffs";

import { useLead, usePriceKnown, useTariffs } from "@/components/pay/TariffsProvider";

/**
 * Цена внутри серверной разметки: хука там нет, а печатать зашитое число нельзя.
 *
 * Пока настоящая цена не пришла — на её месте пусто. Раньше здесь появлялись 250 ₽ из кода,
 * в том числе когда API не отвечал и купить по этой цене было нельзя вовсе.
 */
export default function Price({ id }: { id?: string }) {
  const items = useTariffs();
  const main = useLead();
  const known = usePriceKnown();
  const t = id ? byId(items, id) : main;
  if (!known || !t) return <span className="nowrap price-wait">{D.pay.priceBeingUpdated[L]}</span>;
  return <span className="nowrap">{priceLabel(t)}</span>;
}

/**
 * Цена там, где предложение можно закрыть словом: «полный разбор — 250 ₽» и «полный разбор —
 * бесплатно». На витрине без оплаты цены нет, а обещание платного разбора было бы ложью.
 */
export function PriceOrFree() {
  if (ALL_FREE) return <span className="nowrap">{D.pay.freeWord[L]}</span>;
  return <Price />;
}
