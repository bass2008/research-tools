"use client";

import { subscribedTo, useSession } from "@/components/account/useSession";
import { ALL_FREE } from "@/lib/access";

/**
 * Что сайт делает с посетителем по продукту: `free` — витрина без оплаты, всё открыто всем;
 * `subscription` — у посетителя подписка, всё открыто ему; `sell` — открыто купленное,
 * остальное продаём.
 *
 * Единственное место этого решения: кнопки покупки, тарифы, цены в текстах и полный расчёт без
 * сохранения читают только режим. Пока каждый компонент сверял флаги сам, подписчику то здесь,
 * то там показывали цену и замки.
 */
export type OfferMode = "free" | "subscription" | "sell";

export function useOfferMode(product: string = "personal"): OfferMode {
  const session = useSession();
  if (ALL_FREE) return "free";
  return subscribedTo(session, product) ? "subscription" : "sell";
}
