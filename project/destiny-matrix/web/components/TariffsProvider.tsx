"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { FALLBACK, type Tariff, lead } from "@/lib/tariffs";

// Статика печатает запасные цены, потому что собрана до запроса; провайдер сразу после
// монтирования заменяет их живыми из базы. Разойтись значения могут только в момент
// эксперимента с ценой — сразу после `UPDATE` и до пересборки.
const Ctx = createContext<Tariff[]>(FALLBACK);

export default function TariffsProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Tariff[]>(FALLBACK);

  useEffect(() => {
    let alive = true;
    fetch("/api/tariffs", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        const list = (body as { items?: Tariff[] } | null)?.items;
        if (alive && Array.isArray(list) && list.length) setItems(list);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return <Ctx.Provider value={items}>{children}</Ctx.Provider>;
}

export function useTariffs(): Tariff[] {
  return useContext(Ctx);
}

export function useLead(): Tariff {
  return lead(useContext(Ctx));
}
