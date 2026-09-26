"use client";

import { useLocale } from "@/components/ui/LocaleProvider";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { forLocale as localizedTariffs, type Tariff, type PaymentProvider } from "@/lib/tariffs";
import { createContext, useContext, useEffect, useState } from "react";

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
  providers: PaymentProvider[] | null;
}

const EMPTY: Prices = { items: [], known: false, providers: null };
const Ctx = createContext<Prices>(EMPTY);

export const forLocale = localized((L: Locale) => {
  const { lead } = localizedTariffs(L);

  return { lead, EMPTY };
});

export default function TariffsProvider({ locale: requestedLocale, ...localeProps }: ({
  server?: Tariff[];
  providers?: PaymentProvider[] | null;
  children: React.ReactNode;
}) & { locale?: Locale }) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;
  const {
    /** прайс, прочитанный на сервере: статические страницы приходят без него */
    server,
    providers = null,
    children,
  } = localeProps;
  const { EMPTY } = forLocale(L);

  const [pricesLocale, setPricesLocale] = useState(L);
  const [prices, setPrices] = useState<Prices>(
    server && server.length ? { items: server, known: true, providers } : EMPTY,
  );

  useEffect(() => {
    if (prices.known && prices.providers !== null && pricesLocale === L) return;
    let alive = true;
    fetch("/api/tariffs", { cache: "no-store", headers: { "Accept-Language": L } })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        const list = (body as { items?: Tariff[] } | null)?.items;
        if (alive && Array.isArray(list) && list.length) {
          setPrices({ items: list, known: true, providers: Array.isArray(body.payment_providers) ? body.payment_providers : null });
          setPricesLocale(L);
        }
      })
      .catch(() => {
        /* цена не пришла: показываем «уточняется», а не число из кода */
      });
    return () => {
      alive = false;
    };
  }, [prices.known, prices.providers, pricesLocale, L]);

  return <Ctx.Provider value={pricesLocale === L ? prices : EMPTY}>{children}</Ctx.Provider>;
}

/** Тарифы для показа. Пока цена не подтверждена базой — список пуст: печатать нечего. */
export function useTariffs(): Tariff[] {
  const L = useLocale();

  const { items, known } = useContext(Ctx);
  return known ? items : [];
}

/** Известна ли настоящая цена. Пока нет — не обещаем её и не зовём платить. */
export function usePriceKnown(): boolean {
  const L = useLocale();

  return useContext(Ctx).known;
}

export function useLead(): Tariff | null {
  const L = useLocale();
  const { lead } = forLocale(L);

  return lead(useContext(Ctx).items);
}

export function usePaymentProviders(): PaymentProvider[] | null {
  return useContext(Ctx).providers;
}
