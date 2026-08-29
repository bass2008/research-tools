"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { FALLBACK, type Tariff, lead } from "@/lib/tariffs";

/**
 * Прайс для браузера.
 *
 * Зашитая цена больше не показывается людям. Она попадала на экран ровно тогда, когда API
 * недоступен, — то есть когда купить всё равно нельзя: платёж идёт в тот же API. Пока ответа
 * нет, места под цену пустые; если ответа не будет — страница говорит «цена уточняется», а не
 * называет число из кода.
 */
interface Prices {
  items: Tariff[];
  /** true — цена настоящая, из базы; false — ещё не пришла или не придёт */
  known: boolean;
}

const EMPTY: Prices = { items: FALLBACK, known: false };
const Ctx = createContext<Prices>(EMPTY);

export default function TariffsProvider({
  /** прайс, прочитанный на сервере: статические страницы приходят без него */
  server,
  children,
}: {
  server?: Tariff[];
  children: React.ReactNode;
}) {
  const [prices, setPrices] = useState<Prices>(
    server && server.length ? { items: server, known: true } : EMPTY,
  );

  useEffect(() => {
    if (prices.known) return;
    let alive = true;
    fetch("/api/tariffs", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        const list = (body as { items?: Tariff[] } | null)?.items;
        if (alive && Array.isArray(list) && list.length) setPrices({ items: list, known: true });
      })
      .catch(() => {
        /* цена не пришла: показываем «уточняется», а не число из кода */
      });
    return () => {
      alive = false;
    };
  }, [prices.known]);

  return <Ctx.Provider value={prices}>{children}</Ctx.Provider>;
}

/** Тарифы для показа. Пока цена не подтверждена базой — список пуст: печатать нечего. */
export function useTariffs(): Tariff[] {
  const { items, known } = useContext(Ctx);
  return known ? items : [];
}

/** Известна ли настоящая цена. Пока нет — не обещаем её и не зовём платить. */
export function usePriceKnown(): boolean {
  return useContext(Ctx).known;
}

export function useLead(): Tariff {
  return lead(useContext(Ctx).items);
}
