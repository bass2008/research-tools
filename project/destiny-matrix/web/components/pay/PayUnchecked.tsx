"use client";

import { useLocale } from "@/components/ui/LocaleProvider";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import Link from "next/link";

/**
 * Платёж по адресу есть, а сервер о нём молчит.
 *
 * Форму здесь показывать нельзя: F5 на чеке при неотвечающем API предлагал оплатить уже
 * оплаченное. Пока исход неизвестен, про деньги ничего не утверждаем.
 */
export default function PayUnchecked({ locale: requestedLocale, ...localeProps }: ({ paymentId: string | null }) & { locale?: Locale }) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;
  const { paymentId } = localeProps;

  return (
    <div className="panel paybox">
      <h3>{D.payResult.uncheckedTitle[L]}</h3>
      <p className="dim">
        {D.payResult.uncheckedLead[L](paymentId ?? "")}{" "}
        <Link href="/account">{D.payResult.uncheckedAccount[L]}</Link>.
      </p>
      <button className="btn wide" type="button" onClick={() => window.location.reload()}>
        {D.payResult.uncheckedRetry[L]}
      </button>
    </div>
  );
}
