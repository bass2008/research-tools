"use client";

import Link from "next/link";

import { D, L } from "@/lib/i18n";

/**
 * Платёж по адресу есть, а сервер о нём молчит.
 *
 * Форму здесь показывать нельзя: F5 на чеке при неотвечающем API предлагал оплатить уже
 * оплаченное. Пока исход неизвестен, про деньги ничего не утверждаем.
 */
export default function PayUnchecked({ paymentId }: { paymentId: string | null }) {
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
