"use client";

import { useLead, usePriceKnown, useTariffs } from "@/components/pay/TariffsProvider";
import { useOfferMode } from "@/components/pay/useOfferMode";
import { useLocale } from "@/components/ui/LocaleProvider";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { forLocale as localizedTariffs } from "@/lib/tariffs";
import type { ReactNode } from "react";

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
 * Цена там, где предложение можно закрыть словом: «полный разбор — 250 ₽», «— бесплатно» на
 * витрине без оплаты и «— открыт по вашей подписке» подписчику.
 */
export function PriceOrFree({ locale: requestedLocale, ...localeProps }: ({}) & { locale?: Locale } = {}) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;

  return (
    <OfferText free={<span className="nowrap">{D.pay.freeWord[L]}</span>} subscription={D.pay.openBySubscription[L]}>
      <Price locale={L} />
    </OfferText>
  );
}

/** Фраза о цене в формулировке режима посетителя (`useOfferMode`): серверной разметке хука нет. */
export function OfferText({ product, free, subscription, children }: {
  product?: string;
  free: ReactNode;
  subscription: ReactNode;
  children: ReactNode;
}) {
  const mode = useOfferMode(product);
  return <>{mode === "free" ? free : mode === "subscription" ? subscription : children}</>;
}
