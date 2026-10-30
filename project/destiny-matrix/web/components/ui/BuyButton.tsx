"use client";

import { useLocale } from "@/components/ui/LocaleProvider";
import { useOfferMode } from "@/components/pay/useOfferMode";
import SiteLink from "@/components/ui/SiteLink";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { buyHref } from "@/lib/readingLinks";
import { useBirth } from "@/lib/useBirth";
import { splitPublicPath } from "@/lib/publicRouting";
import { usePathname } from "next/navigation";

/** Кнопка «Купить» в шапке. Что предложить, решает страница, а не браузер: там может лежать и
 *  дата, и пара сразу, а страница однозначно говорит, что человек сейчас смотрит. На странице
 *  личного разбора — эта дата или подписка, на совместимости — эта пара или подписка, на остальных
 *  — все предложения. Номер сохранённой записи из адреса доезжает до формы: без него на странице
 *  закрытой матрицы платёж уходил за дату из браузера. */
export function buyFor(path: string, hasBirth: boolean): string {
  const matrix = /^\/matrices\/(\d+)$/.exec(path);
  if (matrix) return buyHref("personal", Number(matrix[1]));
  const reading = /^\/readings\/(\d+)$/.exec(path);
  if (reading) return buyHref("pair", Number(reading[1]));
  if (path === "/report" || (path === "/" && hasBirth)) return buyHref("personal");
  if (path === "/compatibility") return buyHref("pair");
  return buyHref();
}

export default function BuyButton({ locale: requestedLocale, ...localeProps }: ({ plain?: boolean }) & { locale?: Locale }) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;
  const { plain } = localeProps;

  const path = splitPublicPath(usePathname()).path;
  const birth = useBirth();
  const mode = useOfferMode();
  if (mode !== "sell") return null;
  const href = buyFor(path ?? "", birth !== null);
  return (
    <SiteLink plain={plain} className="btn sm" data-testid="buy-top" href={href}>
      {D.nav.buy[L]}
    </SiteLink>
  );
}
