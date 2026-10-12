"use client";

import { useSession } from "@/components/account/useSession";
import Plans, { type PlanCarry } from "@/components/pay/Plans";
import { useOfferMode } from "@/components/pay/useOfferMode";
import { D, forLocale as localizedI18n } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import Link from "next/link";

/** Подписка уже открывает продукт: покупать нечего, есть путь к разборам. */
export function Subscribed({ locale: L, pair = false }: { locale: Locale; pair?: boolean }) {
  const session = useSession();
  return (
    <div className="panel paybox" data-testid="pay-subscribed">
      <h3>{D.payForm.subscribedTitle[L]}</h3>
      {session.until ? (
        <p className="dim">{D.payForm.subscribedUntil[L](localizedI18n(L).dateLabel(session.until.slice(0, 10), L))}</p>
      ) : null}
      <Link className="btn wide" href={pair ? "/compatibility" : "/report"}>
        {pair ? D.payForm.openCompatibility[L] : D.payForm.openMyReading[L]}
      </Link>
      <p className="hint"><Link href="/account">{D.nav.account[L]}</Link></p>
    </div>
  );
}

/** Выбор перед формой оплаты, а подписчику — что у него уже всё открыто. */
export function PayChoice({ locale, pair = false, carry }: { locale: Locale; pair?: boolean; carry?: PlanCarry }) {
  return useOfferMode() === "subscription"
    ? <Subscribed locale={locale} pair={pair} />
    : <Plans locale={locale} place="buy" carry={carry} />;
}
