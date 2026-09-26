"use client";

import { useLocale } from "@/components/ui/LocaleProvider";
import SiteLink from "@/components/ui/SiteLink";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { usePathname } from "next/navigation";

/** Кнопка «Купить» в шапке.
 *
 *  Ссылка вела на голый `/pay`, а тот выбирает цель из даты в браузере: на странице сохранённой
 *  закрытой матрицы платёж уходил за другую дату. Номер матрицы из адреса страницы снимает
 *  двусмысленность — так же, как это делают все остальные кнопки покупки на этой странице. */
export default function BuyButton({ locale: requestedLocale, ...localeProps }: ({ plain?: boolean }) & { locale?: Locale }) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;
  const { plain } = localeProps;

  const path = usePathname();
  const matrix = /^\/matrices\/(\d+)$/.exec(path ?? "");
  const href = matrix ? `/pay?m=${matrix[1]}` : "/pay";
  return (
    <SiteLink plain={plain} className="btn sm" data-testid="buy-top" href={href}>
      {D.nav.buy[L]}
    </SiteLink>
  );
}
