"use client";

import { useSession } from "@/components/account/useSession";
import Plans, { type PlanCarry } from "@/components/pay/Plans";
import { useOfferMode } from "@/components/pay/useOfferMode";
import { D, forLocale as localizedI18n } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import Link from "@/components/ui/LocalizedLink";

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

/** Automatic offers on /pay: always all three; a subscriber sees one line instead, since everything automatic is open. */
export function PayChoice({ locale: L, carry }: { locale: Locale; carry?: PlanCarry }) {
  const session = useSession();
  const subscribed = useOfferMode() === "subscription";
  const until = session.until ? localizedI18n(L).dateLabel(session.until.slice(0, 10), L) : "";
  return <>
    <p className="lead">{subscribed ? D.individualSale.leadSubscribed[L] : D.individualSale.lead[L]}</p>
    {subscribed
      ? <p className="panel pay-subscribed" data-testid="pay-subscribed">{D.individualSale.subscribedLine[L](until)}</p>
      : <>
        <p className="isale-divider">{D.individualSale.autoDivider[L]}</p>
        <Plans locale={L} place="buy" carry={carry} />
      </>}
  </>;
}
