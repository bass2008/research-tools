"use client";

import { useLead, usePriceKnown, useTariffs } from "@/components/pay/TariffsProvider";
import { useLocale } from "@/components/ui/LocaleProvider";
import { ALL_FREE } from "@/lib/access";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { forLocale as localizedTariffs } from "@/lib/tariffs";

export const forLocale = localized((L: Locale) => {
  const { byId, priceLabel } = localizedTariffs(L);

  return { byId, priceLabel };
});

/**
 * Цена внутри серверной разметки: хука там нет, а печатать зашитое число нельзя.
 *
 * Пока настоящая цена не пришла — на её месте пусто. Раньше здесь появлялись 250 ₽ из кода,
 * в том числе когда API не отвечал и купить по этой цене было нельзя вовсе.
 */
export default function Price({ locale: requestedLocale, ...localeProps }: ({ id?: string }) & { locale?: Locale }) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;
  const { id } = localeProps;
  const { byId, priceLabel } = forLocale(L);

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
export function PriceOrFree({ locale: requestedLocale, ...localeProps }: ({}) & { locale?: Locale } = {}) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;

  if (ALL_FREE) return <span className="nowrap">{D.pay.freeWord[L]}</span>;
  return <Price locale={L} />;
}
