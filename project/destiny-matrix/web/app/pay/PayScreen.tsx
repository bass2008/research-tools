"use client";

import PayForm from "@/components/pay/PayForm";
import TariffsProvider from "@/components/pay/TariffsProvider";
import { useLocale } from "@/components/ui/LocaleProvider";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import type { PaymentProvider, Tariff } from "@/lib/tariffs";
import Link from "next/link";

// Экран оплаты один на два маршрута: `/pay` (выбор с нуля) и `/pay/<тариф>` (тариф выбран
// ссылкой из карточки). Отличаются только тем, что отмечено при открытии.
export default function PayScreen({ locale: requestedLocale, ...localeProps }: ({
  tariffs: Tariff[];
  providers: PaymentProvider[] | null;
  initial: string;
  /** true — деньги ненастоящие (мок). Приходит с сервера: вшитое обещание «оплата тестовая»
   *  показывалось покупателям и после подключения боевого терминала. */
  test: boolean;
}) & { locale?: Locale }) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;
  const {
    tariffs,
    providers,
    initial,
    test,
  } = localeProps;

  return (
    <main id="content" className="page">
      <div className="wrap">
        <p className="crumbs">
          <Link href="/">{D.nav.home[L]}</Link> <span>/</span> <span>{D.encLinks.payTitle[L]}</span>
        </p>
        <h1>{D.encLinks.payTitle[L]}</h1>
        {/* прайс приходит из базы; если его нет — API недоступен, и платёж всё равно не
            пройдёт. Называть цену из кода в этот момент нельзя. */}
        {providers?.length === 0 ? (
          <div className="panel paybox" role="status">{D.pay.regionUnavailable[L]}</div>
        ) : tariffs.length && providers?.length ? (
          <TariffsProvider locale={L} server={tariffs} providers={providers}>
            <PayForm locale={L} tariffs={tariffs} initial={initial} test={test} providers={providers} />
          </TariffsProvider>
        ) : (
          <div className="panel paybox">
            <h3>{D.encLinks.priceUnknownTitle[L]}</h3>
            <p className="dim">{D.encLinks.priceUnknownText[L]}</p>
            <button className="btn wide" type="button" onClick={() => window.location.reload()}>
              {D.encLinks.refresh[L]}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
