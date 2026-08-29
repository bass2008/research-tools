"use client";

import { byId, money } from "@/lib/tariffs";

import { useLead, usePriceKnown, useTariffs } from "@/components/pay/TariffsProvider";

/**
 * Цена внутри серверной разметки: хука там нет, а печатать зашитое число нельзя.
 *
 * Пока настоящая цена не пришла — на её месте пусто. Раньше здесь появлялись 250 ₽ из кода,
 * в том числе когда API не отвечал и купить по этой цене было нельзя вовсе.
 */
export default function Price({ id }: { id?: string }) {
  const items = useTariffs();
  const fallback = useLead();
  const known = usePriceKnown();
  const t = (id ? byId(items, id) : undefined) ?? fallback;
  if (!known) return <span className="nowrap price-wait">уточняется</span>;
  return <span className="nowrap">{money(t.price)} ₽</span>;
}
