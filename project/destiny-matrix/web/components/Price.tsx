"use client";

import { byId, money } from "@/lib/tariffs";

import { useLead, useTariffs } from "./TariffsProvider";

/** Цена внутри серверной разметки: хука там нет, а печатать зашитое число нельзя. */
export default function Price({ id }: { id?: string }) {
  const items = useTariffs();
  const fallback = useLead();
  const t = (id ? byId(items, id) : undefined) ?? fallback;
  return <>{money(t.price)} ₽</>;
}
